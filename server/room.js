/* ===========================================================
 * 房间：权威牌局 + 座位管理 + 机器人补位 + 断线托管
 *
 * 设计要点：
 *   - 牌局由服务端驱动，客户端只发「我要出这几张」，由服务端校验
 *   - 每次状态变化广播 sync（全量状态 + 每人私有手牌），客户端无脑重绘
 *   - 房间默认空位，等待期间不自动补机器人（避免"一进来就 3 个电脑"）
 *     由房主在房间内手动「添加电脑」或等真人进满，再开始
 *   - 真人断线 60s 内保留座位，超时交机器人托管
 * =========================================================== */
import GameTable from './game/engine/table.js';
import Rule from './game/engine/rule.js';
import AI from './game/engine/ai.js';
import CardLib from './game/engine/card.js';

const TURN_MS = Number(process.env.GD_TURN_MS || 30000);     // 单回合限时
const BOT_DELAY = Number(process.env.GD_BOT_DELAY || 850);   // 机器人思考时间
const SETTLE_MS = Number(process.env.GD_SETTLE_MS || 6000);  // 结算展示后自动开下一局
const OFFLINE_MS = Number(process.env.GD_OFFLINE_MS || 60000); // 断线保留座位时长

let roomSeq = 100000;

export function newRoomId() {
  // 6 位房间号：100000 - 999999
  roomSeq = 100000 + Math.floor(Math.random() * 900000);
  return String(roomSeq);
}

export default class Room {
  constructor(id) {
    this.id = id;
    this.players = [null, null, null, null];  // { name, ws, seat, online, bot, ready }
    this.table = null;
    this.status = 'waiting';                  // waiting | playing | settled
    this.outs = [null, null, null, null];     // 各家最近一次出牌 { cards, name }
    this.tips = [];                           // 广播用提示
    this.turnTimer = null;
    this.botTimer = null;
    this.settleTimer = null;
    this.autoStartTimer = null;
    this.lastActive = Date.now();
    this.roundNo = 0;
    this.logs = [];
  }

  /* ---------------- 座位 ---------------- */

  emptySeat() {
    return this.players.findIndex((p) => !p);
  }

  humanCount() {
    return this.players.filter((p) => p && !p.bot).length;
  }

  isFull() {
    return this.players.every((p) => !!p);
  }

  /** 房主座位号；没有则返回 -1 */
  hostSeat() {
    return this.players.findIndex((p) => p && p.host);
  }

  isHost(seat) {
    const p = this.players[seat];
    return !!(p && p.host);
  }

  /** 房主座位被清空后，把房主转交给下一个在线真人 */
  ensureHost() {
    if (this.hostSeat() >= 0) return this.hostSeat();
    const next = this.players.findIndex((p) => p && !p.bot && p.online);
    if (next >= 0) this.players[next].host = true;
    return next;
  }

  /** 加入房间；返回座位号，-1 表示满员 */
  join(ws, name) {
    // 同名视为重连（刷新页面 / 断线重连）：恢复原座位，并踢掉旧连接
    const back = this.players.findIndex((p) => p && !p.bot && p.name === name);
    if (back >= 0) {
      const cur = this.players[back];
      if (cur.ws && cur.ws !== ws) {
        const old = cur.ws;
        old.room = null;
        old.seat = -1;
        try { old.close(); } catch (e) { /* ignore */ }
      }
      cur.ws = ws;
      cur.online = true;
      cur.bot = false;
      clearTimeout(cur.offlineTimer);
      cur.offlineTimer = null;
      this.ensureHost();
      this.syncAll();
      return back;
    }
    const seat = this.emptySeat();
    if (seat < 0) return -1;
    this.players[seat] = {
      name: name || ('玩家' + (seat + 1)), ws, online: true, bot: false, ready: false,
      host: this.hostSeat() < 0
    };
    this.ensureHost();
    this.syncAll();
    return seat;
  }

  /** 房主添加一个电脑玩家（默认不自动补位） */
  addBot() {
    if (this.status === 'playing') return { ok: false, msg: '牌局进行中' };
    const seat = this.emptySeat();
    if (seat < 0) return { ok: false, msg: '房间已满' };
    const used = new Set(this.players.filter((p) => p && p.bot).map((p) => p.name));
    let n = 1;
    while (used.has('电脑' + n)) n++;
    this.players[seat] = {
      name: '电脑' + n, ws: null, online: false, bot: true, ready: true, host: false
    };
    this.syncAll();
    return { ok: true, seat };
  }

  /** 房主移除某个电脑座位 */
  removeBot(seat) {
    const p = this.players[seat];
    if (!p) return { ok: false, msg: '座位已空' };
    if (!p.bot) return { ok: false, msg: '只能移除电脑' };
    if (this.status === 'playing') return { ok: false, msg: '牌局进行中' };
    this.players[seat] = null;
    this.syncAll();
    return { ok: true };
  }

