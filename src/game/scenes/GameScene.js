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
  { x: 640, y: 430 },
  { x: 286, y: 320 },
  { x: 640, y: 214 },
  { x: 994, y: 320 }
];

/* 手牌大牌（原版 bigCards 142x194，原尺寸显示） */
const HAND_Y = 622;          // 大牌中心 y：底边贴近屏幕底部
const HAND_GAP_MAX = 42;
const HAND_GAP_MIN = 16;
const HAND_UP = 26;          // 选中上移
/* 他家牌背（原版 smallCards 42x57） */
const BACK_W = 42, BACK_H = 57;

export default class GuandanScene extends Phaser.Scene {
  constructor() {
    super('guandan');
  }

  /* ---------------- 生命周期 ---------------- */

  preload() {
    // 加载掼蛋原版美术资源（牌面 / 牌背 / 按钮 / LOGO / 徽标）
    TEX.preloadAssets(this);
  }

  create() {
    this.table = new GameTable(Date.now() % 1000000);
    this.mySeat = 0;
    this.selected = new Set();
    this.hintList = [];
    this.hintIdx = -1;
    this.busy = false;
    this.outShow = [null, null, null, null];   // 各家最近一次出牌
    this._dbg = { Rule, HintFinder, CardLib };  // 调试/自动化测试用
    this.level = this.table.levelOf(0);
    this.settle = null;
    this.panel = null;

    this.buildTextures();
    this.add.image(0, 0, 'table_bg').setOrigin(0, 0);
    // 桌面中央 LOGO（原版 zhuomianlog，半透明水印）
    this.add.image(640, 306, 'ui_logo').setAlpha(0.30).setDepth(0);
    this.buildTopBar();
    this.buildSeats();
    this.buildInfo();
    this.buildButtons();

    this.newRound();
  }

