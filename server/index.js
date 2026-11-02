/* ===========================================================
 * 掼蛋联机服务端
 *
 *   启动：node index.js            （默认端口 8082）
 *   直连：ws://host:8082
 *   反代：Nginx location /guandan/ws -> 127.0.0.1:8082（需 Upgrade 头）
 *
 * 协议（JSON over WebSocket）
 *   C -> S : {t:'join', room, name}   {t:'start'}   {t:'play', cards:[...]}
 *            {t:'pass'}  {t:'leave'}  {t:'ping'}
 *   S -> C : {t:'joined', seat, room} {t:'sync', ...}  {t:'settle', ...}
 *            {t:'error', msg}         {t:'pong'}
 * =========================================================== */
import http from 'http';
import { WebSocketServer } from 'ws';
import Room, { newRoomId } from './room.js';

const PORT = Number(process.env.PORT || 8082);
const MAX_ROOMS = 500;
const IDLE_MS = 30 * 60 * 1000;   // 空房间 30 分钟回收

const rooms = new Map();

/* ---------------- HTTP：健康检查 + 房间列表 ---------------- */

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/health' || url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      rooms: rooms.size,
      players: [...rooms.values()].reduce((n, r) => n + r.humanCount(), 0),
      uptime: Math.floor(process.uptime())
    }));
    return;
  }
  if (url === '/rooms') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify([...rooms.values()].map((r) => ({
      id: r.id, status: r.status, humans: r.humanCount(),
      seats: r.players.map((p) => (p ? p.name : ''))
    }))));
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

/* ---------------- WebSocket ---------------- */

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.room = null;
  ws.seat = -1;

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (buf) => {
    let msg;
    try { msg = JSON.parse(buf.toString()); } catch (e) {
      return safeSend(ws, { t: 'error', msg: '消息格式错误' });
    }
    if (!msg || typeof msg.t !== 'string') return;

    if (msg.t === 'ping') return safeSend(ws, { t: 'pong', ts: Date.now() });
    if (msg.t === 'join') return handleJoin(ws, msg);
    if (!ws.room) return safeSend(ws, { t: 'error', msg: '请先加入房间' });

    const room = ws.room;
    const seat = ws.seat;

    switch (msg.t) {
      case 'start': {
        if (room.status === 'playing') return safeSend(ws, { t: 'error', msg: '牌局进行中' });
        if (!room.isHost(seat)) return safeSend(ws, { t: 'error', msg: '只有房主可以开始游戏' });
        const r = room.start();
        if (!r.ok) safeSend(ws, { t: 'error', msg: r.msg });
        break;
      }
      case 'addBot': {
        if (!room.isHost(seat)) return safeSend(ws, { t: 'error', msg: '只有房主可以添加电脑' });
        const r = room.addBot();
        if (!r.ok) safeSend(ws, { t: 'error', msg: r.msg });
        break;
      }
      case 'removeBot': {
        if (!room.isHost(seat)) return safeSend(ws, { t: 'error', msg: '只有房主可以移除电脑' });
        const r = room.removeBot(Number(msg.seat));
        if (!r.ok) safeSend(ws, { t: 'error', msg: r.msg });
        break;
      }
      case 'play': {
        const cards = Array.isArray(msg.cards) ? msg.cards.filter((c) => Number.isInteger(c)) : [];
        const r = room.playerPlay(seat, cards);
        if (!r.ok) safeSend(ws, { t: 'error', msg: r.msg });
        break;
      }
      case 'pass': {
        const r = room.playerPlay(seat, []);
        if (!r.ok) safeSend(ws, { t: 'error', msg: r.msg });
        break;
      }
      case 'leave':
        room.leave(seat);
        ws.room = null;
        ws.seat = -1;
        safeSend(ws, { t: 'left' });
        break;
      case 'ready': {
        const p = room.players[seat];
        if (p) { p.ready = !!msg.ready; room.syncAll(); }
        break;
      }
      default:
        safeSend(ws, { t: 'error', msg: '未知指令 ' + msg.t });
    }
  });

  ws.on('close', () => {
    if (ws.room && ws.seat >= 0) {
      ws.room.onClose(ws.seat);
      ws.room = null;
    }
  });

  ws.on('error', () => { /* 忽略单连接错误 */ });

  safeSend(ws, { t: 'hello', ts: Date.now() });
});

function safeSend(ws, msg) {
  if (ws.readyState !== 1) return;
  try { ws.send(JSON.stringify(msg)); } catch (e) { /* ignore */ }
}

function handleJoin(ws, msg) {
  if (ws.room) return safeSend(ws, { t: 'error', msg: '已在房间中' });

  const name = String(msg.name || '').slice(0, 12);
  const create = !!msg.create;
  let id = String(msg.room || '').trim();
  if (!/^\d{4,6}$/.test(id)) {
    if (!create) return safeSend(ws, { t: 'error', msg: '房间号需 4-6 位数字' });
    id = newRoomId();
  }

  let room = rooms.get(id);
  if (create && room) {
    // 房号已被占用：另开一个新房间，避免误入别人的牌局
    let nid = newRoomId();
    while (rooms.has(nid)) nid = newRoomId();
    id = nid;
    room = null;
  }
  if (!room) {
    // 输错房号不再"顺手建房"，避免进到空房间还以为进了朋友的房
    if (!create) return safeSend(ws, { t: 'error', msg: '房间 ' + id + ' 不存在' });
    if (rooms.size >= MAX_ROOMS) return safeSend(ws, { t: 'error', msg: '服务器房间已满' });
    room = new Room(id);
    rooms.set(id, room);
  }

  const isReconnect = room.players.some((p) => p && !p.bot && p.name === name);
  if (room.status === 'playing' && !isReconnect) {
    return safeSend(ws, { t: 'error', msg: '牌局已开始，请等本局结束再进' });
  }

  const seat = room.join(ws, name);
  if (seat < 0) return safeSend(ws, { t: 'error', msg: '房间已满（4 人）' });

  ws.room = room;
  ws.seat = seat;
  safeSend(ws, { t: 'joined', room: id, seat, name: room.players[seat].name });
  room.syncAll();

  // 4 个真人坐满才自动开局；人不满时留在房间，由房主添加电脑或等待好友
  if (room.humanCount() === 4 && room.status === 'waiting') {
    setTimeout(() => {
      if (room.status === 'waiting' && room.humanCount() === 4) room.start();
    }, 800);
  }
}

/* ---------------- 心跳 + 回收 ---------------- */

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch (e) { /* ignore */ }
  });
}, 30000);

setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, id) => {
    const idle = room.humanCount() === 0 && now - room.lastActive > IDLE_MS;
    if (idle || room.status === 'closed') {
      room.destroy();
      rooms.delete(id);
    }
  });
}, 60000);

server.listen(PORT, () => {
  console.log('[guandan-server] listening on :' + PORT + '  (ws path /ws)');
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('SIGINT', () => { server.close(() => process.exit(0)); });
