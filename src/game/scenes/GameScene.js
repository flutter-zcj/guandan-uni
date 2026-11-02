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
import GdAudio, { preloadAudio } from '../audio.js';

const W = 1280, H = 720;

/* 座位：0=南(我) 1=西(上家) 2=北(对家) 3=东(下家) */
const SEAT_POS = [
  { x: 640, y: 664 },
  { x: 104, y: 286 },
  { x: 640, y: 82 },
  { x: 1176, y: 286 }
];
const SEAT_NAME = ['我', '西家', '北家', '东家'];

/* 各家出牌落点（南家在中央下方，北家上方，左右家中线） */
const OUT_POS = [
  { x: 640, y: 350 },
  { x: 288, y: 322 },
  { x: 640, y: 246 },
  { x: 992, y: 322 }
];
/* 各家出牌区缩放：自己最大，对家/上下家缩小 */
const OUT_SCALE = [0.85, 0.50, 0.42, 0.50];

/* 手牌大牌（原版 bigCards 142x194，原尺寸显示） */
const HAND_Y = 622;          // 大牌中心 y：底边贴近屏幕底部（顶边 525）
const HAND_GAP_MAX = 42;
const HAND_GAP_MIN = 16;
const HAND_UP = 26;          // 选中上移
/* 他家牌背（原版 smallCards 42x57） */
const BACK_W = 42, BACK_H = 57;

/* 操作按钮：贴右下角、手牌上方，避免遮挡手牌（原版按钮 273x97 等比缩小） */
const BTN_W = 168, BTN_H = 60, BTN_Y = 470;
const BTN_X = { pass: 806, hint: 986, play: 1166 };

export default class GuandanScene extends Phaser.Scene {
  constructor() {
    super('guandan');
  }

  /* ---------------- 生命周期 ---------------- */

  preload() {
    // 加载掼蛋原版美术资源（牌面 / 牌背 / 按钮 / LOGO / 徽标）与全部音效
    TEX.preloadAssets(this);
    preloadAudio(this, 'men');
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
    // 原版牌桌底图（1280x800 等比铺满；加载失败回退程序化桌布）
    if (this.textures.exists('ui_table')) {
      this.add.image(0, 0, 'ui_table').setOrigin(0, 0).setDisplaySize(W, H).setDepth(0);
      // 轻微暗角，让中间牌面更突出
      const vg = this.add.graphics().setDepth(1);
      vg.fillStyle(0x000000, 0.10);
      vg.fillRect(0, 0, W, 54);
      vg.fillRect(0, H - 70, W, 70);
    } else {
      this.add.image(0, 0, 'table_bg').setOrigin(0, 0);
    }
    // 桌面中央 LOGO（原版 zhuomianlog 水印）
    this.add.image(640, 296, 'ui_logo').setAlpha(0.5).setScale(0.78).setDepth(2);
    this.buildTopBar();
    this.buildSeats();
    this.buildInfo();
    this.buildButtons();

    // 音效（原版资源）：背景音乐 + 全部音效语音
    this.audio = new GdAudio(this);

    this.newRound();
  }

  buildTextures() {
    TEX.buildTableTexture(this, W, H);
    TEX.buildCardShadowTexture(this, TEX.CARD_W, TEX.CARD_H);
    TEX.buildAvatarTexture(this, 'avatar', 80, '#c9a86a');
    TEX.buildAvatarTexture(this, 'avatar_cur', 80, '#ffd76a');
    TEX.buildBadgeTexture(this, 'b_rank2', 74, 26, '#3879a8', '二游');
    TEX.buildBadgeTexture(this, 'b_rank3', 74, 26, '#7a7a7a', '三游');
    TEX.buildButtonTextures(this, 'btn_again', 210, 60, null, { kind: 'primary', label: '再玩一局' });
  }

  /* ---------------- 顶层信息条 ---------------- */

