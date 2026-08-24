// totoro-pet 宿主半边 —— 养成引擎 + 回环路由
// 零构建决策：纯 ESM，仅使用 node: 内置模块，零第三方依赖。
// 契约唯一权威来源：docs/API.md（宿主半边与浏览器半边各自内联同一份常量，改动须同步三处）。
// 持久化路径：$DSH_HOME/storages/totoro-pet/state.json（无 DSH_HOME 时回退 ~/.dsh/storages/totoro-pet/state.json）。

import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import fs from 'node:fs';

export const name = 'totoro-pet';
export const inject = ['webServer'];

/** 请求体上限：64 KB（65536 字节），超出返回 413。 */
const MAX_BODY_BYTES = 64 * 1024;
/** 仅回环可达。 */
const LOOPBACK_ADDRS = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1']);
const MS_PER_HOUR = 3600000;

/** 衰减速率（每小时）；睡眠中 hunger/mood 减速减半（×0.5）。 */
const DECAY_PER_HOUR = {
  hunger: 0.8,
  mood: 0.5,
  energyAwake: -1.5,
  energySleep: 12,
};

/** 配置默认值（以 docs/API.md「配置」表为准）。 */
const CONFIG_DEFAULTS = { enabled: true, scale: 1, opacity: 1, autoHideMinutes: 0 };
/** 配置校验规则：返回 true 表示合法。 */
const CONFIG_RULES = {
  enabled: (v) => typeof v === 'boolean',
  scale: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0.5 && v <= 2,
  opacity: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0.3 && v <= 1,
  autoHideMinutes: (v) => typeof v === 'number' && Number.isInteger(v) && v >= 0,
};

const INTERACT_TYPES = new Set(['feed', 'pet', 'play', 'sleep', 'wake']);
const PET_COOLDOWN_MS = 10000;
const RECENT_EVENTS_MAX = 20;
const PLAY_MIN_ENERGY = 15;

/** 龙猫口吻台词库：每次 interact 随机取一条作为 message。 */
const LINES = {
  feed: [
    '唔——橡果！最爱的橡果！（抱住啃）',
    '谢谢投喂～毛球消化中……',
    '咔嚓咔嚓……还想再来一颗嘛？',
    '肚子咕咕叫被你发现啦，开动！',
    '这个味道……是幸福的味道！',
    '嚼嚼嚼……耳朵都开心得竖起来了。',
    '投喂成功！好感度悄悄上涨中。',
    '呜哇，是限量版榛子吗？！',
    '吃饱饱，打了个小小的饱嗝~',
  ],
  pet: [
    '唔嘿嘿……再摸一下也可以哦。',
    '绒毛充电中……幸福值上涨！',
    '（眯眼）那里那里……对，就是那里。',
    '摸摸头就会有好运气哦，传说。',
    '呼噜呼噜——这是满足的声音。',
    '手好暖和……不许停下来喵。',
    '被摸头的话，尾巴会不老实。',
    '今天的绒毛手感也是满分吧？',
    '再摸就要融化成一团毛毯啦~',
  ],
  play: [
    '冲呀——！接住那颗橡果！',
    '转圈圈转圈圈……有点晕，但好开心！',
    '赢啦！奖品是一个拥抱（扑）。',
    '运动完心情超好，再来一局？',
    '呼……玩累了，但是超级开心。',
    '看我的必杀·灰尘大作战！',
    '追尾巴追尾巴……咦，怎么抓不到！',
    '今天也是活力满满的一天！',
    '嘿嘿，陪你玩是最开心的事啦。',
  ],
  sleep: [
    '呼啊……眼皮好重……晚安……zzZ',
    '要盖好树叶被子哦……呼噜……',
    '梦里有吃不完的橡果……zzZ',
    '灯关了嘛？那就睡了哦……呼……',
    'zzZ……（尾巴尖还轻轻动着）',
    '呼……呼……别偷看我睡觉啦……',
    '困了困了，能量正在慢慢回充……',
    '晚安，明天也要一起玩哦……zzZ',
    '（缩成一团毛球）睡着了……大概。',
  ],
  wake: [
    '唔哇！早上好！毛都翘起来啦。',
    '睡饱啦！今天也精神满满！',
    '（伸懒腰）唔……再赖五分钟……骗你的，起！',
    '哈欠——梦到的大橡果还没吃完呢。',
    '醒啦醒啦！肚子好像又空了？',
    '揉揉眼睛……世界，启动！',
    '睡了一觉，感觉能跑十圈！',
    '早安！绒毛蓬松度恢复 100%。',
    '呼啊……是谁把我叫醒的呀~',
  ],
};
const pickLine = (arr) => arr[Math.floor(Math.random() * arr.length)];

