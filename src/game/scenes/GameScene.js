/* ===========================================================
 * Phaser 掼蛋牌桌场景
 * 设计分辨率 1280x720（与原 app 一致的横屏比例），Scale.FIT 自适应移动端
 * =========================================================== */

import CardLib from '../engine/card.js';
import Rule from '../engine/rule.js';
import HintFinder from '../engine/hint.js';
import GameTable from '../engine/table.js';
import AI from '../engine/ai.js';
import TEX from '../textures.js';

const W = 1280, H = 720;

/* 座位：0=南(我) 1=西(上家) 2=北(对家) 3=东(下家) */
const SEAT_POS = [
  { x: 640, y: 664 },
  { x: 104, y: 286 },
  { x: 640, y: 100 },
  { x: 1176, y: 286 }
];
const SEAT_NAME = ['我', '西家', '北家', '东家'];

/* 各家出牌落点 */
const OUT_POS = [
  { x: 640, y: 452 },
  { x: 286, y: 320 },
  { x: 640, y: 214 },
  { x: 994, y: 320 }
];

const HAND_SCALE = 0.86;
const SMALL_SCALE = 0.38;
const HAND_GAP_MAX = 42;
const HAND_GAP_MIN = 17;
const HAND_Y = 656;

export default class GuandanScene extends Phaser.Scene {
  constructor() {
    super('guandan');
  }

  /* ---------------- 生命周期 ---------------- */

  create() {
    this.table = new GameTable(Date.now() % 1000000);
    this.mySeat = 0;
    this.selected = new Set();
    this.hintList = [];
    this.hintIdx = -1;
    this.busy = false;
    this.outShow = [null, null, null, null];   // 各家最近一次出牌
    this._dbg = { Rule, HintFinder, CardLib };  // 调试/自动化测试用
    this.lastRenderedLevel = -1;
    this.settle = null;
    this.panel = null;

    this.buildTextures();
    this.add.image(0, 0, 'table_bg').setOrigin(0, 0);
    this.buildTopBar();
    this.buildSeats();
    this.buildInfo();
    this.buildButtons();

    if (this.lastRenderedLevel !== this.table.levelOf(0)) {
      this.level = this.table.levelOf(0);
      this.refreshCardTextures();
    }
    this.newRound();
  }

  buildTextures() {
    TEX.buildTableTexture(this, W, H);
    TEX.buildAvatarTexture(this, 'avatar', 80, '#c9a86a');
    TEX.buildAvatarTexture(this, 'avatar_cur', 80, '#ffd76a');
    TEX.buildBadgeTexture(this, 'badge_team', 44, 24, '#2f8f5b', '队友');
    TEX.buildBadgeTexture(this, 'b_rank1', 74, 26, '#c8801a', '头游');
    TEX.buildBadgeTexture(this, 'b_rank2', 74, 26, '#4a7ab5', '二游');
    TEX.buildBadgeTexture(this, 'b_rank3', 74, 26, '#7a7a7a', '三游');
    TEX.buildBadgeTexture(this, 'b_rank4', 74, 26, '#8a5a2a', '末游');
    TEX.buildButtonTextures(this, 'btn_hint', 130, 52, null, { kind: 'plain', label: '提 示' });
    TEX.buildButtonTextures(this, 'btn_play', 130, 52, null, { kind: 'primary', label: '出 牌' });
    TEX.buildButtonTextures(this, 'btn_pass', 130, 52, null, { kind: 'plain', label: '不 出' });
    TEX.buildButtonTextures(this, 'btn_again', 210, 60, null, { kind: 'primary', label: '再玩一局' });
  }

  refreshCardTextures() {
    TEX.buildCardTextures(this, this.level);
    this.lastRenderedLevel = this.level;
  }

  /* ---------------- 顶层信息条 ---------------- */

  buildTopBar() {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.34);
    g.fillRect(0, 0, W, 44);

    this.txtTitle = this.add.text(22, 22, '掼蛋', {
      fontFamily: '"Microsoft YaHei","PingFang SC",sans-serif', fontSize: '24px', color: '#ffe9b0'
    }).setOrigin(0, 0.5);