  buildTextures() {
    TEX.buildTableTexture(this, W, H);
    TEX.buildAvatarTexture(this, 'avatar', 80, '#c9a86a');
    TEX.buildAvatarTexture(this, 'avatar_cur', 80, '#ffd76a');
    TEX.buildBadgeTexture(this, 'b_rank2', 74, 26, '#3879a8', '二游');
    TEX.buildBadgeTexture(this, 'b_rank3', 74, 26, '#7a7a7a', '三游');
    TEX.buildButtonTextures(this, 'btn_again', 210, 60, null, { kind: 'primary', label: '再玩一局' });
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
      const badge = this.add.image(44, -44, 'ui_team1').setDisplaySize(40, 44).setOrigin(0.5).setVisible(false);
      const rank = this.add.image(56, -48, 'ui_mark_first').setDisplaySize(40, 40).setOrigin(0.5).setVisible(!isSelf);
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
    // 原版三色按钮（273x97 提取图），显示 180x64
    const BW = 180, BH = 64, BY = 576;
    const mk = (key, x, y, cb) => {
      const s = this.add.image(x, y, key).setDisplaySize(BW, BH)
        .setDepth(60).setInteractive({ useHandCursor: true });
      const down = key + '_down';
      s.setEnabled = (on) => {
        s.enabled = on;
        s.setTexture(on ? key : down);
        s.setAlpha(on ? 1 : 0.92);
      };
      s.on('pointerdown', () => { if (s.enabled !== false) { s.setTexture(down); s.setTint(0xcccccc); } });
      s.on('pointerout', () => { if (s.enabled !== false) { s.setTexture(key); s.clearTint(); } });
      s.on('pointerup', () => {
        s.clearTint();
        if (s.enabled === false) return;
        s.setTexture(key);
        cb();
      });
      return s;
    };
    this.btnHint = mk('ui_hint', 800, BY, () => this.onHint());
    this.btnPlay = mk('ui_play', 990, BY, () => this.onPlay());
    this.btnPass = mk('ui_pass', 1180, BY, () => this.onPass());

    // 再玩一局：程序化三态按钮
    const again = this.add.image(640, 612, 'btn_again_normal').setDisplaySize(210, 60)
      .setDepth(60).setInteractive({ useHandCursor: true }).setVisible(false);
    again.setEnabled = (on) => {
      again.enabled = on;
      again.setTexture(on ? 'btn_again_normal' : 'btn_again_disabled');
    };
    again.on('pointerdown', () => { if (again.enabled !== false) again.setTexture('btn_again_pressed'); });
    again.on('pointerout', () => { if (again.enabled !== false) again.setTexture('btn_again_normal'); });
    again.on('pointerup', () => {
      if (again.enabled === false) return;
      again.setTexture('btn_again_normal');
      this.newRound();
    });
    this.btnAgain = again;
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
        // 头游/末游用原版徽标图，二游/三游用文字徽标
        const key = s.rank === 1 ? 'ui_mark_first' : s.rank === 4 ? 'ui_mark_last' : 'b_rank' + s.rank;
        node.rank.setVisible(true).setTexture(key);
        if (s.rank === 2 || s.rank === 3) node.rank.setDisplaySize(74, 26);
        else node.rank.setDisplaySize(40, 40);
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
      // 原版手牌：142x194 大牌 = 底版 + 数字贴片 + 小花色（级牌橙数字 / 逢人配金框）
      const n = hand.length;
      const cw = TEX.BIG_W, chh = TEX.BIG_H;
      const wildCard = Rule.levelHeartCard ? Rule.levelHeartCard(this.level) : 0;
      const avail = W - 60;
      let gap = n > 1 ? Math.min(HAND_GAP_MAX, (avail - cw) / (n - 1)) : 0;
      if (gap < HAND_GAP_MIN) gap = HAND_GAP_MIN;
      const total = cw + gap * (n - 1);
      const startX = 640 - total / 2 + cw / 2;
      hand.forEach((card, i) => {
        const cont = this.add.container(startX + i * gap, HAND_Y);
        cont.setDepth(10 + i);
        const base = this.add.image(0, 0, TEX.bigKey(card));
        cont.add(base);
        if (card < 53) {
          const rank = CardLib.num(card);                 // 14=A .. 13=K
          const suit = CardLib.suitOf(card);              // 1方 2梅 3红 4黑
          const isLevel = rank === this.level;
          const colorTag = isLevel ? 'orange' : (suit === 1 || suit === 3) ? 'red' : 'black';
          cont.add(this.add.image(-63, -91, 'p_num_' + colorTag + '_' + rank).setOrigin(0));
          cont.add(this.add.image(-63, -45, TEX.suitKey(suit)).setOrigin(0));
        }
        if (card === wildCard) cont.add(this.add.image(0, 0, 'p_glow'));  // 逢人配金框
        if (this.selected.has(i)) cont.y = HAND_Y - HAND_UP;
        base.setInteractive({ useHandCursor: true });
        base.on('pointerup', () => this.toggleCard(i));
        cont.cardIndex = i;
        node.handSprites.push(cont);
      });
    } else {
      // 他家手牌：原版 smallCards 牌背 42x57
      const gap = seat === 2 ? 12 : 6;
      const n = hand.length;
      const p = SEAT_POS[seat];
      hand.forEach((card, i) => {
        let spr;
        if (seat === 1 || seat === 3) {
          const total = (n - 1) * gap;
          spr = this.add.image(p.x, p.y + 168 - total / 2 + i * gap, 'p_back');
          spr.setAngle(seat === 1 ? 90 : -90);
        } else {
          const total = (n - 1) * gap;
          spr = this.add.image(p.x - total / 2 + i * gap, p.y + 96, 'p_back');
        }
        spr.setDisplaySize(BACK_W, BACK_H);
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
    // 我方出牌用原版出牌区尺寸 130x181；他家缩小
    const cw = seat === 0 ? TEX.CARD_W : TEX.CARD_W * 0.55;
    const chh = seat === 0 ? TEX.CARD_H : TEX.CARD_H * 0.55;
    const maxW = seat === 0 ? 560 : 300;
    const gap = o.cards.length > 1 ? Math.min(24, Math.max(10, (maxW - cw) / (o.cards.length - 1))) : 0;
    const total = (o.cards.length - 1) * gap;
    o.cards.forEach((card, i) => {
      const spr = this.add.image(p.x - total / 2 + i * gap, p.y, TEX.cardKey(card));
      spr.setDisplaySize(cw, chh);
      node.outSprites.push(spr);
    });
    const txt = this.add.text(p.x, p.y - chh / 2 - 18, o.patternName, {
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
      spr.y = HAND_Y - HAND_UP;
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
    this.seatNodes[0].handSprites.forEach((s, i) => { s.y = this.selected.has(i) ? HAND_Y - HAND_UP : HAND_Y; });
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
