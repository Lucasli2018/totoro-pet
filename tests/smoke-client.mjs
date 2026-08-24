// 客户端半边冒烟测试
// 验证：悬浮桌宠 UI 正确挂载到 shell.overlay，且宠物舞台「直接渲染」当前姿态 SVG
// （对应修复：从隐藏/禁用态恢复后宠物不显示 —— 之前依赖 pose 变化的 useEffect 写 innerHTML，
//  恢复时 pose 不变导致 effect 不触发、舞台为空。修复后改为 dangerouslySetInnerHTML 同步注入。）
import { readFileSync } from 'node:fs';

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log('  \u2713', msg);
  else { console.error('  \u2717', msg); failures++; }
}

// 1) mock window + ModuleLoader（client.js 是 IIFE，依赖 window.__ModuleLoader__.load）
const w = {
  __ModuleLoader__: {
    load(spec) {
      const require = (name) => {
        if (name === 'react') {
          return {
            createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
            useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
            useRef: (init) => ({ current: init }),
            useEffect: () => {},
            useMemo: (fn) => fn(),
          };
        }
        throw new Error('unknown require ' + name);
      };
      this._exports = spec.factory(require);
    },
  },
  localStorage: { getItem: () => null, setItem: () => {} },
  setTimeout, clearTimeout, setInterval, clearInterval,
  addEventListener() {}, removeEventListener() {},
};
globalThis.window = w;
globalThis.document = {
  addEventListener() {}, removeEventListener() {}, visibilityState: 'visible',
  querySelector: () => null, body: {},
};
globalThis.localStorage = w.localStorage;

const src = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
new Function(src)();

const exp = w.__ModuleLoader__._exports;
assert(exp && typeof exp.apply === 'function', '导出 apply 函数存在');

// 2) mock ctx，捕获 register 并渲染组件
function findStage(node) {
  if (!node || !node.props) return null;
  if (node.props.className === 'totoro-pet-stage') return node;
  for (const c of node.children || []) {
    const f = findStage(c);
    if (f) return f;
  }
  return null;
}

const ctx = {
  slots: {
    inject(slotName, provider) {
      assert(slotName === 'shell.overlay', 'overlay 注册到 shell.overlay');
      return provider();
    },
    register(cfg, Comp) {
      assert(cfg.id === 'totoro-pet', '注册 id 为 totoro-pet');
      const tree = Comp();
      const rootArr = Array.isArray(tree) ? tree : [tree];
      const root = rootArr.find((n) => n.props && n.props.className && n.props.className.includes('totoro-pet'));
      assert(!!root, '宠物根节点存在');
      const stage = root && findStage(root);
      assert(!!stage, '宠物舞台节点(totoro-pet-stage)存在');
      const html = stage && stage.props && stage.props.dangerouslySetInnerHTML
        ? stage.props.dangerouslySetInnerHTML.__html : '';
      assert(html.length > 200, '舞台直接渲染 SVG（修复恢复后不显示），长度=' + html.length);
      return function dispose() {};
    },
  },
  effect() {},
};

exp.apply(ctx);

console.log(failures === 0 ? '\nclient smoke: ALL PASS' : `\nclient smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