  buildTopBar() {
    const g = this.add.graphics().setDepth(40);
    // 顶栏：深绿半透明 + 底部金线
    g.fillStyle(0x04220f, 0.62);
    g.fillRect(0, 0, W, 46);
    g.fillStyle(0xffffff, 0.05);
    g.fillRect(0, 0, W, 18);
    g.lineStyle(1.5, 0xe8c46a, 0.5);
    g.beginPath(); g.moveTo(0, 46); g.lineTo(W, 46); g.strokePath();
    g.fillStyle(0x000000, 0.22);
    g.fillRect(0, 47, W, 5);

    this.txtTitle = this.add.text(22, 23, '掼 蛋', {
      fontFamily: '"Microsoft YaHei","PingFang SC",sans-serif',
      fontSize: '23px', color: '#ffe9b0', fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(41);

    const back = this.add.text(108, 23, '‹ 返回', {
      fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '17px', color: '#cfe9da'
    }).setOrigin(0, 0.5).setDepth(41).setInteractive({ useHandCursor: true });
    back.on('pointerup', () => { if (this.audio) this.audio.uiClick(); if (this.onExit) this.onExit(); });

    this.txtLevelInfo = this.add.text(W / 2, 23, '', {
      fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '18px', color: '#9fe6bf'
    }).setOrigin(0.5).setDepth(41);

    this.txtRound = this.add.text(W - 78, 23, '', {
      fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '17px', color: '#ffe9b0'
    }).setOrigin(1, 0.5).setDepth(41);

    this.buildSoundToggle();
  }

  /** 音效开关（顶栏右侧圆形喇叭） */
  buildSoundToggle() {
    const cx = W - 34, cy = 23;
    const c = this.add.container(cx, cy).setDepth(42);
    const ring = this.add.circle(0, 0, 16, 0x000000, 0.32).setStrokeStyle(1.5, 0xe8c46a, 0.8);
    const gfx = this.add.graphics();
    const draw = (on) => {
      gfx.clear();
      gfx.fillStyle(on ? 0xffe9b0 : 0x8aa79a, 1);
      // 喇叭主体
      gfx.fillRect(-7, -3.5, 4, 7);
      gfx.beginPath();
      gfx.moveTo(-3, -3.5); gfx.lineTo(2, -7.5); gfx.lineTo(2, 7.5); gfx.lineTo(-3, 3.5);
      gfx.closePath(); gfx.fillPath();
      if (on) {
        gfx.lineStyle(1.6, 0xffe9b0, 0.95);
        gfx.beginPath(); gfx.arc(2.5, 0, 5, -0.9, 0.9); gfx.strokePath();
        gfx.beginPath(); gfx.arc(2.5, 0, 8, -0.85, 0.85); gfx.strokePath();
      } else {
        gfx.lineStyle(1.8, 0xe08a7a, 1);
        gfx.beginPath(); gfx.moveTo(-6, -8); gfx.lineTo(8, 8); gfx.strokePath();
      }
    };
    c.add([ring, gfx]);
    c.setSize(36, 36).setInteractive({ useHandCursor: true });
    draw(true);
    c.on('pointerup', () => {
      const muted = this.audio ? this.audio.toggle() : false;
      draw(!muted);
      if (!muted && this.audio) this.audio.uiClick();
      this.toast(muted ? '音效已关闭' : '音效已开启', muted ? '#c9c9c9' : '#9fe6bf');
    });
    this.soundToggle = c;
  }

  /* ---------------- 座位面板 ---------------- */

  buildSeats() {
    this.seatNodes = [];
    for (let i = 0; i < 4; i++) {
      const p = SEAT_POS[i];
      const c = this.add.container(p.x, p.y);
      const isSelf = (i === 0);
      const ring = this.add.image(0, 0, 'avatar').setDisplaySize(78, 78).setVisible(!isSelf);
      const name = this.add.text(0, 46, SEAT_NAME[i], {
        fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '18px',
        color: '#ffffff', stroke: '#06200f', strokeThickness: 3
      }).setOrigin(0.5).setVisible(!isSelf);
      // 张数：自家放手牌上方右侧空白处；他家放头像侧边，避开牌背与出牌区
      const cntX = isSelf ? 60 : (i === 3 ? -60 : 60);
      const cntY = isSelf ? -194 : -8;
      const cnt = this.add.text(cntX, cntY, '', {
        fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '17px',
        color: '#ffd76a', stroke: '#06200f', strokeThickness: 3
      }).setOrigin(isSelf ? 1 : 0.5);
      const lv = this.add.text(0, 68, '', {
        fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '15px', color: '#9fe6bf'
      }).setOrigin(0.5).setVisible(false);
      const badge = this.add.image(44, -44, 'ui_team1').setDisplaySize(40, 44).setOrigin(0.5).setVisible(false);
      const rank = this.add.image(26, -30, 'ui_mark_first').setDisplaySize(40, 40).setOrigin(0.5).setVisible(!isSelf);
      c.add([ring, name, cnt, lv, badge, rank]);
      this.seatNodes.push({ box: c, ring, name, cnt, lv, badge, rank, handSprites: [], outSprites: [] });
    }
  }

  /* ---------------- 中央信息 ---------------- */

  buildInfo() {
    // 状态与提示放在左侧空白区（牌背右侧、手牌上方），不遮挡任何牌
    this.txtCenter = this.add.text(180, 436, '', {
      fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '18px',
      color: '#cfe9da', align: 'left', lineSpacing: 4
    }).setOrigin(0, 0.5).setDepth(58);

    this.txtTip = this.add.text(180, 464, '', {
      fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '17px', color: '#cfeee0'
    }).setOrigin(0, 0.5).setDepth(58).setAlpha(0);

    this.txtToast = this.add.text(640, 352, '', {
      fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '26px',
      color: '#ffd76a', align: 'center', stroke: '#06200f', strokeThickness: 6
    }).setOrigin(0.5).setDepth(300).setAlpha(0);
  }

  toast(msg, color) {
    this.txtToast.setText(msg).setColor(color || '#ffd76a').setAlpha(1).setDepth(300);
    this.tweens.killTweensOf(this.txtToast);
    this.tweens.add({ targets: this.txtToast, alpha: 0, delay: 1200, duration: 600 });
  }

  /* ---------------- 按钮 ---------------- */

  buildButtons() {
    // 原版三色按钮（273x97 提取图），等比缩小到 168x60，贴右下角、位于手牌上方
    const mk = (key, x, y, cb) => {
      // 阴影底衬，让按钮从桌布上"浮"起来
      const shadow = this.add.image(x + 3, y + 5, key)
        .setDisplaySize(BTN_W, BTN_H).setTint(0x000000).setAlpha(0.32).setDepth(59);
      const s = this.add.image(x, y, key).setDisplaySize(BTN_W, BTN_H)
        .setDepth(60).setInteractive({ useHandCursor: true });
      s.shadow = shadow;
      const down = key + '_down';
      s.setEnabled = (on) => {
        s.enabled = on;
        s.setTexture(on ? key : down);
        s.setAlpha(on ? 1 : 0.9);
        shadow.setVisible(on);
      };
      s.on('pointerdown', () => {
        if (s.enabled === false) return;
        s.setTexture(down); s.setTint(0xd8d8d8);
        if (this.audio) this.audio.uiDown();
      });
      s.on('pointerout', () => { if (s.enabled !== false) { s.setTexture(key); s.clearTint(); } });
      s.on('pointerup', () => {
        s.clearTint();
        if (s.enabled === false) return;
        s.setTexture(key);
        if (this.audio) this.audio.uiClick();
        cb();
      });
      return s;
    };
    this.btnPass = mk('ui_pass', BTN_X.pass, BTN_Y, () => this.onPass());
    this.btnHint = mk('ui_hint', BTN_X.hint, BTN_Y, () => this.onHint());
    this.btnPlay = mk('ui_play', BTN_X.play, BTN_Y, () => this.onPlay());

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
      if (this.audio) this.audio.uiClick();
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
    [this.btnPass, this.btnHint, this.btnPlay].forEach(b => b.setVisible(true));
    this.txtToast.setAlpha(0);
    this.txtTip.setAlpha(0);

    this.level = this.table.levelOf(0);

    if (this.audio) this.audio.dealStart();
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
      node.cnt.setText((i === 0 ? '我 · ' : '') + s.hand.length + ' 张');
      node.lv.setText('打' + CardLib.rankName(t.levelOf(i)));
      node.ring.setTexture((t.currentSeat === i && t.step === 'play') ? 'avatar_cur' : 'avatar');
      node.badge.setVisible(i === 2);
      if (s.rank > 0) {
        // 头游/末游用原版徽标图，二游/三游用文字徽标
        const key = s.rank === 1 ? 'ui_mark_first' : s.rank === 4 ? 'ui_mark_last' : 'b_rank' + s.rank;
        node.rank.setVisible(true).setTexture(key);
        if (s.rank === 2 || s.rank === 3) node.rank.setDisplaySize(74, 26);
        else node.rank.setDisplaySize(40, 40);
        if (i === 0) node.rank.setPosition(0, -164);
      } else node.rank.setVisible(false);
      this.renderHand(i);
      this.renderOut(i);
    }

    if (t.step === 'play') {
      const mine = t.currentSeat === 0;
      let txt = mine ? '轮到你了' : SEAT_NAME[t.currentSeat] + ' 出牌中…';
      if (t.lastPattern) txt += '\n待压：' + Rule.patternText(t.lastPattern);
      this.txtCenter.setText(txt).setColor(mine ? '#ffd76a' : '#cfe9da');
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
        // 牌投影：让重叠的牌有层次
        cont.add(this.add.image(2, 4, 'card_shadow')
          .setDisplaySize(TEX.BIG_W + 12, TEX.BIG_H + 12).setAlpha(0.5));
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
      const gap = seat === 2 ? 11 : 6;
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
    // 出牌区：自己用原版 130x181 的 85%，他家按比例缩小
    const sc = OUT_SCALE[seat];
    const cw = TEX.CARD_W * sc;
    const chh = TEX.CARD_H * sc;
    const maxW = seat === 0 ? 620 : 320;
    const gap = o.cards.length > 1 ? Math.min(26, Math.max(10, (maxW - cw) / (o.cards.length - 1))) : 0;
    const total = (o.cards.length - 1) * gap;
    o.cards.forEach((card, i) => {
      const x = p.x - total / 2 + i * gap;
      const sh = this.add.image(x + 2, p.y + 4, 'card_shadow')
        .setDisplaySize(cw, chh).setAlpha(0.5);
      node.outSprites.push(sh);
      const spr = this.add.image(x, p.y, TEX.cardKey(card));
      spr.setDisplaySize(cw, chh);
      node.outSprites.push(spr);
    });
    const txt = this.add.text(p.x, p.y - chh / 2 - 16, o.patternName, {
      fontFamily: '"Microsoft YaHei",sans-serif', fontSize: (seat === 0 ? 19 : 16) + 'px',
      color: '#ffe9b0', stroke: '#0a2416', strokeThickness: 4
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
    if (this.audio) this.audio.cardSelect();
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
    if (this.audio) this.audio.playCards(p);
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
    if (this.audio) this.audio.pass();
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
        if (this.audio) this.audio.playCards(p);
      } else {
        t.play(seat, []);
        this.outShow[seat] = null;
        if (this.audio) this.audio.pass();
      }
    } else {
      t.play(seat, []);
      this.outShow[seat] = null;
      if (this.audio) this.audio.pass();
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
      if (this.audio) this.audio.fanbei();
    } else if (res.tributes && res.tributes.length) {
      const logs = this.table.doTribute(res.tributes);
      tributeInfo = logs.map(l =>
        SEAT_NAME[l.fromSeat] + ' 进贡 ' + CardLib.name(l.card) +
        (l.back ? '，' + SEAT_NAME[l.toSeat] + ' 还 ' + CardLib.name(l.back) : '')
      ).join('；');
      if (this.audio) this.audio.tribute();
    }
    if (tributeInfo) lines.push(tributeInfo);

    this.level = this.table.levelOf(0);

    if (this.audio) {
      if (res.winnerTeam === 1) this.audio.win(); else this.audio.lose();
    }

    this.renderAll();
    [this.btnPass, this.btnHint, this.btnPlay].forEach(b => {
      b.setVisible(false);
      if (b.shadow) b.shadow.setVisible(false);
    });
    this.showPanel(res.winnerTeam === 1 ? '胜 利' : '失 败', lines);
    this.btnAgain.setVisible(true);
    this.btnAgain.setEnabled(true);
  }

  showPanel(title, lines) {
    if (this.panel) this.panel.destroy();
    const pw = 520, ph = 300;
    const c = this.add.container(640, 334).setDepth(1000);
    const g = this.add.graphics();
    // 全屏遮罩
    g.fillStyle(0x000000, 0.66);
    g.fillRect(-640, -334, W, H);
    // 面板投影 + 主体
    g.fillStyle(0x000000, 0.38);
    g.fillRoundedRect(-pw / 2 + 7, -ph / 2 + 9, pw, ph, 20);
    g.fillStyle(0x0b3b23, 1);
    g.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 18);
    // 标题带
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(-pw / 2 + 2, -ph / 2 + 2, pw - 4, 76, { tl: 16, tr: 16, bl: 0, br: 0 });
    // 双层金边
    g.lineStyle(3, 0xe8c46a, 1);
    g.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 18);
    g.lineStyle(1, 0xfff3cf, 0.3);
    g.strokeRoundedRect(-pw / 2 + 7, -ph / 2 + 7, pw - 14, ph - 14, 13);
    // 标题下金线
    g.lineStyle(2, 0xe8c46a, 0.65);
    g.beginPath(); g.moveTo(-pw / 2 + 34, -ph / 2 + 78); g.lineTo(pw / 2 - 34, -ph / 2 + 78); g.strokePath();
    c.add(g);

    const win = title.indexOf('胜') >= 0;
    c.add(this.add.text(0, -ph / 2 + 40, title, {
      fontFamily: '"Microsoft YaHei","PingFang SC",sans-serif', fontSize: '34px',
      color: win ? '#ffd76a' : '#a8c8f0', fontStyle: 'bold',
      stroke: '#04170c', strokeThickness: 5
    }).setOrigin(0.5));

    c.add(this.add.text(0, 30, lines.join('\n'), {
      fontFamily: '"Microsoft YaHei",sans-serif', fontSize: '19px',
      color: '#e8f5ee', align: 'center', lineSpacing: 11,
      wordWrap: { width: pw - 70 }
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