const clamp01 = (v) => Math.max(0, Math.min(100, v));
const numOr = (v, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

function defaultState(now = Date.now()) {
  return {
    hunger: 80, mood: 80, energy: 100, exp: 0, level: 1,
    sleeping: false, lastTick: now, lastPetAt: 0, recentEvents: [],
  };
}

/** 容错化外部读入的 state：坏值回落默认，数值 clamp。 */
function normalizeState(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const d = defaultState();
  return {
    hunger: clamp01(numOr(s.hunger, d.hunger)),
    mood: clamp01(numOr(s.mood, d.mood)),
    energy: clamp01(numOr(s.energy, d.energy)),
    exp: Math.max(0, numOr(s.exp, d.exp)),
    level: d.level,
    sleeping: !!s.sleeping,
    lastTick: numOr(s.lastTick, d.lastTick),
    lastPetAt: numOr(s.lastPetAt, 0),
    recentEvents: Array.isArray(s.recentEvents)
      ? s.recentEvents
          .filter((e) => e && typeof e === 'object' && typeof e.type === 'string')
          .slice(0, RECENT_EVENTS_MAX)
      : [],
  };
}

function normalizeConfig(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const out = { ...CONFIG_DEFAULTS };
  if (CONFIG_RULES.enabled(c.enabled)) out.enabled = c.enabled;
  if (CONFIG_RULES.scale(c.scale)) out.scale = c.scale;
  if (CONFIG_RULES.opacity(c.opacity)) out.opacity = c.opacity;
  if (CONFIG_RULES.autoHideMinutes(c.autoHideMinutes)) out.autoHideMinutes = c.autoHideMinutes;
  return out;
}

/** 持久化路径：DSH_HOME 优先，缺省回退 ~/.dsh。 */
function statePath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh');
  return join(home, 'storages', 'totoro-pet', 'state.json');
}

/**
 * 内存缓存 + 文件落盘的存储。
 * 读异常一律降级为默认值继续服务（绝不抛错打崩宿主）；
 * 写采用 tmp + rename 原子替换。
 */
function createStore() {
  let cache = null; // { state, config }
  return {
    load() {
      if (cache) return cache;
      let state = null;
      let config = null;
      try {
        const parsed = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
        if (parsed && typeof parsed.state === 'object') state = normalizeState(parsed.state);
        if (parsed && typeof parsed.config === 'object') config = normalizeConfig(parsed.config);
      } catch {
        /* 文件缺失或损坏 → 使用默认值 */
      }
      cache = { state: state || defaultState(), config: config || { ...CONFIG_DEFAULTS } };
      return cache;
    },
    save() {
      if (!cache) return;
      try {
        const file = statePath();
        fs.mkdirSync(dirname(file), { recursive: true });
        const tmp = file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
        fs.renameSync(tmp, file);
      } catch (e) {
        console.warn('[totoro-pet] persist failed:', e && e.message);
      }
    },
  };
}