    const back = this.add.text(96, 22, '‹ 返回', {
      fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '18px', color: '#ffe9b0'
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    back.on('pointerup', () => { if (this.onExit) this.onExit(); });

    this.txtLevelInfo = this.add.text(W / 2, 22, '', {
      fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '18px', color: '#9fe6bf'
    }).setOrigin(0.5);

    this.txtRound = this.add.text(W - 22, 22, '', {
      fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '18px', color: '#ffe9b0'
    }).setOrigin(1, 0.5);
  }

  /* ---------------- 座位面板 ---------------- */

  buildSeats() {
    this.seatNodes = [];
    for (let i = 0; i < 4; i++) {
      const p = SEAT_POS[i];
      const c = this.add.container(p.x, p.y);
      const isSelf = (i === 0);
      const ring = this.add.image(0, 0, 'avatar').setDisplaySize(78, 78).setVisible(!isSelf);
      const name = this.add.text(0, 50, SEAT_NAME[i], {
        fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '19px', color: '#ffffff'
      }).setOrigin(0.5).setVisible(!isSelf);
      // 我家：张数显示在左下角，避免压住手牌
      const cnt = this.add.text(isSelf ? -608 : 0, isSelf ? 40 : -56, '', {
        fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '18px', color: '#ffd76a'
      }).setOrigin(0.5);
      const lv = this.add.text(0, 72, '', {
        fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '16px', color: '#9fe6bf'
      }).setOrigin(0.5).setVisible(!isSelf);
      const badge = this.add.image(0, 96, 'badge_team').setOrigin(0.5).setVisible(false);
      const rank = this.add.image(52, -40, 'b_rank1').setOrigin(0.5).setVisible(!isSelf);
      c.add([ring, name, cnt, lv, badge, rank]);
      this.seatNodes.push({ box: c, ring, name, cnt, lv, badge, rank, handSprites: [], outSprites: [] });
    }
  }

  /* ---------------- 中央信息 ---------------- */

  buildInfo() {
    this.txtCenter = this.add.text(640, 306, '', {
      fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '21px',
      color: '#ffe9b0', align: 'center', lineSpacing: 6
    }).setOrigin(0.5);

    this.txtTip = this.add.text(640, 596, '', {
      fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '19px', color: '#cfeee0'
    }).setOrigin(0.5).setAlpha(0);

    this.txtToast = this.add.text(640, 250, '', {
      fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '28px',
      color: '#ffd76a', align: 'center', stroke: '#000000', strokeThickness: 5
    }).setOrigin(0.5).setAlpha(0);
  }

  toast(msg, color) {
    this.txtToast.setText(msg).setColor(color || '#ffd76a').setAlpha(1);
    this.tweens.killTweensOf(this.txtToast);
    this.tweens.add({ targets: this.txtToast, alpha: 0, delay: 1200, duration: 600 });
  }

  /* ---------------- 按钮 ---------------- */

  buildButtons() {
    const mk = (key, x, y, cb) => {
      const s = this.add.image(x, y, key + '_normal').setInteractive({ useHandCursor: true });
      s.setEnabled = (on) => {
        s.enabled = on;
        s.setTexture(on ? key + '_normal' : key + '_disabled');
      };
      s.on('pointerdown', () => { if (s.enabled !== false) s.setTexture(key + '_pressed'); });
      s.on('pointerout', () => { if (s.enabled !== false) s.setTexture(key + '_normal'); });
      s.on('pointerup', () => {
        if (s.enabled === false) return;
        s.setTexture(key + '_normal');
        cb();
      });
      return s;
    };
    this.btnHint = mk('btn_hint', 806, 566, () => this.onHint());
    this.btnPlay = mk('btn_play', 954, 566, () => this.onPlay());
    this.btnPass = mk('btn_pass', 1102, 566, () => this.onPass());
    this.btnAgain = mk('btn_again', 640, 612, () => this.newRound()).setVisible(false);
  }

  /* ---------------- 一局开始 ---------------- */

  newRound() {
    if (this.panel) { this.panel.destroy(); this.panel = null; }
    this.table.deal();
    this.selected.clear();
    this.hintList = [];
    this.hintIdx = -1;
    this.busy = false;
    this.settle = null;
    this.outShow = [null, null, null, null];
    this.btnAgain.setVisible(false);
    this.txtToast.setAlpha(0);
    this.txtTip.setAlpha(0);

    this.level = this.table.levelOf(0);
    if (this.lastRenderedLevel !== this.level) this.refreshCardTextures();

    this.renderAll();
    this.scheduleTurn();
  }

  /* ---------------- 渲染 ---------------- */

  renderAll() {
    const t = this.table;
    this.txtRound.setText('第 ' + t.roundNo + ' 局');
    const lv = this.level;
    const wildCard = Rule.levelHeartCard ? Rule.levelHeartCard(lv) : 0;
    this.txtLevelInfo.setText(
      '本方打 ' + CardLib.rankName(lv) + '    对方打 ' + CardLib.rankName(t.levelOf(1)) +
      '    逢人配 ' + (wildCard ? CardLib.name(wildCard) : '-')
    );

    for (let i = 0; i < 4; i++) {
      const s = t.seats[i], node = this.seatNodes[i];
      node.cnt.setText(s.hand.length + ' 张');
      node.lv.setText('打' + CardLib.rankName(t.levelOf(i)));
      node.ring.setTexture((t.currentSeat === i && t.step === 'play') ? 'avatar_cur' : 'avatar');
      node.badge.setVisible(i === 2);
      if (s.rank > 0) {
        node.rank.setVisible(true).setTexture('b_rank' + s.rank);
        if (i === 0) node.rank.setPosition(-560, -40);
      } else node.rank.setVisible(false);
      this.renderHand(i);
      this.renderOut(i);
    }

    if (t.step === 'play') {
      const who = SEAT_NAME[t.currentSeat];
      let txt = who + '出牌';
      if (t.lastPattern) txt += '\n待压：' + Rule.patternText(t.lastPattern);
      this.txtCenter.setText(txt);
    } else {
      this.txtCenter.setText('');
    }
    this.updateButtons();
  }

  renderHand(seat) {
    const node = this.seatNodes[seat];
    node.handSprites.forEach(s => s.destroy());
    node.handSprites = [];
    const hand = this.table.seats[seat].hand;

    if (seat === 0) {
      const n = hand.length;
      const cw = TEX.CARD_W * HAND_SCALE;
      const avail = W - 40;
      let gap = n > 1 ? Math.min(HAND_GAP_MAX, (avail - cw) / (n - 1)) : 0;
      if (gap < HAND_GAP_MIN) gap = HAND_GAP_MIN;
      const total = cw + gap * (n - 1);
      const startX = 640 - total / 2 + cw / 2;
      hand.forEach((card, i) => {
        const spr = this.add.image(startX + i * gap, HAND_Y, TEX.cardKey(card));
        spr.setDisplaySize(cw, TEX.CARD_H * HAND_SCALE);
        spr.setDepth(i);
        if (this.selected.has(i)) spr.y = HAND_Y - 22;
        spr.setInteractive({ useHandCursor: true });
        spr.on('pointerup', () => this.toggleCard(i));
        node.handSprites.push(spr);
      });
    } else {
      const cw = TEX.CARD_W * SMALL_SCALE;
      const chh = TEX.CARD_H * SMALL_SCALE;
      const gap = seat === 2 ? 12 : 6;              // 左右家纵向牌背更密，避免压头像/按钮
      const n = hand.length;
      const p = SEAT_POS[seat];
      hand.forEach((card, i) => {
        let spr;
        if (seat === 1 || seat === 3) {
          const total = (n - 1) * gap;
          spr = this.add.image(p.x, p.y + 168 - total / 2 + i * gap, 'card_back');
          spr.setAngle(seat === 1 ? 90 : -90);
        } else {
          const total = (n - 1) * gap;
          spr = this.add.image(p.x - total / 2 + i * gap, p.y + 96, 'card_back');
        }
        spr.setDisplaySize(cw, chh);
        node.handSprites.push(spr);
      });
    }
  }

  renderOut(seat) {
    const node = this.seatNodes[seat];
    node.outSprites.forEach(s => s.destroy());
    node.outSprites = [];
    const o = this.outShow[seat];
    if (!o) return;
    const p = OUT_POS[seat];
    const scale = 0.6;
    const gap = 20;
    const total = (o.cards.length - 1) * gap;
    o.cards.forEach((card, i) => {
      const spr = this.add.image(p.x - total / 2 + i * gap, p.y, TEX.cardKey(card));
      spr.setDisplaySize(TEX.CARD_W * scale, TEX.CARD_H * scale);
      node.outSprites.push(spr);
    });
    const txt = this.add.text(p.x, p.y - 48, o.patternName, {
      fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '18px',
      color: '#ffe9b0', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);
    node.outSprites.push(txt);
  }

  /* ---------------- 交互 ---------------- */

  myTurn() {
    return this.table.step === 'play' && this.table.currentSeat === 0 && !this.busy;
  }

  toggleCard(idx) {
    if (!this.myTurn()) return;
    const spr = this.seatNodes[0].handSprites[idx];
    if (this.selected.has(idx)) {
      this.selected.delete(idx);
      spr.y = HAND_Y;
    } else {
      this.selected.add(idx);
      spr.y = HAND_Y - 22;
    }
    this.hintIdx = -1;
    this.showSelTip();
    this.updateButtons();
  }

  showSelTip() {
    if (this.selected.size === 0) { this.txtTip.setAlpha(0); return; }
    const hand = this.table.seats[0].hand;
    const cards = [...this.selected].map(i => hand[i]);
    const p = Rule.parse(cards, this.level);
    if (!p) { this.txtTip.setText('牌型不合法').setColor('#ff9c8a').setAlpha(1); return; }
    const cur = this.table.lastPattern;
    if (cur && !Rule.canBeat(p, cur, this.level)) {
      this.txtTip.setText(p.name + ' 压不过 ' + cur.name).setColor('#ff9c8a').setAlpha(1);
    } else {
      this.txtTip.setText(p.name).setColor('#9fe6bf').setAlpha(1);
    }
  }

  onHint() {
    if (!this.myTurn()) return;
    if (this.hintList.length === 0) {
      this.hintList = HintFinder.find(this.table.seats[0].hand, this.table.lastPattern, this.level);
      this.hintIdx = -1;
    }
    if (this.hintList.length === 0) {
      this.toast('没有能压过的牌，请过牌', '#ff9c8a');
      return;
    }
    this.hintIdx = (this.hintIdx + 1) % this.hintList.length;
    this.selected.clear();
    const hand = this.table.seats[0].hand;
    // 两副牌存在编码相同的重复牌，按计数分配 index，避免 indexOf 永远命中同一张
    const need = {};
    this.hintList[this.hintIdx].cards.forEach(c => { need[c] = (need[c] || 0) + 1; });
    hand.forEach((c, i) => {
      if (need[c] > 0) { this.selected.add(i); need[c]--; }
    });
    this.seatNodes[0].handSprites.forEach((s, i) => { s.y = this.selected.has(i) ? HAND_Y - 22 : HAND_Y; });
    this.txtTip.setText(Rule.patternText(this.hintList[this.hintIdx])).setColor('#9fe6bf').setAlpha(1);
    this.updateButtons();
  }

  onPlay() {
    if (!this.myTurn()) return;
    const hand = this.table.seats[0].hand;
    const cards = [...this.selected].map(i => hand[i]);
    if (cards.length === 0) { this.toast('请先选牌'); return; }
    const p = Rule.parse(cards, this.level);
    if (!p) { this.toast('牌型不合法'); return; }
    if (this.table.lastPattern && !Rule.canBeat(p, this.table.lastPattern, this.level)) {
      this.toast('压不过上家'); return;
    }
    if (!this.table.play(0, cards)) { this.toast('出牌失败'); return; }

    this.outShow[0] = { cards: cards.slice(), patternName: Rule.patternText(p) };
    this.clearSelection();
    this.renderAll();
    if (this.checkEnd()) return;
    this.scheduleTurn();
  }

  onPass() {
    if (!this.myTurn()) return;
    if (!this.table.lastPattern) { this.toast('你是先手，必须出牌'); return; }
    this.table.play(0, []);
    this.outShow[0] = null;
    this.clearSelection();
    this.renderAll();
    this.scheduleTurn();
  }

  clearSelection() {
    this.selected.clear();
    this.hintList = [];
    this.hintIdx = -1;
    this.txtTip.setAlpha(0);
  }

  /* ---------------- 回合调度 ---------------- */

  scheduleTurn() {
    const t = this.table;
    if (t.step !== 'play') { this.checkEnd(); return; }
    if (t.currentSeat === 0) { this.updateButtons(); return; }
    this.busy = true;
    this.updateButtons();
    this.time.delayedCall(this.aiDelay || 600, () => this.aiTurn());
  }

  aiTurn() {
    const t = this.table;
    if (t.step !== 'play') { this.busy = false; this.checkEnd(); return; }
    const seat = t.currentSeat;
    const cards = AI.choose(t, seat);
    if (cards && cards.length) {
      const p = Rule.parse(cards, this.level);
      if (t.play(seat, cards)) {
        this.outShow[seat] = { cards: cards.slice(), patternName: p ? Rule.patternText(p) : '' };
      } else {
        t.play(seat, []);
        this.outShow[seat] = null;
      }
    } else {
      t.play(seat, []);
      this.outShow[seat] = null;
    }
    this.busy = false;
    this.renderAll();
    if (this.checkEnd()) return;
    this.scheduleTurn();
  }

  checkEnd() {
    const t = this.table;
    if (t.step === 'play') return false;
    if (this.settle) return true;
    this.doWinLost();
    return true;
  }

  /* ---------------- 结算 ---------------- */

  doWinLost() {
    const res = this.table.settle();
    this.settle = res;

    const lines = [];
    lines.push(res.winnerTeam === 1 ? '本方胜！' : '对方胜');
    if (res.doubleDown) lines.push('双下');
    lines.push('本方：' + CardLib.rankName(this.table.levelOf(0) === 15 ? 14 : this.table.levelOf(0)));
    lines.push('升级 +' + res.upLevel);

    let tributeInfo = '';
    if (res.resisted) {
      tributeInfo = '抗贡：双大王，免贡';
    } else if (res.tributes && res.tributes.length) {
      const logs = this.table.doTribute(res.tributes);
      tributeInfo = logs.map(l =>
        SEAT_NAME[l.fromSeat] + ' 进贡 ' + CardLib.name(l.card) +
        (l.back ? '，' + SEAT_NAME[l.toSeat] + ' 还 ' + CardLib.name(l.back) : '')
      ).join('；');
    }
    if (tributeInfo) lines.push(tributeInfo);

    this.level = this.table.levelOf(0);
    if (this.lastRenderedLevel !== this.level) this.refreshCardTextures();

    this.renderAll();
    this.showPanel(res.winnerTeam === 1 ? '胜 利' : '失 败', lines);
    this.btnAgain.setVisible(true);
    this.btnAgain.setEnabled(true);
  }

  showPanel(title, lines) {
    if (this.panel) this.panel.destroy();
    const c = this.add.container(640, 330).setDepth(1000);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.62);
    g.fillRect(-640, -330, W, H);
    g.fillStyle(0x0e3c26, 1);
    g.fillRoundedRect(-240, -140, 480, 280, 16);
    g.lineStyle(2, 0xe8c46a, 1);
    g.strokeRoundedRect(-240, -140, 480, 280, 16);
    c.add(g);
    c.add(this.add.text(0, -100, title, {
      fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '34px', color: '#ffd76a'
    }).setOrigin(0.5));
    c.add(this.add.text(0, -20, lines.join('\n'), {
      fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '19px',
      color: '#e8f5ee', align: 'center', lineSpacing: 8,
      wordWrap: { width: 430 }
    }).setOrigin(0.5));
    this.panel = c;
  }

  /* ---------------- 按钮态 ---------------- */

  updateButtons() {
    const t = this.table;
    const turn = this.myTurn();
    let canPlay = false;
    if (turn && this.selected.size > 0) {
      const hand = t.seats[0].hand;
      const cards = [...this.selected].map(i => hand[i]);
      const p = Rule.parse(cards, this.level);
      canPlay = !!p && (!t.lastPattern || Rule.canBeat(p, t.lastPattern, this.level));
    }
    this.btnHint.setEnabled(turn);
    this.btnPlay.setEnabled(turn && canPlay);
    this.btnPass.setEnabled(turn && !!t.lastPattern);
  }
}

export { W, H };
