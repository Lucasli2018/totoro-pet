# totoro-pet · DSH Web GUI 桌宠插件
[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/your-owner/your-plugin-slug)
DSH Web GUI 桌宠插件（悬浮 Q 版龙猫 · 喂食/抚摸/玩耍/睡觉互动养成）。
> 一只栖居在回环端口里的 Q 版龙猫「绒绒」：白天帮你盯日志、踩构建，夜里蜷成毛球给 CPU 取暖。

totoro-pet 是一个 [DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh) Web GUI 悬浮桌宠插件：SVG 手绘 Q 版龙猫常驻页面右下角，支持喂食、抚摸、玩耍、睡觉四种互动养成（饱食/心情/精力三维状态 + 经验等级），拖拽换位、外观自定义、图鉴鉴赏一应俱全。零构建纯 JS 双半边架构（宿主 ESM + 浏览器 ModuleLoader factory），安装即用。

📖 完整教程：[docs/使用手册.md](./docs/使用手册.md) ｜ API 契约：[docs/API.md](./docs/API.md)

## ✨ 特性亮点

- **四姿态 SVG 动画**：待机呼吸眨眼、开心跳跃、睡觉 Zzz 上浮、进食咀嚼，切换不跳形
- **四种互动**：🍎 喂食 / ✋ 抚摸 / 🎾 玩耍 / 💤 睡觉·唤醒，各有数值收益与小脾气（冷却、体力门槛）
- **养成系统**：饱食/心情/精力随时间线性衰减（睡眠减半、精力回充），经验升级 `level = floor(exp/50)+1`
- **龙猫台词库**：五类口吻台词各 9 条随机回复；断网时无缝降级为本地台词
- **个性化**：拖拽换位记忆、大小 0.5×–2.0×、不透明度 30%–100%、闲置自动隐藏、一键停用（缩成小圆点）
- **图鉴弹卡**：四姿态触发条件一览 + 龙猫小传
- **安全边界**：HTTP API 仅回环 127.0.0.1 可达，请求体 64KB 上限，统一错误码
- **可靠持久化**：状态落盘 tmp+rename 原子写，坏档自动降级默认值继续服务
- **零构建**：浏览器半边单文件内嵌全部 SVG/CSS，无打包器、无第三方运行时依赖；宿主冒烟 18 项全绿

## 📦 安装（npm 包）

前置要求：Node.js ≥ 18，能正常访问 npm 仓库（国内可换镜像源），且能正常运行 `dsh web`（GUI 地址 http://127.0.0.1:3080）。totoro-pet 已发布到 npm 公开仓库，直接用包名即可安装：

```powershell
dsh plugin --profile web add totoro-pet
```

该命令会从 npm 拉取最新版 `totoro-pet` 并写入 web profile。然后重启 dsh web，刷新 http://127.0.0.1:3080 —— 页面右下角出现龙猫即安装成功。分步详解见[《使用手册》第二章](docs/使用手册.md#第二章-安装与启用)。

> 装指定版本：`dsh plugin --profile web add totoro-pet@0.1.2`；升级到最新版：先 `remove` 再 `add`，或视 dsh 版本使用 `update` 子命令。

## 🚀 快速上手三步

1. **装好插件并重启** dsh web，右下角找到龙猫「绒绒」；
2. **鼠标悬停**在它身上，浮现交互条（喂食/抚摸/玩耍/睡觉/图鉴/设置）；
3. **点按钮互动**：气泡冒出台词，顶部状态条实时反映三维数值与等级；按住本体可拖到屏幕任意角落。

## 🎮 玩法速览

| 动作 | 数值效果 | 经验 | 限制 |
|---|---|---|---|
| 🍎 喂食 feed | 饱食 +30 | +5 | 无 |
| ✋ 抚摸 pet | 心情 +10 | +2 | 冷却 10 秒 |
| 🎾 玩耍 play | 精力 −15、心情 +15 | +8 | 结算后精力 <15 拒绝 |
| 💤 睡觉 sleep | 入睡：精力 +12/时回充 | — | 幂等，重复无副作用 |
| ☀️ 唤醒 wake | 结束睡眠 | — | 幂等 |
| 👆 点击本体 | 扭一扭 + 闲聊一句 | — | — |

自然衰减（每小时）：清醒 饱食 −0.8 / 心情 −0.5 / 精力 −1.5；睡眠 减半 / 减半 / 精力 +12。关掉页面也在衰减哦。完整规则见《使用手册》第四章。

## 🔌 HTTP API 简表

Base URL：`http://127.0.0.1:3080/api/totoro-pet`（仅回环可达）。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/state` | 查询状态（先结算衰减） |
| POST | `/interact` | 交互 `{"type":"feed\|pet\|play\|sleep\|wake"}` |
| GET / POST | `/config` | 读取 / 部分更新配置 |
| POST | `/reset` | 状态归零（配置不动） |

统一包裹 `{ok:true,...}` / `{ok:false,error:"..."}`。权威契约与字段级细节见 [docs/API.md](docs/API.md)，curl 示例见《使用手册》第七章。

## 📁 目录结构

```
totoro-pet/
├── package.json          # 插件清单（双入口 exports + dsh 字段）
├── cordis.patch.yml      # 宿主服务注册补丁
├── README.md             # 英文占位指引（本文档的转发）
├── README.zh.md          # 本文档
├── docs/
│   ├── 使用手册.md        # ⭐ 面向终端用户的完整教程（九章 + FAQ）
│   ├── API.md            # 宿主 ↔ 浏览器 API 权威契约
│   └── REVIEW.md         # 集成验证审查报告（t5）
├── lib/
│   ├── index.js          # 宿主半边：养成引擎 + 回环路由（仅 node: 内置模块）
│   └── client.js         # 浏览器半边：悬浮桌宠 UI（单文件零构建，SVG/CSS 内嵌）
├── assets/
│   ├── svg/              # 四姿态 SVG 源稿 + pet.css + MANIFEST.md（内嵌前资产）
│   └── photos/           # 龙猫原型参考图
└── scripts/
    └── smoke-host.mjs    # 宿主半边冒烟测试（18 项断言）
