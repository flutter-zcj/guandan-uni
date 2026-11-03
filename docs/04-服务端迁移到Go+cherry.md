# 04 · 服务端迁移到 Go + cherry

> 目标：把掼蛋联机服务端从 Node.js + ws 换成 **cherry**（Go Actor 框架），
> 业务行为与旧版逐项对齐，前端只改协议编解码层，玩法逻辑不动。

## 一、为什么换

旧版是单进程 Node 事件循环 + 裸 WebSocket：

- 牌局状态和定时器全靠 `setTimeout` + 手动 `clearTimeout`，一局里十几个定时器，容易漏清；
- 没有分层，路由、校验、广播、存储混在 `index.js` / `room.js`；
- 没有持久化，战绩、对局记录、玩家档案都留不下来。

cherry 的 Actor 模型正好对上「一个房间一个串行执行单元」的诉求：房间内的出牌、超时托管、
机器人思考、结算定时全部落在同一个 goroutine 的消息队列里，**天然无锁、天然有序**。

## 二、架构

```
客户端 (uni-app H5 / Phaser)
   │  WS  binary frame:  mid(4B) + len(4B) + JSON
   ▼
cherry websocket connector ── simple parser ── 路由表(mid → funcName)
   │                                              │
   │  SetOnDataRoute：直接投递给 room actor        │
   ▼                                              ▼
RoomActor（单 actor，串行处理全部房间）
   ├── rooms   map[roomID]*Room
   ├── seats   map[sid]{roomID, seat}
   ├── Timer().Add(1min, gc)          空房间回收
   └── time.AfterFunc ──PostLocal──▶ 定时事件（回合超时/机器人/结算/掉线）
                                       │
                                       ▼
                                   Room 状态机 ──▶ game 引擎（发牌/牌型/提示/AI/升级进贡）
                                       │
                                       └── hooks.OnSettle ──▶ store 组件 ──▶ MySQL（异步队列）

HTTP 运维口（独立端口 9103）：/health /rooms /top /rounds
```

### 为什么所有房间放在一个 actor

4 人房每一步操作都是「解析最多 10 张牌 + 广播 4 条 JSON」，微秒级。单个 actor 串行即可支撑
上千房间，换来的好处是**全局无锁、状态一致、定时器有序**。真要横向扩，按 `roomID % N`
拆成 N 个 room actor 即可，`Room` 本身没有跨房间状态。

### 定时器怎么对齐 setTimeout

旧版 `clearTimeout(turnTimer)` 的语义用**令牌**复刻：每次排定定时器时 `tokens[kind]++`，
`time.AfterFunc` 闭包捕获当时的令牌；回调只投递 `{kind, token}` 到 actor，
`Room.FireTimer` 比对令牌，过期直接丢弃。等于「排新的自动作废旧的回调」，且回调一定跑在
actor goroutine 上，不会和出牌逻辑并发。

## 三、协议

沿用 cherry **simple** 协议，JSON 字段与旧版完全一致，只在外面加 8 字节头：

```
+--------+--------+------------------+
| mid 4B | len 4B | JSON body (len)  |
+--------+--------+------------------+
```

| 方向 | mid | 名称 | body |
|---|---|---|---|
| C→S | 1 | join | `{room, name, create, uid}` |
| C→S | 2 | start | `{}` |
| C→S | 3 | addBot | `{}` |
| C→S | 4 | removeBot | `{seat}` |
| C→S | 5 | play | `{cards:[...]}` |
| C→S | 6 | pass | `{}` |
| C→S | 7 | leave | `{}` |
| C→S | 8 | ping | `{}` |
| C→S | 9 | ready | `{ready}` |
| S→C | 100 | joined | `{room, seat, name, host}` |
| S→C | 101 | sync | 全量状态 + 私有手牌（见下） |
| S→C | 102 | settle | `{winnerTeam, upLevel, doubleDown, resisted, ranks, levels, tributes, outs}` |
| S→C | 103 | error | `{msg}` |
| S→C | 104 | pong | `{ts}` |
| S→C | 105 | hello | `{ts}` |
| S→C | 106 | left | `{}` |

`sync` 字段：`room / status / round / step / currentSeat / lastPlaySeat / lastPattern /
level / levels / seats[] / hostSeat / outs[] / hand[] / tips[] / turnLeft`。

> `turnLeft` 是本次新增（当前回合剩余秒数，0 表示不限），旧字段一个没动，
> 所以前端 GameScene 的 `applySync` 不需要改。

## 四、前端改动

只有 `src/game/net.js`：

- 发：`{t:'play'}` → `mid = MID[t]` → 打 8 字节头 → `send(ArrayBuffer)`
- 收：`binaryType='arraybuffer'` → 拆头 → `JSON.parse` → 补 `t` 字段 → 原样 `emit`
- 兼容旧服务端：收到文本帧时退化为纯 JSON 解析
- 新增 `localUid()`：localStorage 持久化 uid，用于**断线重连认人**和**战绩归属**
- `guandan.vue` 新增 `?ws=` 参数，可显式指定后端地址（前后端分开部署 / 本地联调）

## 五、行为对齐清单

