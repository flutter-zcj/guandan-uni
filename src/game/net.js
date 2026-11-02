/* ===========================================================
 * WebSocket 联机客户端
 *   - 自动拼接 ws/wss 地址（兼容 /guandan/ 子路径部署）
 *   - 心跳保活 + 断线自动重连（指数退避，最多 5 次）
 *   - 事件回调：joined / sync / settle / error / open / close
 * =========================================================== */

const RECONNECT_MAX = 5;

function buildUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  // 页面路径形如 /guandan/ 或 /guandan/index.html，取其目录 + ws
  let base = location.pathname;
  if (!/\/$/.test(base)) base = base.replace(/\/[^/]*$/, '/');
  return proto + '//' + location.host + base + 'ws';
}

export default class Net {
  constructor(opts) {
    this.room = String(opts.room || '');
    this.name = String(opts.name || '');
    this.create = !!opts.create;      // true = 房间不存在时新建（创建房间）
    this.url = opts.url || (typeof window !== 'undefined' && window.__GD_WS) || buildUrl();
    this.ws = null;
    this.handlers = {};
    this.connected = false;
    this.seat = -1;
    this._retry = 0;
    this._hb = null;
    this._closedByUser = false;
  }

  on(type, fn) {
    (this.handlers[type] = this.handlers[type] || []).push(fn);
    return this;
  }

  emit(type, payload) {
    (this.handlers[type] || []).forEach((fn) => {
      try { fn(payload); } catch (e) { console.error('[net] handler error', type, e); }
    });
  }

  connect() {
    this._closedByUser = false;
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this.emit('error', { msg: '无法连接服务器' });
      return;
    }

    this.ws.onopen = () => {
      this.connected = true;
      this._retry = 0;
      this.emit('open', {});
      this.send({ t: 'join', room: this.room, name: this.name, create: this.create });
      clearInterval(this._hb);
      this._hb = setInterval(() => this.send({ t: 'ping' }), 25000);
    };

    this.ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'pong' || m.t === 'hello') return;
      if (m.t === 'joined') this.seat = m.seat;
      this.emit(m.t, m);
    };

    this.ws.onclose = () => {
      this.connected = false;
      clearInterval(this._hb);
      this.emit('close', {});
      if (!this._closedByUser && this._retry < RECONNECT_MAX) {
        const wait = 1200 * Math.pow(1.6, this._retry);
        this._retry++;
        setTimeout(() => this.connect(), wait);
      }
    };

    this.ws.onerror = () => { this.emit('error', { msg: '网络异常' }); };
  }

  send(obj) {
    if (!this.ws || this.ws.readyState !== 1) return false;
    try { this.ws.send(JSON.stringify(obj)); return true; } catch (e) { return false; }
  }

  play(cards) { return this.send({ t: 'play', cards }); }
  pass() { return this.send({ t: 'pass' }); }
  start() { return this.send({ t: 'start' }); }
  addBot() { return this.send({ t: 'addBot' }); }
  removeBot(seat) { return this.send({ t: 'removeBot', seat }); }
  leave() { return this.send({ t: 'leave' }); }

  close() {
    this._closedByUser = true;
    clearInterval(this._hb);
    if (this.ws) { try { this.ws.close(); } catch (e) {} }
  }
}

/** 生成 6 位房间号（本地预生成，服务端会以其为准） */
export function genRoomId() {
  return String(100000 + Math.floor(Math.random() * 900000));
}