  /** 离开（主动退出，座位清空，交由机器人接管本局） */
  leave(seat) {
    const p = this.players[seat];
    if (!p) return;
    if (this.status === 'playing') {
      // 局中离开：转托管，保留座位信息以便重连
      p.online = false;
      p.bot = true;
      p.ws = null;
      this.syncAll();
      this.tick();
      return;
    }
    this.players[seat] = null;
    this.ensureHost();
    if (this.humanCount() === 0) this.destroy();
    else this.syncAll();
  }

  /** 断线 */
  onClose(seat) {
    const p = this.players[seat];
    if (!p) return;
    p.online = false;
    p.ws = null;
    if (this.status === 'playing') {
      // 局中：立刻托管，60s 内重连可接管
      p.bot = true;
      p.offlineTimer = setTimeout(() => {
        if (this.status !== 'playing' && this.humanCount() === 0) this.destroy();
      }, OFFLINE_MS);
      this.tick();
    } else {
      this.players[seat] = null;
      this.ensureHost();
    }
    this.syncAll();
  }

  /* ---------------- 开局 ---------------- */

  /** 房主点「开始游戏」：必须 4 个座位都有玩家（真人或房主添加的电脑） */
  start() {
    clearTimeout(this.autoStartTimer);
    if (this.status === 'playing') return { ok: false, msg: '牌局进行中' };
    const empty = this.players.filter((p) => !p).length;
    if (empty > 0) return { ok: false, msg: '还差 ' + empty + ' 个座位，可添加电脑' };
    for (let i = 0; i < 4; i++) {
      this.players[i].ready = true;
      if (this.players[i].bot === undefined) this.players[i].bot = false;
    }
    this.table = new GameTable(Date.now() % 1000000);
    this.table.deal();
    this.roundNo++;
    this.outs = [null, null, null, null];
    this.status = 'playing';
    this.logs = [];
    this.syncAll();
    this.tick();
    return { ok: true };
  }

  /** 再来一局（沿用当前级牌，重新发牌） */
  nextRound() {
    if (!this.table) return this.start();
    const t = this.table;
    t.deal();                       // 级牌沿用
    this.outs = [null, null, null, null];
    this.status = 'playing';
    this.roundNo++;
    this.logs = [];
    this.syncAll();
    this.tick();
    return { ok: true };
  }

  /* ---------------- 回合驱动 ---------------- */

  tick() {
    clearTimeout(this.turnTimer);
    clearTimeout(this.botTimer);
    this.turnTimer = null;
    this.botTimer = null;
    if (!this.table || this.status !== 'playing') return;

    const t = this.table;
    if (t.step !== 'play') { this.finishRound(); return; }

    const seat = t.currentSeat;
    const p = this.players[seat];
    if (!p) return;

    if (!p.online || p.bot) {
      this.botTimer = setTimeout(() => this.botPlay(seat), BOT_DELAY);
    } else {
      this.turnTimer = setTimeout(() => this.autoPlay(seat), TURN_MS);
    }
  }

  botPlay(seat) {
    if (!this.table || this.status !== 'playing' || this.table.currentSeat !== seat) return;
    const cards = AI.choose(this.table, seat);
    this.applyPlay(seat, cards || []);
  }

  /** 超时自动：能压就压（最小），否则过 */
  autoPlay(seat) {
    if (!this.table || this.status !== 'playing' || this.table.currentSeat !== seat) return;
    let cards = [];
    try { cards = AI.choose(this.table, seat) || []; } catch (e) { cards = []; }
    this.applyPlay(seat, cards);
  }

  /** 玩家出牌请求 */
  playerPlay(seat, cards) {
    if (!this.table || this.status !== 'playing') return { ok: false, msg: '牌局未开始' };
    if (this.table.currentSeat !== seat) return { ok: false, msg: '还没轮到你' };
    const p = this.players[seat];
    if (p && p.bot && p.online) { p.bot = false; }  // 重连后接管
    return this.applyPlay(seat, cards, true);
  }

  applyPlay(seat, cards, fromPlayer) {
    const t = this.table;
    if (t.currentSeat !== seat) return { ok: false, msg: '还没轮到你' };

    const isPass = !cards || cards.length === 0;
    let pattern = null;
    if (!isPass) {
      pattern = Rule.parse(cards, t.levelOf(seat));
      if (!pattern) return { ok: false, msg: '牌型不合法' };
      if (!Rule.canBeat(pattern, t.lastPattern, t.levelOf(seat))) {
        return { ok: false, msg: '压不过上家' };
      }
    } else if (t.lastPlaySeat === seat || t.lastPlaySeat === -1) {
      return { ok: false, msg: '你是先手，必须出牌' };
    }

    const ok = t.play(seat, isPass ? [] : cards);
    if (!ok) return { ok: false, msg: '出牌失败' };

    this.outs[seat] = isPass ? null : { cards: cards.slice(), name: Rule.patternText(pattern) };
    this.lastActive = Date.now();

    this.logs.push({
      seat, pass: isPass,
      cards: isPass ? [] : cards.slice(),
      pattern: isPass ? '' : pattern.name,
      rank: t.seats[seat].rank
    });
    // 头游播报
    if (t.seats[seat].rank === 1) this.tips.push({ seat, type: 'first' });

    this.syncAll();
    this.tick();
    return { ok: true };
  }

