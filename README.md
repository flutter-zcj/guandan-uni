# guandan-uni —— 掼蛋（Phaser 3 + uni-app）

基于 [prjtmpl](https://github.com/flutter-zcj/prjtmpl) 模板（uni-app + Vue3 + Vite），
用 **Phaser 3** 渲染的掼蛋单机对战（1 人 + 3 AI）。规则引擎对齐逆向还原的原版 Lua 逻辑
（牌型权重取自 `InitGDCard.lua`，压牌判定同 `LuaRunRule.canOut`）。

## 在线试玩

<https://60.204.248.157:8081/guandan/>（自签证书，浏览器点"继续访问"）

**强制横屏**：竖屏打开时自动把画面整体旋转 90° 变成横屏铺满（触摸坐标同步修正）；
移动端首次触屏还会自动尝试「全屏 + 系统横屏锁定」（`screen.orientation.lock`，iOS 不支持时由旋转兜底），
右上角 ⛶ 可随时手动全屏。交互：点牌选中（金色边框为逢人配）、`提示` 循环切换候选、`出牌` / `不出`。

## 规则要点（与原版一致）

- 两副牌 108 张，4 人各 27 张；2↔A 升级，级牌权重 20（>A、<小王）
- 红桃级牌为**逢人配**（百搭，金色边框标记）
- 牌型权重：四炸 110 < 五炸 120 < 同花顺 130 < 六炸 140 < … < 四大王 190
- 结算：1+2 名双下升 3 级、1+3 升 2 级、1+4 升 1 级；末游向头游进贡最大非王非配牌，双下时三游也贡；进贡方持双大王可抗贡

## 目录结构

```
src/
├── game/                  游戏层（与 uni 框架解耦）
│   ├── engine/            规则引擎（纯 JS，与 server/Guandan.Core 同逻辑）
│   │   ├── card.js        牌编码/排序/权重
│   │   ├── rule.js        牌型识别 + 压牌判定
│   │   ├── hint.js        提示搜索（配牌统一分配器）
│   │   ├── table.js       牌局状态机（发牌/出牌/名次/升级/进贡/抗贡）
│   │   └── ai.js          AI 出牌策略
│   ├── scenes/GameScene.js  Phaser 牌桌场景（1280x720，Scale.FIT）
│   ├── textures.js        程序化纹理（牌面/桌面/按钮，全部代码绘制）
│   └── main.js            Phaser 启动器
├── pages/guandan/guandan.vue  页面（挂载 Phaser + 横竖屏适配）
└── pages.json / manifest.json / vite.config.ts
```

## 构建运行

```bash
npm install
npm run dev:h5        # 本地开发
npm run build:h5      # 产物 dist/build/h5（纯静态，可直接部署）
```

## 验证

- 规则引擎：60 项单测 + 200 局全 AI 对局模拟（0 错误，见 `guandan-game` 仓库）
- 端到端：Playwright 真浏览器跑完整 3 局到结算（升级/进贡链路），0 JS 错误，截图见 `docs/verify/`
- 强制横屏：竖屏自动旋转铺满 + 触摸坐标命中校验（点击末张手牌精确选中），横屏/桌面回归通过

## 音效

原版音效共 **120 条**，全部从原 APK 提取（MP3 未加密，`ffprobe` 逐条校验通过），整理到 `src/static/game/sound/`：

| 类别 | 文件 |
|---|---|
| 背景音乐 | `bgm.mp3`（原版大厅 32s 循环） |
| UI | `ui/click` `ui/select` `ui/mousedown` |
| 出牌 | `play/out` `play/out2` `play/pass` `play/passa` |
| 特技 | `act/bomb` `act/tonghuashun` `act/siwang` `act/fanbei` `act/gold2` `act/flashlight` |
| 结算 | `result/win` `result/lose` `result/win2` `result/lose2` |
| 牌型语音 | `voice/men/*` `voice/women/*`（各 38 条，男女声） |

语音命名完全还原原版 `getSoundName()`：单张 `{w}.mp3`、对子 `{w}{w}.mp3`、三张 `sanzhang`、炸弹 `bombs`、
三带二 `three_two`、钢板 `gangban`、三连对 `duiduishun`、顺子 `shunzi`、同花顺 `tonghuashun`、四大天王 `bomb`；
权重修正 `20(级牌)→2`、`21(小王)→15`、`22(大王)→16`。

`src/game/audio.js` 负责：移动端手势解锁、BGM 循环、语音单通道（避免叠音）、顶栏静音开关。

## 联机对战

**当前实现**：房间号联机（Node.js + WebSocket，服务端权威），详见 [docs/03-联机与微信接入方案.md](docs/03-联机与微信接入方案.md)。

```bash
cd server
npm install
node index.js            # 默认端口 8082，可用 PORT=9102 覆盖
```

- 入口：`https://<host>/guandan/`（大厅）→ 输入 6 位房间号或创建房间
- 不满 4 人时 **5 秒后自动补机器人**，一个人也能开局
- 断线 60 秒内可重连，局中离线自动托管
- 服务端权威洗牌/发牌/校验，客户端无法作弊

## 资源说明

美术与音频素材提取自用户提供的原 APK（`guandan_70023`），仅用于玩法与界面的复刻研究，
提取工具与方法见 [guandan-reverse/tools](../guandan-reverse/tools)（PNG/JPEG 头部修复、cocos plist 图集切分、资源整理）。
