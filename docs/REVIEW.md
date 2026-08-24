# totoro-pet 集成验证审查报告（t5）

审查人：reviewer（totoro-pet 团队质量闸门）
日期：2026-08-23
对象：F:\dsh\totoro-pet @ 版本 0.1.0（t1–t4 交付物集成后终审）
参考件：D:\tools\.dsh\profiles\web\node_modules\ 下的 dsh-dream-skin@0.4.5 与 dsh-skill-hub@0.2.2

## 结论

**通过**。形态、契约、安全、功能四类核验全部完成；发现并修复 3 处问题（见「修复记录」），修复后静态检查与 18 项冒烟全绿，打包回验通过。

## 一、形态比对（逐项对照真实参考件）

| # | 核验项 | 结果 | 说明 |
|---|---|---|---|
| 1a | package.json `type:"module"` + `exports` 双入口 + `dsh` 字段 | ✅ | `."→./lib/index.js`、`./client`→./lib/client.js`、`./package.json` 自映射；`dsh.bundle.patch` 指向 ./cordis.patch.yml，`dsh.client.platform:"web"`——与两参考件同构。参考件的 exports 用 {types,default} 对象形态是因附带 TS 类型；本插件零构建用字符串简写合法且语义一致 |
| 1b | lib/client.js 头部 ModuleLoader factory 形态 | ✅ | `window.__ModuleLoader__.load({id:'totoro-pet',factory:(require)=>{...}})`；factory 内建 `module={exports:{}}` + `Symbol.toStringTag='Module'`，与 dream-skin client.js 头部逐点同形。额外加了 __ModuleLoader__ 缺失守卫（console.warn 后跳过），属防御性增强，不破坏形态 |
| 1b | lib/client.js 尾部导出形状 | ✅ | `exports.inject=['slots']; exports.apply=apply; return module.exports;` 与 dream-skin 尾部 `exports.apply/inject + return module.exports` 同形 |
| 1c | lib/index.js ESM 命名导出 name/inject/apply | ✅ | `export const name='totoro-pet'`、`export const inject=['webServer']`、`export function apply(ctx)`——与 skill-hub 尾部 `export {..., apply, inject, name}` 等价 |
| 1d | cordis.patch.yml 缩进结构 | ✅ | 两层 `- insert:` → `- id/name` 结构与 skill-hub/dream-skin 完全一致；name 为裸标量 totoro-pet（YAML 解析结果与参考件带引号的包名写法相同） |

## 二、静态检查

- `node --check lib/index.js` → OK
- `node --check lib/client.js` → OK
- `node scripts/smoke-host.mjs` → **18/18 全绿**（修复后复跑仍全绿）

## 三、安全审查

| # | 核验项 | 结果 | 说明 |
|---|---|---|---|
| 1 | 回环地址校验 | ✅ | fence 首步校验 socket.remoteAddress ∈ {::1,127.0.0.1,::ffff:127.0.0.1}，否则 403；冒烟含非回环 403 用例 |
| 2 | body 64KB 上限 | ✅ | 流式累计字节数 >65536 即 413 并中止读取；冒烟含 70000 字节 413 用例 |
| 3 | JSON 容错 | ✅ | 解析 try/catch→400 invalid-json；非对象/数组体→400 invalid-body |
| 4 | 无路径拼接注入 | ✅ | 落盘路径仅由 DSH_HOME/固定常量拼出，用户输入不参与任何路径构造；写盘 tmp+rename 原子替换 |
| 5 | 无 eval / 动态代码 | ✅ | grep 扫描 eval(/new Function/child_process：0 命中 |
| 6 | 浏览器侧 XSS | ✅ | innerHTML/dangerouslySetInnerHTML 共 3 处，实参均为**文件内静态字符串**（SVGS[pose]、SVGS[name]、CSS_ALL），无任何服务端数据进入 HTML 通道。**台词气泡**（含服务端 message）走 React createElement 文本子节点=textContent 等价转义渲染；tipText 同理。服务端 recentEvents 未被 UI 渲染 |
| 7 | 定时器/监听器清理 | ✅ | 轮询 interval、visibilitychange/resize/keydown 监听均在 effect cleanup 移除；所有 setTimeout 经 timersRef 统一收集并在卸载时 clearTimeout |

## 四、功能审查（API 契约 vs 实现）

- 方法矩阵（state GET / interact POST / config GET+POST / reset POST，其余 405）与 API.md 一致；每路径一个 fence 内部分发方法，无同路径重复注册。
- 数值边界：hunger/mood/energy 全部 clamp [0,100]（clamp01）；exp ≥0 不设上限；level=floor(exp/50)+1 读取时实时推导。
- 衰减模型：清醒 −0.8/−0.5/−1.5 每小时，睡眠 hunger/mood 减速减半、energy +12/h——与 API.md 表逐值一致；衰减不加事件不加 exp。
- 交互规则：feed+30/+5；pet+10/+2 冷却 10s（error 'pet cooldown'）；play energy<15 拒绝（'too-tired'）成功 −15/+15/+8；sleep/wake 幂等且幂等命中不追加事件——冒烟逐一覆盖。
- config 四键类型/范围校验、未知键 400、部分更新语义与契约一致。
- lastPetAt 仅存盘不出响应（pubState 白名单）；recentEvents 上限 20 条最新在前。
- localStorage 键名 totoro-pet:pos / totoro-pet:config 定义即使用、全文件一致。
- 持久化路径 $DSH_HOME/storages/totoro-pet/state.json（缺省回退 ~/.dsh），坏档降级默认值继续服务。

## 五、修复记录

| # | 文件:位置 | 问题 | 修复 |
|---|---|---|---|
| F1 | lib/client.js RANGE | scaleMin:0.6 与契约 scale 下限 0.5 不符（滑杆无法表达 0.5–0.6 区间） | 改为 scaleMin:0.5 |
| F2 | lib/client.js sanitizeConfig | 本地默认 opacity:0.9 与权威契约/API.md 及宿主默认 opacity:1 不符（三处同步纪律违例） | 改为 opacity:1 |
| F3 | lib/index.js fence 413 分支 | 先 req.destroy() 再写响应：真实 socket 下销毁请求可能连带断开连接导致 413 响应不可达 | 调整为先发 413 响应再 destroy |

## 六、备注（不阻塞的观察项）

- 参考件均声明 react 等 peerDependencies；本插件浏览器半边 require('react') 依赖 shell 模块表内置 React（DSH GUI 本体依赖），未声明 peer。若未来 shell 收紧模块表可见性需补声明。
- 客户端 autoHideMinutes 滑杆上限 480 分钟为 UI 约束；契约允许任意 ≥0 整数，宿主侧不受此限制。
- cordis.patch.yml 的 name 采用裸标量而非参考件的引号风格，解析结果等价。

## 七、打包

- 环境：沙箱内 npm.cmd / npm-cli.js 调用被拒绝（Access denied），按任务预案改用 tar 手动打包，严格按 package.json files 清单（lib、cordis.patch.yml、README.md、docs）+ 自动必含的 package.json 组装，根目录为 package/，符合 npm 包规则。
- 首次打包产物：totoro-pet-0.1.0.tgz，20597 bytes，SHA256 58C6880C61FD63139E80A5F4AC0CF65ACF9938D532CEC170EDE4EBBA39D2688C（早于 t6 定稿文档，已作废）。
- **终版产物（t6 文档定稿后由 captain 重打包）：totoro-pet-0.1.0.tgz，32331 bytes（≈31.6 KB），SHA256 92BE6F7FB1827C95F27A7F5E0B0EF034F20E96B4F23AF429FD8B8DA2EC204BE3**
- 内容清单：package/package.json、package/lib/{index.js,client.js,.gitkeep}、package/cordis.patch.yml、package/README.md、package/docs/{API.md,REVIEW.md,使用手册.md}
- 回验：解包后中文文件名「使用手册.md」完好；解包副本 lib/index.js 与 lib/client.js node --check 双双通过。
