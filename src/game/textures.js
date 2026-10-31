/* ===========================================================
 * 纹理工厂：程序化绘制牌面 / 牌背 / 桌面 / 按钮
 * 说明：为保证合规，所有素材均为代码绘制生成，
 *       仅参照原 app 的视觉风格（配色、布局比例），不搬运其美术资源。
 * =========================================================== */

export const SS = 2; // 超采样倍数，保证高清屏不糊

export const CARD_W = 92;
export const CARD_H = 130;

/* ---------- 基础绘制工具 ---------- */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function newCanvas(scene, key, w, h) {
  const old = scene.textures.get(key);
  if (old && old.key === key) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, Math.round(w * SS), Math.round(h * SS));
  const ctx = tex.getContext();
  ctx.scale(SS, SS);
  ctx.clearRect(0, 0, w, h);
  return { tex, ctx };
}

/* ---------- 花色与点数 ---------- */

const SUIT = ['♦', '♣', '♥', '♠'];         // 0方块 1梅花 2红桃 3黑桃
const RANK = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const RED = '#cf2030';
export const BLK = '#1c1c1c';

/** 花色索引：0方块 1梅花 2红桃 3黑桃；-1 为王 */
export function suitOf(card) {
  if (card === 53 || card === 54) return -1;
  return Math.floor((card - 1) / 13);
}
export function rankOf(card) {
  if (card === 53 || card === 54) return -1;
  return ((card - 1) % 13) + 1; // 1=A .. 13=K
}
export function cardKey(card) {
  return card === 53 ? 'card_sj' : card === 54 ? 'card_bj' : 'card_' + card;
}

/* ---------- 牌面 ---------- */

function drawSuit(ctx, ch, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px "Arial","Helvetica",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, x, y);
}

function drawCardFace(ctx, w, h, card, opt) {
  const wild = !!(opt && opt.wild);
  const levelMark = !!(opt && opt.levelMark);

  // 底：白牌
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#f2f2f0');
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, w, h, 9);
  ctx.fill();

  // 边框：逢人配金色
  ctx.lineWidth = wild ? 3 : 1.4;
  ctx.strokeStyle = wild ? '#f0b23a' : wild ? '#f0b23a' : '#c9c9c4';
  roundRect(ctx, ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth, 9);
  ctx.stroke();

  if (wild) {
    // 逢人配金色内衬
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#f5c451';
    roundRect(ctx, 4, 4, w - 8, h - 8, 7);
    ctx.fill();
    ctx.restore();
  }

  const s = suitOf(card);
  const r = rankOf(card);
  const color = s === 0 || s === 2 ? RED : BLK;

  if (s < 0) {
    // 大小王：角标竖排"大/小"，中央大"王"字
    const big = card === 54;
    const c = big ? RED : BLK;
    ctx.fillStyle = c;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(h * 0.11)}px "Microsoft YaHei","PingFang SC",sans-serif`;
    ctx.fillText(big ? '大' : '小', w * 0.18, h * 0.10);
    ctx.fillText('王', w * 0.18, h * 0.19);
    ctx.font = `bold ${Math.round(h * 0.36)}px "Microsoft YaHei","PingFang SC",sans-serif`;
    ctx.fillText('王', w / 2, h * 0.50);
    ctx.font = `${Math.round(h * 0.13)}px "Arial",sans-serif`;
    ctx.fillText('JOKER', w / 2, h * 0.76);
    return;
  }

  const ch = SUIT[s];
  const txt = RANK[r - 1];

  // 中央大花色
  drawSuit(ctx, ch, w / 2, h * 0.54, Math.round(h * 0.42), color);

  // 左上角：点数 + 小花色
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.font = `bold ${txt === '10' ? 17 : 20}px "Arial","Helvetica",sans-serif`;
  ctx.fillText(txt, w * 0.175, h * 0.13);
  drawSuit(ctx, ch, w * 0.175, h * 0.245, 15, color);

  // 右下角（旋转 180）
  ctx.save();
  ctx.translate(w, h);
  ctx.rotate(Math.PI);
  ctx.fillStyle = color;
  ctx.font = `bold ${txt === '10' ? 17 : 20}px "Arial","Helvetica",sans-serif`;
  ctx.fillText(txt, w * 0.175, h * 0.13);
  drawSuit(ctx, ch, w * 0.175, h * 0.245, 15, color);
  ctx.restore();

  // 级牌角标（非配牌的级牌标记小星）
  if (levelMark && !wild) {
    ctx.fillStyle = '#e8a33d';
    ctx.font = `bold ${Math.round(h * 0.13)}px "Arial",sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('★', w * 0.5, h * 0.13);
  }
}