```

npm 包内含 `lib`、`docs`、`cordis.patch.yml` 与 README（`assets`/`scripts` 仅存在于源仓库）。

## 📚 更多文档

- [docs/使用手册.md](docs/使用手册.md) —— 从安装到卸载的完整教程、数值详解、故障排查与 FAQ
- [docs/API.md](docs/API.md) —— 接口字段级契约（改数值须三处同步的第一权威）
- [docs/REVIEW.md](docs/REVIEW.md) —— 形态/契约/安全/功能四类核验记录

## 🔄 卸载 vs 停用（无需重启 dsh）

- **卸载** `dsh plugin --profile web remove totoro-pet`：本质是在 web profile 执行 `pnpm remove`，只改磁盘上的 `package.json` / lockfile。运行中的 dsh 服务进程在启动时已把插件 bundle 清单读进内存，**刷新页面不会重新读盘**，需**彻底退出并重启 dsh** 才能清掉残留引用。
- **停用（推荐，HMR 即时生效）**：不改磁盘卸载，而是在你的 web profile 补丁层 `cordis.patch.yml` 末尾追加：

  ```yaml
  - id: totoro-pet
    disabled: true
  ```

  保存后约 1 秒 dsh 自动重新组装（HMR），刷新页面即生效，**无需重启 dsh 服务**。

## 🔥 热加载开发（HMR，改源码即时生效）

DSH 的客户端模块层（`@deepseek-ai/dsh-client-modules` + `@deepseek-ai/dsh-client-hmr`）**原生支持插件 `client.js` 的热替换**：服务端以一个定时器轮询每个插件的 `lib/client.js` 文件，内容变化即重算版本号（基于文件内容的 sha1），通过 SSE 通道（`/plugins/events`）广播 `rebuilt` 帧；浏览器收到后用「失效 → 预取新包 → 重挂载」的 fiber swap 流程就地替换该插件，**无需重启 dsh、也无需手动刷新页面**。

> 前提：DSH 读到的是**你的源码文件本身**，而非 npm 安装到 `node_modules` 的**副本**。普通 `dsh plugin --profile web add totoro-pet`（从 npm 安装）装的是副本，改源码不会触发热加载；必须用 **`link:` 软链**安装源码目录。

**一步启用热加载**（在插件根目录执行）：

```powershell
npm run link      # = dsh plugin --profile web add link:.
```

> ⚠️ 首次 `npm run link` 后，**请彻底退出并重启 dsh 一次**：客户端模块层（client-modules）在 dsh 启动时扫描 `node_modules` 把本插件纳入运行态，并建立 HMR 轮询基线。这一步仅在「新增 / 移除插件」时需要；之后改源码都走 HMR，不再重启。

- `link:` 安装会在 web profile 的 `node_modules/totoro-pet` 下创建一个 **junction（Windows 软链）**指向本仓库源码；DSH 的 HMR 轮询会跟随软链检测 `lib/client.js` 的变化。
- 重启后，在 `lib/client.js` 里修改 SVG、交互逻辑、样式字符串等，**保存后约 1 秒内桌面宠物自动热替换**，不再需要重新打包、重新安装或重启 dsh。
- 本插件的 `apply()` 已确保幂等：直接 `ctx.slots.inject(...)` 注册悬浮层、随插件 `ctx` 自动清理（**未**把注册包进 `ctx.effect` 且不返回 disposer），因此 HMR 重挂载不会残留旧注册。

**退出热加载开发**（解除软链，恢复普通安装）：

```powershell
npm run unlink    # = dsh plugin --profile web remove totoro-pet
```

之后可按需改用 `dsh plugin --profile web add totoro-pet`（npm 包）或市场安装。

> 注意：`link:` 仅用于本地开发。发布到市场的插件仍走 tgz / 仓库源，用户侧由 dsh-market 正常收录，无需软链。

## 🌐 提交到 dsh 插件市场

1. Fork [`awesome-dsh-plugin/awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，在 `data/plugins/` 新增 `Lucasli2018__totoro-pet.yml`：

   ```yaml
   url: https://github.com/Lucasli2018/totoro-pet
   name: Lucasli2018/totoro-pet
   category: fun
   description:
     en: A desktop pet that lives in a floating overlay; click it to interact and switch between idle, sleeping, happy, and eating states.
     zh: '桌面宠物插件，常驻悬浮层养一只龙猫，点击互动并可在待机、睡觉、开心、进食等状态间切换。'
   ```

2. PR 门禁（pr-gate）硬性要求：仓库含 `dsh.bundle`（已满足）、创建 ≥1 天、提交数 ≥10、加 `dsh-plugin` topic。
3. 合并后约一天内 dsh-market 自动收录；在此之前本地调试可直接用 npm 包安装 `dsh plugin --profile web add totoro-pet`。

## License

[MIT](https://opensource.org/licenses/MIT) © totoro-pet team