  /* ---------------- 结算 ---------------- */

  finishRound() {
    if (this.status !== 'playing') return;
    clearTimeout(this.turnTimer);
    const t = this.table;
    let res = null;
    let tributeLogs = [];
    try {
      res = t.settle();
      if (res && !res.resisted && res.tributes && res.tributes.length) {
        tributeLogs = t.doTribute(res.tributes);
      }
    } catch (e) {
      console.error('[room] settle error', e);
    }
    this.status = 'settled';
    res = res || { winnerTeam: 1, upLevel: 1, doubleDown: false, tributes: [], resisted: false, ranks: [1, 2, 3, 4] };

    const payload = {
      t: 'settle',
      room: this.id,
      round: this.roundNo,
      winnerTeam: res.winnerTeam,
      upLevel: res.upLevel,
      doubleDown: res.doubleDown,
      resisted: res.resisted,
      ranks: t.seats.map((s) => s.rank),
      levels: [t.levelOf(0), t.levelOf(1)],
      tributes: tributeLogs.map((l) => ({
        from: l.fromSeat, to: l.toSeat,
        card: CardLib.name(l.card), back: l.back ? CardLib.name(l.back) : ''
      })),
      outs: this.outs
    };
    this.broadcast(payload);
    this.syncAll();

    // 自动开下一局（所有人都离线则销毁）
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      // 只清理掉线真人，保留房主手动添加的电脑座位
      this.players = this.players.map((p) => (p && !p.online && !p.bot) ? null : p);
      if (this.humanCount() === 0) { this.destroy(); return; }
      this.ensureHost();
      if (this.players.some((p) => !p)) {
        // 有人走了且没补位 → 回到等待房间，等房主加电脑或真人进房
        this.status = 'waiting';
        this.outs = [null, null, null, null];
        this.syncAll();
        return;
      }
      this.nextRound();
    }, SETTLE_MS);
  }

  /* ---------------- 广播 ---------------- */

  /** 生成给某个座位的全量状态 */
  stateFor(seat) {
    const t = this.table;
    const p = this.players[seat];
    const base = {
      t: 'sync',
      room: this.id,
      status: this.status,
      round: this.roundNo,
      step: t ? t.step : 'none',
      currentSeat: t ? t.currentSeat : 0,
      lastPlaySeat: t ? t.lastPlaySeat : -1,
      lastPattern: (t && t.lastPattern) ? {
        id: t.lastPattern.id,
        name: t.lastPattern.name,
        text: Rule.patternText(t.lastPattern),
        cards: t.lastPattern.cards
      } : null,
      level: t ? t.levelOf(seat) : 2,
      levels: t ? [t.levelOf(0), t.levelOf(1)] : [2, 2],
      seats: this.players.map((pl, i) => ({
        seat: i,
        name: pl ? pl.name : '',
        empty: !pl,
        bot: pl ? !!pl.bot : false,
        host: pl ? !!pl.host : false,
        online: pl ? !!pl.online : false,
        ready: pl ? !!pl.ready : false,
        count: t ? t.seats[i].hand.length : 0,
        rank: t ? t.seats[i].rank : 0,
        team: i % 2 === 0 ? 1 : 2
      })),
      hostSeat: this.hostSeat(),
      outs: this.outs.map((o, i) => (o ? { seat: i, cards: o.cards, name: o.name } : null)),
      hand: (t && p && t.seats[seat]) ? t.seats[seat].hand.slice() : [],
      tips: this.tips.slice()
    };
    this.tips = [];
    return base;
  }

  send(seat, msg) {
    const p = this.players[seat];
    if (!p || !p.ws || p.ws.readyState !== 1) return;
    try { p.ws.send(JSON.stringify(msg)); } catch (e) { /* ignore */ }
  }

  broadcast(msg, exceptSeat) {
    const raw = JSON.stringify(msg);
    this.players.forEach((p, i) => {
      if (!p || !p.ws || p.ws.readyState !== 1) return;
      if (exceptSeat != null && i === exceptSeat) return;
      try { p.ws.send(raw); } catch (e) { /* ignore */ }
    });
  }

  syncAll() {
    for (let i = 0; i < 4; i++) {
      const p = this.players[i];
      if (p && p.ws && p.ws.readyState === 1) this.send(i, this.stateFor(i));
    }
  }

  destroy() {
    clearTimeout(this.turnTimer);
    clearTimeout(this.botTimer);
    clearTimeout(this.settleTimer);
    clearTimeout(this.autoStartTimer);
    this.players.forEach((p) => { if (p) clearTimeout(p.offlineTimer); });
    this.status = 'closed';
  }
}