/** 惰性衰减结算：按 elapsedHours 线性结算一次，clamp 后推进 lastTick。返回是否有变化。 */
function settle(st, now = Date.now()) {
  const hours = (now - st.lastTick) / MS_PER_HOUR;
  if (!(hours > 0)) return false;
  const slow = st.sleeping ? 0.5 : 1; // 睡眠中 hunger/mood 减速减半
  st.hunger = clamp01(st.hunger - DECAY_PER_HOUR.hunger * slow * hours);
  st.mood = clamp01(st.mood - DECAY_PER_HOUR.mood * slow * hours);
  st.energy = clamp01(st.energy + (st.sleeping ? DECAY_PER_HOUR.energySleep : DECAY_PER_HOUR.energyAwake) * hours);
  st.lastTick = now;
  return true;
}

function deriveLevel(st) {
  st.level = Math.floor(st.exp / 50) + 1;
}

function pushEvent(st, type, message, now = Date.now()) {
  st.recentEvents.unshift({ ts: now, type, message });
  if (st.recentEvents.length > RECENT_EVENTS_MAX) st.recentEvents.length = RECENT_EVENTS_MAX;
}

/** 对外暴露的 state 视图：隐藏内部字段 lastPetAt。 */
function pubState(st) {
  return {
    hunger: st.hunger, mood: st.mood, energy: st.energy,
    exp: st.exp, level: st.level, sleeping: st.sleeping,
    lastTick: st.lastTick, recentEvents: st.recentEvents,
  };
}

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

/**
 * 统一围栏：回环校验 → 方法白名单 → （POST 时）读体限长 + JSON 解析 → 业务执行 → 异常兜底。
 * 每条注册路径一个 fence，方法在 fence 内部分发，避免同路径重复注册互相覆盖。
 */
