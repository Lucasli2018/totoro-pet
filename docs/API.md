# totoro-pet 宿主 ↔ 浏览器 API 契约

版本：0.1.0（与 package.json 同步）

本文件是 totoro-pet 插件的**唯一权威契约**。插件为双半边架构：

- 宿主半边 `lib/index.js`：ESM，命名导出 `name`/`inject`/`apply(ctx)`，经 `ctx.webServer.register({kind:'exact', path:'/api/totoro-pet/...'})` 注册回环路由，handler 收到 node:http 的 IncomingMessage/ServerResponse。
- 浏览器半边 `lib/client.js`：`window.__ModuleLoader__.load({...})` factory 形态，React 经 `require("react")` 获取，UI 用 `React.createElement`（零构建，不用 JSX），SVG/CSS 以字符串内嵌单文件。

**两边各自内联同一份常量，不共享代码文件。任何数值改动必须同步三处：本文档、宿主实现、浏览器实现。**

## 通用约定

- Base URL：`/api/totoro-pet`，仅回环可达。
- 请求体与响应体均为 JSON，响应头 `Content-Type: application/json; charset=utf-8`。
- 响应统一包裹：成功 `{ok:true,...}`；失败 `{ok:false,error:"<原因>"}`。
- 请求体上限 **64 KB（65536 字节）**，超出返回 413。
- 方法矩阵：

| 路径                         | GET | POST |
| -------------------------- | --- | ---- |
| `/api/totoro-pet/state`    | 200 | 405  |
| `/api/totoro-pet/interact` | 405 | 200  |
| `/api/totoro-pet/config`   | 200 | 200  |
| `/api/totoro-pet/reset`    | 405 | 200  |

其他未知路径返回 404。

## 数据模型 State

```json
{
  "hunger": 80,
  "mood": 80,
  "energy": 100,
  "exp": 0,
  "level": 1,
  "sleeping": false,
  "lastTick": 1755900000000,
  "recentEvents": []
}
```

- `hunger`/`mood`/`energy`：数值，范围 [0,100]，所有增减后 clamp 到该区间。
- `exp`：数值 ≥0，不设上限；`level = Math.floor(exp / 50) + 1`（读取时实时推导）。
- `sleeping`：布尔。
- `lastTick`：epoch 毫秒，上次衰减结算时间。
- `recentEvents`：对象数组 `{ts,type,message}`（epoch 毫秒、交互 type、服务端台词），最新在前，上限 20 条（超出丢弃最旧）。交互成功生效时各追加一条；衰减与幂等命中不追加。
- 内部字段 `lastPetAt`（上次 pet 成功时刻）仅存盘，不出现在任何响应里。
- 初始值即上例（`lastTick`=创建时刻）。

## 衰减模型（读 state 与 interact 前先结算）

`elapsedHours = (now - lastTick) / 3600000`，支持小数，线性结算后 clamp 到 [0,100]，并写回 `lastTick=now`：

| 属性     | 清醒        | 睡眠               |
| ------ | --------- | ---------------- |
| hunger | −0.8 / 小时 | −0.4 / 小时（睡眠减半）  |
| mood   | −0.5 / 小时 | −0.25 / 小时（睡眠减半） |
| energy | −1.5 / 小时 | +12 / 小时         |

衰减不产生 recentEvents、不加 exp、不改变 level。

## 端点定义

### GET /api/totoro-pet/state

先按上述模型结算衰减，再返回。

→ 200 ``{"ok":true,"state":{...}}``

### POST /api/totoro-pet/interact

Body：`{"type":"feed"|"pet"|"play"|"sleep"|"wake"}`。先结算衰减，再应用效果（增益 clamp 到 [0,100]）：

| type  | 效果                      | 规则                           |
| ----- | ----------------------- | ---------------------------- |
| feed  | hunger+30，exp+5         | 无限制                          |
| pet   | mood+10，exp+2           | 冷却 10 秒（距上次 pet 成功 <10s 时拒绝） |
| play  | energy−15，mood+15，exp+8 | 结算后 energy<15 时拒绝，状态不变       |
| sleep | `sleeping=true`         | 幂等；已睡时 ok:true 且无变化          |
| wake  | `sleeping=false`        | 幂等；已醒时 ok:true 且无变化          |

- 未知 type、缺 type、非法 JSON → 400 `{ok:false,error:"..."}`。
- pet 冷却拒绝：400 `{ok:false,error:"pet cooldown"}`。
- 能量不足 play：400 `{ok:false,error:"too-tired"}`。
- 成功的 feed/pet/play/sleep/wake 各追加一条 recentEvents。
- sleep/wake 幂等命中时不追加事件。

→ 200 `{"ok":true,"state":{...},"message":"<人类可读结果描述>"}`

### GET /api/totoro-pet/config

→ 200 `{"ok":true,"config":{"enabled":true,"scale":1,"opacity":1,"autoHideMinutes":0}}`

默认值即上例。字段语义与合法范围：

| 字段              | 类型      | 范围         | 默认   | 说明                   |
| --------------- | ------- | ---------- | ---- | -------------------- |
| enabled         | boolean | true/false | true | 总开关（关闭后浏览器半边隐藏悬浮层）   |
| scale           | number  | 0.5 – 2.0  | 1    | 形象缩放                 |
| opacity         | number  | 0.3 – 1.0  | 1    | 整体不透明度               |
| autoHideMinutes | integer | ≥0         | 0    | 无交互自动隐藏分钟数；0 = 不自动隐藏 |

### POST /api/totoro-pet/config

Body 为部分更新，仅接受上表四键；未提供的键保持原值。类型错误或超出范围 → 400。

→ 200 `{"ok":true,"config":{...}}`

### POST /api/totoro-pet/reset

State 恢复初始值（config 不受影响）。

→ 200 `{"ok":true,"state":{...}}`

## 错误汇总

| 场景                                          | 状态码 | error 示例             |
| ------------------------------------------- | --- | -------------------- |
| 非法 JSON / 缺 type / 未知 type / config 类型或范围非法 | 400 | `invalid request` 等  |
| pet 冷却期内                                    | 400 | `pet cooldown`       |
| 能量不足 play                                   | 400 | `too-tired`          |
| 未知路径                                        | 404 | `not found`          |
| 方法不符（见方法矩阵）                                 | 405 | `method not allowed` |
| 请求体 >64 KB（65536 字节）                        | 413 | `payload too large`  |
| 未捕获异常                                       | 500 | `internal error`     |

## 持久化

宿主半边负责将 state/config 合并落盘到单个 JSON：`$DSH_HOME/storages/totoro-pet/state.json`（无 `DSH_HOME` 时回退 `~/.dsh/storages/totoro-pet/state.json`），写入采用 tmp+rename 原子替换；读异常自动降级为默认值继续服务。浏览器半边不做持久化。重启 dsh web 后状态与配置保留。

## 实现边界提醒（零构建决策）

- 宿主半边仅用 `node:` 内置模块，禁止第三方运行时依赖；禁止 TypeScript/打包器。
- 浏览器半边手写 ModuleLoader factory 形态；挂载失败只 `console.warn`，绝不抛错打崩 GUI。
- 两半边各自内联 DECAY_RATES / INTERACTION_RULES / CONFIG_DEFAULTS 常量，字段名与数值以本文件为准。