/** 生成全部 54 张牌面 + 牌背 */
export function buildCardTextures(scene, level) {
  for (let c = 1; c <= 54; c++) {
    const key = cardKey(c);
    const { tex, ctx } = newCanvas(scene, key, CARD_W, CARD_H);
    const wild = level > 0 && c === CardLevelHeartFn(level);
    const levelMark = level > 0 && rankOf(c) === level && c !== 54 && c !== 53;
    drawCardFace(ctx, CARD_W, CARD_H, c, { wild, levelMark });
    tex.refresh();
  }
  // 牌背
  {
    const { tex, ctx } = newCanvas(scene, 'card_back', CARD_W, CARD_H);
    const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    g.addColorStop(0, '#2f6fb5');
    g.addColorStop(1, '#1c4a86');
    ctx.fillStyle = g;
    roundRect(ctx, 0, 0, CARD_W, CARD_H, 9);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    roundRect(ctx, 5, 5, CARD_W - 10, CARD_H - 10, 7);
    ctx.stroke();
    // 斜纹
    ctx.save();
    roundRect(ctx, 7, 7, CARD_W - 14, CARD_H - 14, 6);
    ctx.clip();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    for (let i = -CARD_H; i < CARD_W; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + CARD_H, CARD_H);
      ctx.stroke();
    }
    ctx.restore();
    tex.refresh();
  }
}

/** 级牌红桃牌的编码（与规则引擎一致：红桃级牌为逢人配） */
function CardLevelHeartFn(level) {
  if (level === 1) level = 14; // A
  return 27 + (level - 1);     // 红桃 27..39 对应 A,2..K
}

/* ---------- 桌面 ---------- */

export function buildTableTexture(scene, w, h) {
  const { tex, ctx } = newCanvas(scene, 'table_bg', w, h);
  // 深绿渐变
  const g = ctx.createRadialGradient(w / 2, h * 0.46, h * 0.12, w / 2, h * 0.5, h * 0.92);
  g.addColorStop(0, '#1f7a4d');
  g.addColorStop(0.55, '#12603a');
  g.addColorStop(1, '#08351f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // 中央椭圆高光（牌桌）
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.48, w * 0.40, h * 0.33, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // 暗角
  const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  tex.refresh();
}

/* ---------- 通用控件 ---------- */

/** 圆角按钮：normal / pressed / disabled 三态 */
export function buildButtonTextures(scene, key, w, h, base, opts) {
  const mk = (suffix, top, bottom, border, txtColor) => {
    const { tex, ctx } = newCanvas(scene, `${key}_${suffix}`, w, h);
    const r = Math.min(h / 2, 14);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    roundRect(ctx, 1, 1, w - 2, h - 2, r);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = border;
    roundRect(ctx, 1.5, 1.5, w - 3, h - 3, r);
    ctx.stroke();
    // 顶部高光
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 4, 4, w - 8, h * 0.36, r);
    ctx.fill();
    ctx.restore();
    if (opts && opts.label) {
      ctx.fillStyle = txtColor;
      ctx.font = `bold ${Math.round(h * 0.42)}px "Microsoft YaHei","PingFang SC",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.label, w / 2, h / 2 + 1);
    }
    tex.refresh();
  };
  if (opts && opts.kind === 'primary') {
    mk('normal', '#ffd76a', '#f0a52c', '#c8801a', '#5c3200');
    mk('pressed', '#e8a33d', '#c8801a', '#a06610', '#4a2800');
    mk('disabled', '#cfcfc9', '#b3b3ad', '#9a9a94', '#f2f2f0');
  } else {
    mk('normal', '#fdfdfd', '#e2e2de', '#bdbdb8', '#3b3b3b');
    mk('pressed', '#dcdcd7', '#c2c2bd', '#a5a5a0', '#2b2b2b');
    mk('disabled', '#e8e8e4', '#d4d4cf', '#c0c0bb', '#a8a8a3');
  }
  return { w, h };
}

/** 头像底板（圆形） */
export function buildAvatarTexture(scene, key, size, ring) {
  const { tex, ctx } = newCanvas(scene, key, size, size);
  ctx.fillStyle = '#0d4a2e';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(size * 0.4, size * 0.36, 1, size / 2, size / 2, size * 0.56);
  g.addColorStop(0, '#f7e9c9');
  g.addColorStop(1, '#c9a86a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.40, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = ring || '#e8c46a';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
  ctx.stroke();
  tex.refresh();
}

/** 出牌气泡底（半透明圆角矩形） */
export function buildBubbleTexture(scene, key, w, h) {
  const { tex, ctx } = newCanvas(scene, key, w, h);
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = '#04220f';
  roundRect(ctx, 0, 0, w, h, 12);
  ctx.fill();
  ctx.restore();
  tex.refresh();
}

/** 队友/等级徽标 */
export function buildBadgeTexture(scene, key, w, h, color, label) {
  const { tex, ctx } = newCanvas(scene, key, w, h);
  ctx.fillStyle = color;
  roundRect(ctx, 0, 0, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(h * 0.6)}px "Microsoft YaHei","PingFang SC",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2, h / 2 + 1);
  tex.refresh();
}

export default {
  SS, CARD_W, CARD_H, RED, BLK,
  suitOf, rankOf, cardKey,
  buildCardTextures, buildTableTexture, buildButtonTextures,
  buildAvatarTexture, buildBubbleTexture, buildBadgeTexture
};