function fence(routes) {
  return function handler(req, res) {
    try {
      const addr = req.socket && req.socket.remoteAddress;
      if (!addr || !LOOPBACK_ADDRS.has(addr)) return json(res, 403, { ok: false, error: 'forbidden' });
      const method = String(req.method || 'GET').toUpperCase();
      const route = routes.find((r) => r.method === method);
      if (!route) return json(res, 405, { ok: false, error: 'method-not-allowed' });
      if (!route.needsBody) return run(res, route.biz, null);

      let size = 0;
      const chunks = [];
      let aborted = false;
      req.on('data', (c) => {
        if (aborted) return;
        size += c.length;
        if (size > MAX_BODY_BYTES) {
          aborted = true;
          chunks.length = 0;
          json(res, 413, { ok: false, error: 'payload-too-large' });
          if (typeof req.destroy === 'function') req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => {
        if (aborted) return;
        let body = null;
        const text = Buffer.concat(chunks).toString('utf8');
        if (text.length > 0) {
          try {
            body = JSON.parse(text);
          } catch {
            return json(res, 400, { ok: false, error: 'invalid-json' });
          }
        }
        if (body === null || typeof body !== 'object' || Array.isArray(body)) {
          return json(res, 400, { ok: false, error: 'invalid-body' });
        }
        run(res, route.biz, body);
      });
      req.on('error', () => { /* 连接中断：无需响应 */ });
    } catch (e) {
      console.error('[totoro-pet] fence error:', e && e.stack || e);
      json(res, 500, { ok: false, error: 'internal-error' });
    }
  };
}

function run(res, biz, body) {
  try {
    const out = biz(body);
    json(res, out.status, out.payload);
  } catch (e) {
    console.error('[totoro-pet] internal error:', e && e.stack || e);
    json(res, 500, { ok: false, error: 'internal-error' });
  }
}

/** 插件入口：注册 4 条 exact 路由（5 个逻辑端点，config 一径两法）。 */
export function apply(ctx) {
  if (!ctx || !ctx.webServer || typeof ctx.webServer.register !== 'function') {
    throw new Error('[totoro-pet] webServer service missing');
  }
  const register = ctx.webServer.register.bind(ctx.webServer);
  const store = createStore();

  // ---- GET /api/totoro-pet/state ----
  const getState = () => {
    const { state } = store.load();
    if (settle(state)) store.save();
    deriveLevel(state);
    return { status: 200, payload: { ok: true, state: pubState(state) } };
  };

  // ---- POST /api/totoro-pet/interact ----
  const postInteract = (body) => {
    const type = body && body.type;
    if (typeof type !== 'string' || !INTERACT_TYPES.has(type)) {
      return { status: 400, payload: { ok: false, error: 'unknown-type' } };
    }
    const now = Date.now();
    const { state } = store.load();
    settle(state, now);
    let message = '';
    let effective = true;

    switch (type) {
      case 'feed':
        state.hunger = clamp01(state.hunger + 30);
        state.exp += 5;
        message = pickLine(LINES.feed);
        break;
      case 'pet': {
        if (now - (state.lastPetAt || 0) < PET_COOLDOWN_MS) {
          return { status: 400, payload: { ok: false, error: 'pet cooldown' } };
        }
        state.lastPetAt = now;
        state.mood = clamp01(state.mood + 10);
        state.exp += 2;
        message = pickLine(LINES.pet);
        break;
      }
      case 'play':
        if (state.energy < PLAY_MIN_ENERGY) {
          return { status: 400, payload: { ok: false, error: 'too-tired' } };
        }
        state.energy = clamp01(state.energy - 15);
        state.mood = clamp01(state.mood + 15);
        state.exp += 8;
        message = pickLine(LINES.play);
        break;
      case 'sleep':
        if (state.sleeping) { effective = false; message = '呼噜呼噜……已经睡着啦。'; }
        else { state.sleeping = true; message = pickLine(LINES.sleep); }
        break;
      case 'wake':
        if (!state.sleeping) { effective = false; message = '还醒着呢，不用叫~'; }
        else { state.sleeping = false; message = pickLine(LINES.wake); }
        break;
      default:
        return { status: 400, payload: { ok: false, error: 'unknown-type' } };
    }

    if (effective) pushEvent(state, type, message, now);
    deriveLevel(state);
    store.save();
    return { status: 200, payload: { ok: true, state: pubState(state), message } };
  };

  // ---- GET /api/totoro-pet/config ----
  const getConfig = () => {
    const { config } = store.load();
    return { status: 200, payload: { ok: true, config: { ...config } } };
  };

  // ---- POST /api/totoro-pet/config（部分更新）----
  const postConfig = (body) => {
    for (const k of Object.keys(body)) {
      if (!(k in CONFIG_DEFAULTS)) {
        return { status: 400, payload: { ok: false, error: 'invalid-config-key:' + k } };
      }
      if (!CONFIG_RULES[k](body[k])) {
        return { status: 400, payload: { ok: false, error: 'invalid-config:' + k } };
      }
    }
    const { config } = store.load();
    Object.assign(config, body);
    store.save();
    return { status: 200, payload: { ok: true, config: { ...config } } };
  };

  // ---- POST /api/totoro-pet/reset（state 就地归零，config 不动）----
  const postReset = () => {
    const data = store.load();
    Object.assign(data.state, defaultState(Date.now()));
    store.save();
    return { status: 200, payload: { ok: true, state: pubState(data.state) } };
  };

  register({ kind: 'exact', path: '/api/totoro-pet/state', handler: fence([{ method: 'GET', biz: getState }]) });
  register({ kind: 'exact', path: '/api/totoro-pet/interact', handler: fence([{ method: 'POST', needsBody: true, biz: postInteract }]) });
  register({
    kind: 'exact',
    path: '/api/totoro-pet/config',
    handler: fence([
      { method: 'GET', biz: getConfig },
      { method: 'POST', needsBody: true, biz: postConfig },
    ]),
  });
  register({ kind: 'exact', path: '/api/totoro-pet/reset', handler: fence([{ method: 'POST', biz: postReset }]) });
}