| 行为 | 旧 Node | 新 Go | 验证 |
|---|---|---|---|
| 建房 vs 进房（`create` 标志） | 房号不存在明确报错，不顺手建房 | 同 | 双客户端测试 |
| 默认空位、不自动补机器人 | 是 | 是 | E2E |
| 房主权限（开始/加电脑/移电脑） | 是 | 是 | 双客户端测试 |
| 4 真人坐满 800ms 自动开局 | 是 | 是 | 代码对齐 |
| 单回合 30s 超时托管 | 是 | 是 | 可用 `GD_TURN_MS` 加速验证 |
| 断线 60s 保留座位、局中立刻托管 | 是 | 是 | 双客户端重连测试 |
| 结算 6s 后自动下一局 | 是 | 是 | E2E 第二局 |
| 掉线真人清位、房主加的电脑保留 | 是 | 是 | 代码对齐 |
| 洗牌序列 | xorshift32 | 同（含 JS 算术右移语义） | 8 seed × 3 局对拍 |
| 牌型/提示/升级/进贡 | JS 引擎 | Go 移植 | 4000 + 400 + 24 局对拍 |

### 顺带修掉的一个旧 bug

旧版 `findPlayer` 判断重连时排除了 `p.bot`，而掉线托管的真人恰好被置为 `bot=true`，
导致**局中掉线的人刷新页面回不来**（会收到「牌局已开始」）。
Go 版给座位加了 `Human` 标记（真人入座恒为 true，托管只改 `Bot`），重连按 `Human` 认人。

## 六、部署

```bash
# 本机交叉/静态编译
CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o guandan-server .

# 服务器
mkdir -p /www/wwwroot/guandan-server-go/etc/profile
scp guandan-server        root@host:/www/wwwroot/guandan-server-go/
scp etc/profile/prod.json root@host:/www/wwwroot/guandan-server-go/etc/profile/
```

`/etc/systemd/system/guandan-go.service`：

```ini
[Unit]
Description=Guandan WebSocket Server (Go + cherry)
After=network.target

[Service]
Type=simple
WorkingDirectory=/www/wwwroot/guandan-server-go
Environment=GD_PROFILE=etc/profile/prod.json
Environment=GD_NODE=guandan-1
EnvironmentFile=-/www/wwwroot/guandan-server-go/etc/mysql.env
ExecStart=/www/wwwroot/guandan-server-go/guandan-server
Restart=always
RestartSec=3
LimitNOFILE=65535
StandardOutput=append:/root/zbcx/logs/guandan-go.log
StandardError=append:/root/zbcx/logs/guandan-go.log

[Install]
WantedBy=multi-user.target
```

`etc/mysql.env`（可选，不配则降级为内存模式）：

```
GD_MYSQL_DSN=guandan:密码@tcp(127.0.0.1:3306)/guandan?charset=utf8mb4&parseTime=True&loc=Local
```

Nginx 不用改，沿用旧的反代：

```nginx
location ^~ /guandan/ws {
    proxy_pass http://127.0.0.1:9102/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
}
```

## 七、MySQL 表

```sql
CREATE TABLE gd_round (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  room_id varchar(16), round_no int, winner_team int, up_level int,
  double_down tinyint(1), resisted tinyint(1),
  levels varchar(32), ranks varchar(32), players varchar(128), humans int,
  started_at datetime, ended_at datetime, created_at datetime,
  KEY idx_gd_round_room_id (room_id), KEY idx_gd_round_created_at (created_at)
);

CREATE TABLE gd_player (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  uid varchar(64) UNIQUE, name varchar(32),
  rounds int, wins int, losses int, score int,
  last_at datetime, create_at datetime, update_at datetime
);
```

建库：

```sql
CREATE DATABASE guandan DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE USER 'guandan'@'%' IDENTIFIED BY '<密码>';
GRANT ALL PRIVILEGES ON guandan.* TO 'guandan'@'%';
```

## 八、验证记录

| 项 | 结果 |
|---|---|
| 规则对拍 parse | 4000 / 4000 一致 |
| 规则对拍 hint | 400 / 400 一致（数量、顺序、牌面） |
| 整局对拍 | 8 seed × 3 局：名次/升级/双下/抗贡/进贡全一致 |
| 服务端对局冒烟 | 建房 → 加 3 电脑 → 两局到结算，0 异常 |
| 双客户端 | A 建房 / B 输房号进房 / 非房主被拒 / 断线重连回原座位 |
| 前端 E2E（本地） | 0 JS 错误，第二局三个按钮可见 |
| 线上 E2E | `https://<host>/guandan/` 建房 → 打两局，0 JS 错误、0 失败请求 |
| MySQL | 落库 `gd_round` / `gd_player` 正确，中文正常 |

截图见 `docs/verify/v6-*.png`。

## 九、后续扩展点

- **分片**：`RoomActor` 按 `roomID % N` 拆多个 actor（路由层是唯一改动点）
- **集群**：profile 换成 `cherry.Cluster` + nats/etcd discovery，房间 actor 可按房间号固定到某节点
- **排行榜**：`/top` 已有基础，前端加一个榜页面即可
- **重放/复盘**：`gd_round` 补一列 `seed`，配合确定性 RNG 可整局复现
- **微信分享**：仍是域名 + 证书问题（见 `03-联机与微信接入方案.md`），与服务端语言无关
