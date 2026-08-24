// totoro-pet 浏览器半边 —— 悬浮桌宠（拖拽 / 交互 / 设置 / 图鉴）
//
// ModuleLoader factory 形态，对照 dsh-dream-skin/lib/client.js 头部：
//   window.__ModuleLoader__.load({ id, factory:(require)=>{ ...CJS 体...; return module.exports; } })
// 零构建决策：React 经 require("react") 获取，UI 用 createElement（不用 JSX）；
// 四姿态 SVG 与 pet.css 全文以字符串内嵌本文件，禁止任何外部资源引用。
// 常量数值与 docs/API.md 同步（改动须三处同步：API.md / lib/index.js / 本文件）。
// 挂载失败只 console.warn，绝不向上抛错打崩 GUI。

(function () {
  'use strict';
  var w = typeof window !== 'undefined' ? window : null;
  if (!w || !w.__ModuleLoader__ || typeof w.__ModuleLoader__.load !== 'function') {
    try { console.warn('[totoro-pet] window.__ModuleLoader__ unavailable; browser half skipped'); } catch (_) {}
    return;
  }

  w.__ModuleLoader__.load({
    id: 'totoro-pet',
    factory: function (require) {
      var module = { exports: {} };
      var exports = module.exports;
      Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

      var React = require('react');
      var el = React.createElement;

      // ==================== 常量（与 docs/API.md 同步） ====================
      var API_BASE = '/api/totoro-pet';
      var LS_POS = 'totoro-pet:pos';
      var LS_CONFIG = 'totoro-pet:config';
      var POLL_MS = 30 * 1000;
      var DRAG_THRESHOLD_PX = 4;
      var BUBBLE_MS = 3000;
      var HAPPY_MS = 1300;
      var EAT_MS = 3000;
      var WIGGLE_MS = 850;
      var AUTOHIDE_TICK_MS = 15 * 1000;
      var RANGE = { scaleMin: 0.5, scaleMax: 2.0, opMin: 0.3, opMax: 1.0, hideMax: 480 };

      // ==================== 视觉资产（t2 内嵌；渐变 id 按姿态加后缀防多实例冲突） ====================
      var SVGS = {};
      SVGS.idle = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\" class=\"totoro-svg totoro-svg--idle\" role=\"img\" aria-label=\"Q版龙猫桌宠·待机\"><defs><linearGradient id=\"tpGradIdle\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#98a1ad\"/><stop offset=\"1\" stop-color=\"#7f8896\"/></linearGradient></defs><path class=\"tp-tail\" d=\"M150 146 Q178 152 172 122 Q168 106 155 111\" fill=\"none\" stroke=\"#7f8896\" stroke-width=\"12\" stroke-linecap=\"round\"/><ellipse class=\"tp-body\" cx=\"100\" cy=\"112\" rx=\"61\" ry=\"57\" fill=\"url(#tpGradIdle)\"/><g class=\"tp-belly\"><ellipse cx=\"100\" cy=\"130\" rx=\"35\" ry=\"27\" fill=\"#f3efe6\"/><path d=\"M84 132 L100 123 L116 132\" fill=\"none\" stroke=\"#c9c2b2\" stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M84 142 L100 133 L116 142\" fill=\"none\" stroke=\"#c9c2b2\" stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M84 152 L100 143 L116 152\" fill=\"none\" stroke=\"#c9c2b2\" stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g><ellipse class=\"tp-foot-l\" cx=\"80\" cy=\"167\" rx=\"14\" ry=\"8\" fill=\"#8a93a0\"/><ellipse class=\"tp-foot-r\" cx=\"120\" cy=\"167\" rx=\"14\" ry=\"8\" fill=\"#8a93a0\"/><g class=\"tp-face\"><g class=\"tp-ear-l\"><ellipse cx=\"70\" cy=\"46\" rx=\"15\" ry=\"19\" transform=\"rotate(-14 70 46)\" fill=\"url(#tpGradIdle)\"/><ellipse cx=\"70\" cy=\"48.5\" rx=\"7.5\" ry=\"10\" transform=\"rotate(-14 70 48.5)\" fill=\"#e8b4b8\"/></g><g class=\"tp-ear-r\"><ellipse cx=\"130\" cy=\"46\" rx=\"15\" ry=\"19\" transform=\"rotate(14 130 46)\" fill=\"url(#tpGradIdle)\"/><ellipse cx=\"130\" cy=\"48.5\" rx=\"7.5\" ry=\"10\" transform=\"rotate(14 130 48.5)\" fill=\"#e8b4b8\"/></g><g class=\"tp-eye-l\"><circle cx=\"77\" cy=\"87\" r=\"6.8\" fill=\"#3a3f47\"/><circle cx=\"74.5\" cy=\"84.5\" r=\"2.1\" fill=\"#ffffff\"/></g><g class=\"tp-eye-r\"><circle cx=\"123\" cy=\"87\" r=\"6.8\" fill=\"#3a3f47\"/><circle cx=\"120.5\" cy=\"84.5\" r=\"2.1\" fill=\"#ffffff\"/></g><ellipse cx=\"100\" cy=\"99\" rx=\"4.5\" ry=\"3.4\" fill=\"#565d68\"/><path d=\"M95 107 Q100 110.5 105 107\" fill=\"none\" stroke=\"#565d68\" stroke-width=\"2\" stroke-linecap=\"round\"/><g class=\"tp-whiskers\" fill=\"none\" stroke=\"#6b7280\" stroke-width=\"1.7\" stroke-linecap=\"round\"><path d=\"M54 92 L30 88\"/><path d=\"M53 99 L28 99\"/><path d=\"M54 106 L30 110\"/><path d=\"M146 92 L170 88\"/><path d=\"M147 99 L172 99\"/><path d=\"M146 106 L170 110\"/></g></g><g class=\"tp-arm-l\"><ellipse cx=\"47\" cy=\"124\" rx=\"10.5\" ry=\"17\" transform=\"rotate(18 47 124)\" fill=\"#8a93a0\"/><circle cx=\"42\" cy=\"139\" r=\"3\" fill=\"#565d68\"/></g><g class=\"tp-arm-r\"><ellipse cx=\"153\" cy=\"124\" rx=\"10.5\" ry=\"17\" transform=\"rotate(-18 153 124)\" fill=\"#8a93a0\"/><circle cx=\"158\" cy=\"139\" r=\"3\" fill=\"#565d68\"/></g></svg>";
      SVGS.happy = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\" class=\"totoro-svg totoro-svg--happy\" role=\"img\" aria-label=\"Q版龙猫桌宠·开心\"><defs><linearGradient id=\"tpGradHappy\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#98a1ad\"/><stop offset=\"1\" stop-color=\"#7f8896\"/></linearGradient></defs><path class=\"tp-tail\" d=\"M150 146 Q178 152 172 122 Q168 106 155 111\" fill=\"none\" stroke=\"#7f8896\" stroke-width=\"12\" stroke-linecap=\"round\"/><ellipse class=\"tp-body\" cx=\"100\" cy=\"112\" rx=\"61\" ry=\"57\" fill=\"url(#tpGradHappy)\"/><g class=\"tp-belly\"><ellipse cx=\"100\" cy=\"130\" rx=\"35\" ry=\"27\" fill=\"#f3efe6\"/><path d=\"M84 132 L100 123 L116 132\" fill=\"none\" stroke=\"#c9c2b2\" stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M84 142 L100 133 L116 142\" fill=\"none\" stroke=\"#c9c2b2\" stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M84 152 L100 143 L116 152\" fill=\"none\" stroke=\"#c9c2b2\" stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g><ellipse class=\"tp-foot-l\" cx=\"80\" cy=\"167\" rx=\"14\" ry=\"8\" fill=\"#8a93a0\"/><ellipse class=\"tp-foot-r\" cx=\"120\" cy=\"167\" rx=\"14\" ry=\"8\" fill=\"#8a93a0\"/><g class=\"tp-face\"><g class=\"tp-ear-l\"><ellipse cx=\"70\" cy=\"46\" rx=\"15\" ry=\"19\" transform=\"rotate(-14 70 46)\" fill=\"url(#tpGradHappy)\"/><ellipse cx=\"70\" cy=\"48.5\" rx=\"7.5\" ry=\"10\" transform=\"rotate(-14 70 48.5)\" fill=\"#e8b4b8\"/></g><g class=\"tp-ear-r\"><ellipse cx=\"130\" cy=\"46\" rx=\"15\" ry=\"19\" transform=\"rotate(14 130 46)\" fill=\"url(#tpGradHappy)\"/><ellipse cx=\"130\" cy=\"48.5\" rx=\"7.5\" ry=\"10\" transform=\"rotate(14 130 48.5)\" fill=\"#e8b4b8\"/></g><g class=\"tp-eye-l\"><path d=\"M69 88 Q77 79 85 88\" fill=\"none\" stroke=\"#3a3f47\" stroke-width=\"4\" stroke-linecap=\"round\"/></g><g class=\"tp-eye-r\"><path d=\"M115 88 Q123 79 131 88\" fill=\"none\" stroke=\"#3a3f47\" stroke-width=\"4\" stroke-linecap=\"round\"/></g><ellipse cx=\"100\" cy=\"99\" rx=\"4.5\" ry=\"3.4\" fill=\"#565d68\"/><path d=\"M91 105 Q100 117 109 105 Q100 109 91 105 Z\" fill=\"#565d68\"/><ellipse class=\"tp-blush-l\" cx=\"63\" cy=\"101\" rx=\"9.5\" ry=\"6\" fill=\"#f0b0ba\" opacity=\"0.8\"/><ellipse class=\"tp-blush-r\" cx=\"137\" cy=\"101\" rx=\"9.5\" ry=\"6\" fill=\"#f0b0ba\" opacity=\"0.8\"/><g class=\"tp-whiskers\" fill=\"none\" stroke=\"#6b7280\" stroke-width=\"1.7\" stroke-linecap=\"round\"><path d=\"M54 92 L30 88\"/><path d=\"M53 99 L28 99\"/><path d=\"M54 106 L30 110\"/><path d=\"M146 92 L170 88\"/><path d=\"M147 99 L172 99\"/><path d=\"M146 106 L170 110\"/></g></g><g class=\"tp-arm-l\"><ellipse cx=\"38\" cy=\"76\" rx=\"10\" ry=\"16\" transform=\"rotate(-38 38 76)\" fill=\"#8a93a0\"/><circle cx=\"27\" cy=\"62\" r=\"3.2\" fill=\"#565d68\"/></g><g class=\"tp-arm-r\"><ellipse cx=\"162\" cy=\"76\" rx=\"10\" ry=\"16\" transform=\"rotate(38 162 76)\" fill=\"#8a93a0\"/><circle cx=\"173\" cy=\"62\" r=\"3.2\" fill=\"#565d68\"/></g></svg>";
      SVGS.sleep = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\" class=\"totoro-svg totoro-svg--sleep\" role=\"img\" aria-label=\"Q版龙猫桌宠·睡觉\"><defs><linearGradient id=\"tpGradSleep\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#98a1ad\"/><stop offset=\"1\" stop-color=\"#7f8896\"/></linearGradient></defs><path class=\"tp-tail\" d=\"M150 146 Q178 152 172 122 Q168 106 155 111\" fill=\"none\" stroke=\"#7f8896\" stroke-width=\"12\" stroke-linecap=\"round\"/><ellipse class=\"tp-body\" cx=\"100\" cy=\"112\" rx=\"61\" ry=\"57\" fill=\"url(#tpGradSleep)\"/><g class=\"tp-belly\"><ellipse cx=\"100\" cy=\"130\" rx=\"35\" ry=\"27\" fill=\"#f3efe6\"/><path d=\"M84 132 L100 123 L116 132\" fill=\"none\" stroke=\"#c9c2b2\" stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M84 142 L100 133 L116 142\" fill=\"none\" stroke=\"#c9c2b2\" stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M84 152 L100 143 L116 152\" fill=\"none\" stroke=\"#c9c2b2\" stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g><ellipse class=\"tp-foot-l\" cx=\"80\" cy=\"167\" rx=\"14\" ry=\"8\" fill=\"#8a93a0\"/><ellipse class=\"tp-foot-r\" cx=\"120\" cy=\"167\" rx=\"14\" ry=\"8\" fill=\"#8a93a0\"/><g class=\"tp-face\" transform=\"rotate(8 100 96)\"><g class=\"tp-ear-l\"><ellipse cx=\"70\" cy=\"46\" rx=\"15\" ry=\"19\" transform=\"rotate(-14 70 46)\" fill=\"url(#tpGradSleep)\"/><ellipse cx=\"70\" cy=\"48.5\" rx=\"7.5\" ry=\"10\" transform=\"rotate(-14 70 48.5)\" fill=\"#e8b4b8\"/></g><g class=\"tp-ear-r\"><ellipse cx=\"130\" cy=\"46\" rx=\"15\" ry=\"19\" transform=\"rotate(14 130 46)\" fill=\"url(#tpGradSleep)\"/><ellipse cx=\"130\" cy=\"48.5\" rx=\"7.5\" ry=\"10\" transform=\"rotate(14 130 48.5)\" fill=\"#e8b4b8\"/></g><g class=\"tp-eye-l\"><path d=\"M69 86 Q77 93 85 86\" fill=\"none\" stroke=\"#3a3f47\" stroke-width=\"4\" stroke-linecap=\"round\"/></g><g class=\"tp-eye-r\"><path d=\"M115 86 Q123 93 131 86\" fill=\"none\" stroke=\"#3a3f47\" stroke-width=\"4\" stroke-linecap=\"round\"/></g><ellipse cx=\"100\" cy=\"99\" rx=\"4.5\" ry=\"3.4\" fill=\"#565d68\"/><path d=\"M95 107 Q100 110.5 105 107\" fill=\"none\" stroke=\"#565d68\" stroke-width=\"2\" stroke-linecap=\"round\"/><g class=\"tp-whiskers\" fill=\"none\" stroke=\"#6b7280\" stroke-width=\"1.7\" stroke-linecap=\"round\"><path d=\"M54 92 L30 88\"/><path d=\"M53 99 L28 99\"/><path d=\"M54 106 L30 110\"/><path d=\"M146 92 L170 88\"/><path d=\"M147 99 L172 99\"/><path d=\"M146 106 L170 110\"/></g></g><g class=\"tp-arm-l\"><ellipse cx=\"47\" cy=\"126\" rx=\"10.5\" ry=\"17\" transform=\"rotate(14 47 126)\" fill=\"#8a93a0\"/><circle cx=\"43\" cy=\"141\" r=\"3\" fill=\"#565d68\"/></g><g class=\"tp-arm-r\"><ellipse cx=\"153\" cy=\"126\" rx=\"10.5\" ry=\"17\" transform=\"rotate(-14 153 126)\" fill=\"#8a93a0\"/><circle cx=\"157\" cy=\"141\" r=\"3\" fill=\"#565d68\"/></g><g class=\"tp-zzz\" fill=\"none\" stroke=\"#7f8896\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M148 46 h13 l-13 12 h13\" stroke-width=\"3.4\" opacity=\"0.9\"/><path d=\"M165 29 h10 l-10 9.5 h10\" stroke-width=\"3\" opacity=\"0.75\"/><path d=\"M179 17 h7.5 l-7.5 7 h7.5\" stroke-width=\"2.6\" opacity=\"0.6\"/></g></svg>";
      SVGS.eat = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\" class=\"totoro-svg totoro-svg--eat\" role=\"img\" aria-label=\"Q版龙猫桌宠·吃东西\"><defs><linearGradient id=\"tpGradEat\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#98a1ad\"/><stop offset=\"1\" stop-color=\"#7f8896\"/></linearGradient></defs><path class=\"tp-tail\" d=\"M150 146 Q178 152 172 122 Q168 106 155 111\" fill=\"none\" stroke=\"#7f8896\" stroke-width=\"12\" stroke-linecap=\"round\"/><ellipse class=\"tp-body\" cx=\"100\" cy=\"112\" rx=\"61\" ry=\"57\" fill=\"url(#tpGradEat)\"/><g class=\"tp-belly\"><ellipse cx=\"100\" cy=\"130\" rx=\"35\" ry=\"27\" fill=\"#f3efe6\"/><path d=\"M84 132 L100 123 L116 132\" fill=\"none\" stroke=\"#c9c2b2\" stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M84 142 L100 133 L116 142\" fill=\"none\" stroke=\"#c9c2b2\" stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M84 152 L100 143 L116 152\" fill=\"none\" stroke=\"#c9c2b2\" stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g><ellipse class=\"tp-foot-l\" cx=\"80\" cy=\"167\" rx=\"14\" ry=\"8\" fill=\"#8a93a0\"/><ellipse class=\"tp-foot-r\" cx=\"120\" cy=\"167\" rx=\"14\" ry=\"8\" fill=\"#8a93a0\"/><g class=\"tp-face\"><g class=\"tp-ear-l\"><ellipse cx=\"70\" cy=\"46\" rx=\"15\" ry=\"19\" transform=\"rotate(-14 70 46)\" fill=\"url(#tpGradEat)\"/><ellipse cx=\"70\" cy=\"48.5\" rx=\"7.5\" ry=\"10\" transform=\"rotate(-14 70 48.5)\" fill=\"#e8b4b8\"/></g><g class=\"tp-ear-r\"><ellipse cx=\"130\" cy=\"46\" rx=\"15\" ry=\"19\" transform=\"rotate(14 130 46)\" fill=\"url(#tpGradEat)\"/><ellipse cx=\"130\" cy=\"48.5\" rx=\"7.5\" ry=\"10\" transform=\"rotate(14 130 48.5)\" fill=\"#e8b4b8\"/></g><g class=\"tp-eye-l\"><circle cx=\"77\" cy=\"87\" r=\"6.8\" fill=\"#3a3f47\"/><circle cx=\"74.5\" cy=\"84.5\" r=\"2.1\" fill=\"#ffffff\"/></g><g class=\"tp-eye-r\"><circle cx=\"123\" cy=\"87\" r=\"6.8\" fill=\"#3a3f47\"/><circle cx=\"120.5\" cy=\"84.5\" r=\"2.1\" fill=\"#ffffff\"/></g><ellipse cx=\"100\" cy=\"99\" rx=\"4.5\" ry=\"3.4\" fill=\"#565d68\"/><ellipse cx=\"100\" cy=\"108\" rx=\"5\" ry=\"4\" fill=\"#565d68\"/><circle class=\"tp-cheek-l\" cx=\"66\" cy=\"100\" r=\"7\" fill=\"#a5aeba\"/><circle class=\"tp-cheek-r\" cx=\"134\" cy=\"100\" r=\"7\" fill=\"#a5aeba\"/><g class=\"tp-whiskers\" fill=\"none\" stroke=\"#6b7280\" stroke-width=\"1.7\" stroke-linecap=\"round\"><path d=\"M54 92 L30 88\"/><path d=\"M53 99 L28 99\"/><path d=\"M54 106 L30 110\"/><path d=\"M146 92 L170 88\"/><path d=\"M147 99 L172 99\"/><path d=\"M146 106 L170 110\"/></g></g><g class=\"tp-food\"><rect x=\"98.6\" y=\"110\" width=\"2.8\" height=\"7\" rx=\"1.4\" fill=\"#8a6a4f\"/><ellipse cx=\"100\" cy=\"131\" rx=\"16\" ry=\"13.5\" fill=\"#d9b380\"/><path d=\"M84 127 Q100 113 116 127 Q100 133 84 127 Z\" fill=\"#8a6a4f\"/><ellipse cx=\"94\" cy=\"135\" rx=\"4\" ry=\"2.6\" fill=\"#e8cba0\" opacity=\"0.8\"/></g><g class=\"tp-arm-l\"><ellipse cx=\"71\" cy=\"129\" rx=\"9\" ry=\"15\" transform=\"rotate(32 71 129)\" fill=\"#8a93a0\"/><circle cx=\"79\" cy=\"118\" r=\"3\" fill=\"#565d68\"/></g><g class=\"tp-arm-r\"><ellipse cx=\"129\" cy=\"129\" rx=\"9\" ry=\"15\" transform=\"rotate(-32 129 129)\" fill=\"#8a93a0\"/><circle cx=\"121\" cy=\"118\" r=\"3\" fill=\"#565d68\"/></g></svg>";

      // ==================== 样式（pet.css 全文 + 外壳样式，随 <style> 注入一次） ====================
      var CSS_PET = ".totoro-pet-stage{ display:inline-block; width:96px; height:96px; will-change:transform; }\n.totoro-pet-stage svg{ width:100%; height:100%; display:block; overflow:visible; }\n/* 动画基座：语义元素以自身包围盒为变换中心（勿删！）*/\n.totoro-svg .tp-body,\n.totoro-svg .tp-eye-l,\n.totoro-svg .tp-eye-r,\n.totoro-svg .tp-arm-l,\n.totoro-svg .tp-arm-r,\n.totoro-svg .tp-tail,\n.totoro-svg .tp-food,\n.totoro-svg .tp-zzz path{\n  transform-box:fill-box;\n  transform-origin:center;\n}\n@keyframes tp-bob{ 0%, 100% { transform:translateY(0); } 50% { transform:translateY(-5px); } }\n@keyframes tp-sway{ 0%, 100% { transform:rotate(-2.4deg); } 50% { transform:rotate(2.4deg); } }\n@keyframes tp-blink{ 0%, 91.5%, 100% { transform:scaleY(1); } 94.5% { transform:scaleY(.08); } 97.5% { transform:scaleY(1); } }\n@keyframes tp-jump{ 0%, 100% { transform:translateY(0); } 28% { transform:translateY(-16px); } 52% { transform:translateY(0); } 68% { transform:translateY(-9px); } 84% { transform:translateY(0); } }\n@keyframes tp-wiggle{ 0%, 100% { transform:rotate(0); } 22% { transform:rotate(-4deg); } 48% { transform:rotate(3.6deg); } 72% { transform:rotate(-2.4deg); } }\n@keyframes tp-eatanim{ 0%, 100% { transform:translateY(0) scaleY(1); } 50% { transform:translateY(1.5px) scaleY(.94); } }\n@keyframes tp-zzz{ 0% { opacity:0; transform:translate(0, 8px) scale(.75); } 30% { opacity:.95; } 100% { opacity:0; transform:translate(5px, -16px) scale(1.05); } }\n.totoro-svg--idle .tp-body{ animation:tp-bob 3s ease-in-out infinite; }\n.totoro-svg--idle .tp-tail{ animation:tp-sway 4s ease-in-out infinite; }\n.totoro-svg--idle .tp-eye-l,\n.totoro-svg--idle .tp-eye-r,\n.totoro-svg--eat  .tp-eye-l,\n.totoro-svg--eat  .tp-eye-r{ animation:tp-blink 4s ease-in-out infinite; }\n.totoro-svg--happy .tp-body{ animation:tp-jump .6s ease-out 2; }\n.totoro-svg--happy .tp-arm-l,\n.totoro-svg--happy .tp-arm-r{ animation:tp-sway 1.2s ease-in-out infinite; }\n.totoro-svg--sleep .tp-body{ animation:tp-bob 4s ease-in-out infinite; }\n.totoro-svg--sleep .tp-zzz path{ opacity:0; animation:tp-zzz 2s ease-out infinite; }\n.totoro-svg--sleep .tp-zzz path:nth-child(2){ animation-delay:.66s; }\n.totoro-svg--sleep .tp-zzz path:nth-child(3){ animation-delay:1.33s; }\n.totoro-svg--eat .tp-body,\n.totoro-svg--eat .tp-food{ animation:tp-eatanim .5s ease-in-out 3; }\n.totoro-pet-stage.is-petting .totoro-svg .tp-body{ animation:tp-wiggle .8s ease-in-out; }\n@media (prefers-reduced-motion: reduce){\n  .totoro-svg *{ animation:none !important; }\n  .totoro-svg--sleep .tp-zzz path{ opacity:.85; }\n}";

      var CSS_SHELL = ".totoro-pet{\n  position:fixed; right:24px; bottom:24px; z-index:9999;\n  pointer-events:auto;\n  display:flex; flex-direction:column; align-items:center; gap:6px;\n  font-family:system-ui,-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;\n  font-size:12px; line-height:1.5; color:#334155;\n  user-select:none; -webkit-user-select:none; touch-action:none;\n}\n.totoro-pet.tp-pos-abs{ right:auto; bottom:auto; }\n.totoro-pet *{ box-sizing:border-box; }\n.totoro-pet.tp-dragging, .totoro-pet.tp-dragging .totoro-pet-stage{ cursor:grabbing !important; }\n.tp-stats{\n  position:relative; display:flex; align-items:center; gap:7px;\n  padding:3px 9px; border-radius:999px;\n  background:rgba(255,255,255,.72);\n  backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);\n  border:1px solid rgba(148,163,184,.35);\n  box-shadow:0 2px 8px rgba(15,23,42,.12);\n}\n.tp-lv{ font-size:10px; font-weight:700; line-height:16px; color:#b45309;\n  background:rgba(251,191,36,.18); border:1px solid rgba(245,158,11,.45);\n  border-radius:999px; padding:0 6px; white-space:nowrap; }\n.tp-bars{ display:flex; flex-direction:column; gap:2px; }\n.tp-meter{ display:block; width:44px; height:4px; border-radius:2px; overflow:hidden; background:rgba(100,116,139,.28); }\n.tp-meter-fill{ display:block; height:100%; border-radius:2px; transition:width .4s ease; }\n.tp-meter--hunger .tp-meter-fill{ background:#ef7d92; }\n.tp-meter--mood  .tp-meter-fill{ background:#f2b63d; }\n.tp-meter--energy .tp-meter-fill{ background:#54b58a; }\n.tp-tip{ position:absolute; bottom:calc(100% + 6px); left:50%;\n  transform:translateX(-50%) translateY(3px);\n  white-space:nowrap; font-size:11px; color:#334155;\n  background:rgba(255,255,255,.92);\n  backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);\n  border:1px solid rgba(148,163,184,.4); border-radius:8px; padding:4px 8px;\n  box-shadow:0 4px 12px rgba(15,23,42,.16);\n  opacity:0; pointer-events:none; transition:.18s ease; }\n.tp-stats:hover .tp-tip{ opacity:1; transform:translateX(-50%) translateY(0); }\n.tp-bubble{ position:absolute; bottom:calc(100% + 10px); left:50%;\n  transform:translateX(-50%);\n  max-width:240px; padding:8px 12px;\n  font-size:12px; line-height:1.55; text-align:center; white-space:normal;\n  color:#1f2937; background:rgba(255,255,255,.88);\n  backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);\n  border:1px solid rgba(148,163,184,.45); border-radius:12px;\n  box-shadow:0 8px 24px rgba(15,23,42,.18);\n  animation:tp-fadeout 3s ease forwards; z-index:3; }\n.tp-bubble::after{ content:\"\"; position:absolute; top:100%; left:50%; transform:translateX(-50%);\n  border:6px solid transparent; border-top-color:rgba(255,255,255,.88); }\n@keyframes tp-fadeout{ 0% { opacity:0; transform:translateX(-50%) translateY(4px); } 8% { opacity:1; transform:translateX(-50%) translateY(0); } 80% { opacity:1; } 100% { opacity:0; transform:translateX(-50%) translateY(-4px); } }\n.totoro-pet .totoro-pet-stage{ cursor:grab; filter:drop-shadow(0 6px 14px rgba(15,23,42,.22)); }\n.tp-actions{ display:flex; gap:2px; padding:4px 6px; border-radius:999px;\n  background:rgba(255,255,255,.78);\n  backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);\n  border:1px solid rgba(148,163,184,.35);\n  box-shadow:0 4px 14px rgba(15,23,42,.14);\n  opacity:0; transform:translateY(4px); transition:.2s ease; pointer-events:none; }\n.totoro-pet:hover .tp-actions{ opacity:1; transform:none; pointer-events:auto; }\n@media (hover:none){ .tp-actions{ opacity:1; transform:none; pointer-events:auto; } }\n.tp-action{ appearance:none; border:0; background:transparent; cursor:pointer;\n  font:inherit; font-size:11px; color:#334155;\n  border-radius:999px; padding:3px 7px; line-height:1.5; white-space:nowrap;\n  transition:background .15s ease, transform .1s ease; }\n.tp-action:hover{ background:rgba(99,102,241,.14); transform:translateY(-1px); }\n.tp-action:active{ transform:translateY(0); }\n.tp-dot{ position:fixed; right:26px; bottom:26px; z-index:9999;\n  width:14px; height:14px; border-radius:50%; padding:0;\n  background:rgba(152,161,173,.5); border:1px solid rgba(148,163,184,.6);\n  box-shadow:0 2px 8px rgba(15,23,42,.18);\n  cursor:pointer; transition:background .2s ease, transform .2s ease; }\n.tp-dot:hover{ background:rgba(152,161,173,.85); transform:scale(1.2); }\n.tp-dot.tp-pos-abs{ right:auto; bottom:auto; }\n.tp-mask{ position:fixed; inset:0; z-index:10000;\n  background:rgba(15,23,42,.32);\n  display:flex; align-items:center; justify-content:center;\n  animation:tp-mask-in .18s ease; }\n@keyframes tp-mask-in{ from{opacity:0;} to{opacity:1;} }\n.tp-card{ width:min(420px, calc(100vw - 48px));\n  max-height:min(560px, calc(100vh - 96px)); overflow:auto;\n  background:rgba(255,255,255,.94);\n  backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);\n  border:1px solid rgba(148,163,184,.4); border-radius:16px;\n  padding:16px 18px; color:#1f2937;\n  font-size:13px; line-height:1.65;\n  box-shadow:0 20px 60px rgba(15,23,42,.3);\n  animation:tp-card-in .2s ease; }\n@keyframes tp-card-in{ from{opacity:0; transform:translateY(10px) scale(.98);} to{opacity:1; transform:none;} }\n.tp-card h3{ margin:0 0 10px; font-size:15px; color:#111827; display:flex; align-items:center; justify-content:space-between; }\n.tp-close{ appearance:none; border:0; background:transparent; cursor:pointer;\n  font-size:15px; color:#64748b; border-radius:6px; padding:2px 7px; line-height:1.4; }\n.tp-close:hover{ background:rgba(100,116,139,.12); color:#111827; }\n.tp-dex-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:10px; }\n.tp-dex-cell{ text-align:center; background:rgba(241,245,249,.85); border:1px solid rgba(148,163,184,.3); border-radius:10px; padding:6px 2px 5px; }\n.tp-dex-thumb{ width:64px; height:64px; margin:0 auto; }\n.tp-dex-thumb svg{ width:100%; height:100%; display:block; }\n.tp-dex-name{ font-size:11px; font-weight:600; color:#475569; margin-top:2px; }\n.tp-dex-trigger{ font-size:10.5px; color:#64748b; }\n.tp-dex-bio{ background:rgba(241,245,249,.85); border-left:3px solid #94a3b8; border-radius:8px; padding:8px 10px; color:#374151; margin-bottom:10px; }\n.tp-hint{ margin:10px 0 0; font-size:11.5px; color:#94a3b8; }\n.tp-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px dashed rgba(148,163,184,.3); }\n.tp-row:last-of-type{ border-bottom:0; }\n.tp-row-label{ color:#374151; flex-shrink:0; }\n.tp-row-ctrl{ display:flex; align-items:center; gap:8px; }\n.tp-row-val{ font-variant-numeric:tabular-nums; font-size:12px; color:#64748b; min-width:36px; text-align:right; }\ninput[type='range'].tp-range{ accent-color:#8b93a7; width:140px; margin:0; }\ninput[type='checkbox'].tp-switch{ appearance:none; -webkit-appearance:none; outline:none; cursor:pointer;\n  width:36px; height:20px; border-radius:999px; margin:0; vertical-align:middle;\n  background:rgba(100,116,139,.35); position:relative; transition:background .2s ease; }\ninput[type='checkbox'].tp-switch::after{ content:''; position:absolute; top:2px; left:2px; width:16px; height:16px;\n  border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.25);\n  transition:left .2s ease; }\ninput[type='checkbox'].tp-switch:checked{ background:#7c9a68; }\ninput[type='checkbox'].tp-switch:checked::after{ left:18px; }\ninput[type='number'].tp-num{ width:66px; padding:3px 6px; font-size:12px; color:#1f2937;\n  border:1px solid rgba(148,163,184,.5); border-radius:8px;\n  background:rgba(255,255,255,.85); font-family:inherit; }";

      var CSS_ALL = CSS_PET + '\n' + CSS_SHELL;

      // ==================== 龙猫小传（图鉴用，原创） ====================
      var BIO_TEXT = "「绒绒」，一只栖居在回环端口里的小龙猫。白天帮主人盯日志、踩构建，夜里蜷成毛球给 CPU 取暖。传说摸摸它的头会带来好运，投喂一颗橡果能听见满足的呼噜声。不咬人、不占内存，只偶尔偷吃一点点注意力。";


      // ==================== 台词库（离线降级 / 点击闲聊） ====================
      var LOCAL_LINES = {
        feed: ['咔嚓咔嚓……（离线也吃得香）', '谢谢投喂～（本地回音）'],
        pet: ['呼噜呼噜……（离线模式）', '绒毛充电中～（本地模式）'],
        play: ['转圈圈……（离线陪玩）', '接住啦！（本地回音）'],
        sleep: ['呼啊……先眯一会儿（离线）', 'zzZ……（本地小睡）'],
        wake: ['唔哇！醒啦！（离线）', '揉揉眼睛……世界，启动！（本地）'],
      };
      var CLICK_LINES = ['（歪头看你）', '呼噜呼噜～', '咦？叫我吗？', '（尾巴卷成一个问号）', '今天也要加油鸭！', '（蹭蹭你的手）'];

      // ==================== 工具 ====================
      function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
      function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
      function lsGet(k) {
        try { var s = w.localStorage.getItem(k); return s == null ? null : JSON.parse(s); } catch (_) { return null; }
      }
      function lsSet(k, v) { try { w.localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }

      /** 配置容错化：坏值回落默认，数值 clamp 到合法区间。 */
      function sanitizeConfig(raw) {
        var c = (raw && typeof raw === 'object') ? raw : {};
        var out = { enabled: true, scale: 1, opacity: 1, autoHideMinutes: 0 };
        if (typeof c.enabled === 'boolean') out.enabled = c.enabled;
        if (typeof c.scale === 'number' && isFinite(c.scale)) out.scale = clamp(c.scale, RANGE.scaleMin, RANGE.scaleMax);
        if (typeof c.opacity === 'number' && isFinite(c.opacity)) out.opacity = clamp(c.opacity, RANGE.opMin, RANGE.opMax);
        if (typeof c.autoHideMinutes === 'number' && isFinite(c.autoHideMinutes)) out.autoHideMinutes = clamp(Math.round(c.autoHideMinutes), 0, RANGE.hideMax);
        return out;
      }
      function loadConfig() { return sanitizeConfig(lsGet(LS_CONFIG)); }
      function readPos() {
        var p = lsGet(LS_POS);
        if (p && typeof p.x === 'number' && isFinite(p.x) && typeof p.y === 'number' && isFinite(p.y)) return { x: p.x, y: p.y };
        return null;
      }
      /** 业务拒绝文案映射；未识别的错误回落本地随机台词。 */
      function errLine(err, type) {
        err = String(err || '');
        if (/cooldown/i.test(err)) return pick(['唔……刚摸过嘛，歇一会儿再摸～', '（躲开）摸多了会秃的啦！']);
        if (/tired|energy/i.test(err)) return pick(['呼啊……没力气了，让我睡一觉先……', '玩不动了嘛……先充点电？']);
        return pick(LOCAL_LINES[type] || CLICK_LINES);
      }

      // ==================== 桌宠主组件 ====================
      function TotoroPetApp() {
        var stH = React.useState(null);        var st = stH[0], setSt = stH[1];
        var cfgH = React.useState(loadConfig); var cfg = cfgH[0], setCfg = cfgH[1];
        var posH = React.useState(readPos);    var pos = posH[0], setPos = posH[1];
        var modalH = React.useState(null);     var modal = modalH[0], setModal = modalH[1];
        var bubH = React.useState(null);       var bubble = bubH[0], setBubble = bubH[1];
        var trH = React.useState('');          var transient = trH[0], setTransient = trH[1];
        var hidH = React.useState(false);      var hidden = hidH[0], setHidden = hidH[1];

        var rootRef = React.useRef(null);
        var stageRef = React.useRef(null);
        var timersRef = React.useRef([]);
        var dragRef = React.useRef(null);
        var revertRef = React.useRef(null);
        var wiggleRef = React.useRef(null);
        var seqRef = React.useRef(0);
        var lastActRef = React.useRef(Date.now());
        var cfgRef = React.useRef(cfg); cfgRef.current = cfg;

        var sleeping = !!(st && st.sleeping);
        var pose = transient || (sleeping ? 'sleep' : 'idle');
        var stageSize = Math.round(96 * clamp(cfg.scale, RANGE.scaleMin, RANGE.scaleMax));

        function later(fn, ms) { var id = setTimeout(fn, ms); timersRef.current.push(id); return id; }
        function bump() { lastActRef.current = Date.now(); }

        function showBubble(text) {
          if (!text) return;
          seqRef.current += 1;
          var seq = seqRef.current;
          setBubble({ text: text, key: seq });
          later(function () { setBubble(function (b) { return (b && b.key === seq) ? null : b; }); }, BUBBLE_MS);
        }

        function fetchState() {
          fetch(API_BASE + '/state')
            .then(function (r) { return r.json(); })
            .then(function (j) { if (j && j.ok && j.state) setSt(j.state); })
            .catch(function (e) { console.warn('[totoro-pet] state poll failed:', e && e.message); });
        }

        function wiggleOnce() {
          if (!stageRef.current) return;
          var s = stageRef.current;
          s.classList.add('is-petting');
          if (wiggleRef.current) clearTimeout(wiggleRef.current);
          wiggleRef.current = later(function () { s.classList.remove('is-petting'); }, WIGGLE_MS);
        }

        /** 姿态动画：feed→eat 3s；pet/play→happy 1.3s；pet 另触发扭动。 */
        function playPose(type) {
          if (type === 'feed') {
            setTransient('eat');
            if (revertRef.current) clearTimeout(revertRef.current);
            revertRef.current = later(function () { setTransient(''); }, EAT_MS);
          } else if (type === 'pet' || type === 'play') {
            setTransient('happy');
            if (revertRef.current) clearTimeout(revertRef.current);
            revertRef.current = later(function () { setTransient(''); }, HAPPY_MS);
            if (type === 'pet') wiggleOnce();
          }
        }

        /** POST interact；成功显示服务器台词，失败静默转本地随机台词（离线模式）。 */
        function interact(type) {
          bump();
          fetch(API_BASE + '/interact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: type }),
          })
            .then(function (r) { return r.json(); })
            .then(function (j) {
              if (j && j.ok) {
                setSt(j.state);
                playPose(type);
                showBubble(j.message || pick(LOCAL_LINES[type] || CLICK_LINES));
              } else {
                console.warn('[totoro-pet] interact rejected:', j && j.error);
                showBubble(errLine(j && j.error, type));
              }
            })
            .catch(function (e) {
              console.warn('[totoro-pet] interact failed (offline):', e && e.message);
              showBubble(pick(LOCAL_LINES[type] || CLICK_LINES));
            })
            .then(function () { fetchState(); });
        }

        /** 配置更新：即时生效 + localStorage 持久化 + 尽力 POST 双写（失败静默）。 */
        function applyConfig(partial) {
          bump();
          var next = sanitizeConfig(Object.assign({}, cfgRef.current, partial));
          setCfg(next);
          lsSet(LS_CONFIG, next);
          try {
            fetch(API_BASE + '/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(next),
            })
              .then(function (r) { return r.json(); })
              .then(function (j) { if (!(j && j.ok)) console.warn('[totoro-pet] config push rejected:', j && j.error); })
              .catch(function () { /* 静默：仅本机生效 */ });
          } catch (_) {}
        }

        // ---- 拖拽：pointerdown/move/up，4px 阈值区分点击 vs 拖拽 ----
        function onPointerDown(e) {
          bump();
          if (dragRef.current) return;
          var t = e.target;
          if (t && typeof t.closest === 'function' &&
              t.closest('.tp-actions,.tp-stats,.tp-bubble,.tp-tip,button,input,label,a')) return;
          var rootEl = rootRef.current; if (!rootEl) return;
          var rect = rootEl.getBoundingClientRect();
          dragRef.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: rect.left, oy: rect.top, moved: false };
          try { rootEl.setPointerCapture(e.pointerId); } catch (_) {}
        }
        function onPointerMove(e) {
          var d = dragRef.current;
          if (!d || e.pointerId !== d.id) return;
          var dx = e.clientX - d.sx, dy = e.clientY - d.sy;
          if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
          if (!d.moved) { d.moved = true; if (rootRef.current) rootRef.current.classList.add('tp-dragging'); }
          var rootEl = rootRef.current;
          var wd = rootEl ? rootEl.offsetWidth : 140;
          var ht = rootEl ? rootEl.offsetHeight : 220;
          setPos({
            x: clamp(d.ox + dx, 8, Math.max(8, window.innerWidth - wd - 8)),
            y: clamp(d.oy + dy, 8, Math.max(8, window.innerHeight - ht - 8)),
          });
          bump();
        }
        function endDrag(e, persist) {
          var d = dragRef.current;
          if (!d || (e && e.pointerId !== undefined && e.pointerId !== d.id)) return;
          dragRef.current = null;
          var rootEl = rootRef.current;
          if (rootEl) {
            rootEl.classList.remove('tp-dragging');
            try { rootEl.releasePointerCapture(d.id); } catch (_) {}
          }
          if (d.moved && persist && rootEl) {
            var r = rootEl.getBoundingClientRect();
            var np = { x: r.left, y: r.top };
            setPos(np);
            lsSet(LS_POS, np);
          } else if (!d.moved) {
            wiggleOnce();
            showBubble(pick(CLICK_LINES));
          }
          bump();
        }
        function onPointerUp(e) { endDrag(e, true); }
        function onPointerCancel(e) { endDrag(e, false); }

        // ---- 初始拉取 + 30s 轮询 + 可见性刷新 + resize 越界回弹 ----
        React.useEffect(function () {
          fetchState();
          var iv = setInterval(fetchState, POLL_MS);
          var onVis = function () { if (document.visibilityState === 'visible') fetchState(); };
          var onResize = function () {
            setPos(function (p) {
              if (!p) return p;
              var rootEl = rootRef.current;
              var wd = rootEl ? rootEl.offsetWidth : 140;
              var ht = rootEl ? rootEl.offsetHeight : 220;
              return {
                x: clamp(p.x, 8, Math.max(8, window.innerWidth - wd - 8)),
                y: clamp(p.y, 8, Math.max(8, window.innerHeight - ht - 8)),
              };
            });
          };
          document.addEventListener('visibilitychange', onVis);
          window.addEventListener('resize', onResize);
          return function () {
            clearInterval(iv);
            document.removeEventListener('visibilitychange', onVis);
            window.removeEventListener('resize', onResize);
          };
        }, []);

        // ---- 首次挂载：与服务器配置对齐（本机已有则尽力推送对齐） ----
        React.useEffect(function () {
          var hadLocal = false;
          try { hadLocal = w.localStorage.getItem(LS_CONFIG) != null; } catch (_) {}
          fetch(API_BASE + '/config')
            .then(function (r) { return r.json(); })
            .then(function (j) {
              if (!(j && j.ok && j.config)) return;
              if (!hadLocal) {
                setCfg(sanitizeConfig(j.config));
              } else {
                try {
                  fetch(API_BASE + '/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cfgRef.current),
                  }).catch(function () {});
                } catch (_) {}
              }
            })
            .catch(function () { /* 离线：忽略 */ });
        }, []);

        // ---- Esc 关闭弹层 ----
        React.useEffect(function () {
          if (!modal) return undefined;
          var onKey = function (ev) { if (ev.key === 'Escape') setModal(null); };
          document.addEventListener('keydown', onKey);
          return function () { document.removeEventListener('keydown', onKey); };
        }, [modal]);

        // ---- 闲置自动隐藏（0 = 不自动隐藏） ----
        React.useEffect(function () {
          var mins = cfg.autoHideMinutes | 0;
          if (!mins || !cfg.enabled || hidden) return undefined;
          var iv = setInterval(function () {
            if (Date.now() - lastActRef.current >= mins * 60000) setHidden(true);
          }, AUTOHIDE_TICK_MS);
          return function () { clearInterval(iv); };
        }, [cfg.autoHideMinutes, cfg.enabled, hidden]);

        // ---- 卸载清理：全部定时器（轮询/监听由各 effect 自清理） ----
        React.useEffect(function () {
          return function () {
            timersRef.current.forEach(function (id) { clearTimeout(id); });
            timersRef.current = [];
          };
        }, []);

        // ---- 渲染辅助 ----
        function meter(kind, v) {
          return el('span', { className: 'tp-meter tp-meter--' + kind },
            el('span', { className: 'tp-meter-fill', style: { width: v + '%' } }));
        }
        function actionBtn(label, type) {
          return el('button', { className: 'tp-action', onClick: function () { interact(type); } }, label);
        }
        function row(label, ctrl, key) {
          return el('div', { className: 'tp-row', key: key || label },
            el('span', { className: 'tp-row-label' }, label),
            el('span', { className: 'tp-row-ctrl' }, ctrl));
        }
        function slider(min, max, step, val, onV) {
          return [
            el('input', { key: 'r', type: 'range', className: 'tp-range', min: min, max: max, step: step, value: val,
              onChange: function (e) { onV(parseFloat(e.target.value)); } }),
            el('span', { className: 'tp-row-val', key: 'v' }, Number(val).toFixed(2)),
          ];
        }
        function closeBtn() {
          return el('button', { className: 'tp-close', onClick: function () { setModal(null); } }, '\u2715');
        }
        function dexCell(name, label, trigger) {
          return el('div', { className: 'tp-dex-cell', key: name },
            el('div', { className: 'tp-dex-thumb', dangerouslySetInnerHTML: { __html: SVGS[name] } }),
            el('div', { className: 'tp-dex-name' }, label),
            el('div', { className: 'tp-dex-trigger' }, trigger));
        }
        function stageNode() {
          return el('div', {
            className: 'totoro-pet-stage',
            ref: stageRef,
            style: { width: stageSize + 'px', height: stageSize + 'px' },
            dangerouslySetInnerHTML: { __html: SVGS[pose] || SVGS.idle },
          });
        }
        function renderModal() {
          var inner;
          if (modal === 'dex') {
            inner = [
              el('h3', { key: 'h' }, '\uD83D\uDC09 龙猫图鉴', closeBtn()),
              el('div', { className: 'tp-dex-grid', key: 'g' },
                dexCell('idle', '待机 idle', '默认姿态 · 呼吸眨眼'),
                dexCell('happy', '开心 happy', '抚摸/玩耍成功后跳跃 1.3 秒'),
                dexCell('sleep', '睡觉 sleep', '入睡后闭眼歪头 · Zzz 上浮'),
                dexCell('eat', '吃东西 eat', '喂食后咀嚼 3 秒')),
              el('div', { className: 'tp-dex-bio', key: 'bio' }, BIO_TEXT),
              el('p', { className: 'tp-hint', key: 'hint' }, '小提示：按住它可拖到屏幕任意角落；点击它会回应你。'),
            ];
          } else {
            inner = [
              el('h3', { key: 'h' }, '\u2699 桌宠设置', closeBtn()),
              row('启用桌宠',
                el('input', { type: 'checkbox', className: 'tp-switch', checked: cfg.enabled,
                  onChange: function (e) { applyConfig({ enabled: !!e.target.checked }); } }), 'enabled'),
              row('大小 ×' + cfg.scale.toFixed(2),
                slider(RANGE.scaleMin, RANGE.scaleMax, 0.05, cfg.scale,
                  function (v) { applyConfig({ scale: v }); }), 'scale'),
              row('不透明度 ' + Math.round(cfg.opacity * 100) + '%',
                slider(RANGE.opMin, RANGE.opMax, 0.05, cfg.opacity,
                  function (v) { applyConfig({ opacity: v }); }), 'opacity'),
              row('闲置自动隐藏（分钟，0=否）',
                el('input', { type: 'number', className: 'tp-num', min: 0, max: RANGE.hideMax, step: 5, value: cfg.autoHideMinutes,
                  onChange: function (e) { applyConfig({ autoHideMinutes: Math.max(0, Math.round(Number(e.target.value) || 0)) }); } }), 'hide'),
              el('p', { className: 'tp-hint', key: 'hint' }, '更改即时生效并保存到本机；已尽力同步到 DSH 服务端（失败时静默）。'),
            ];
          }
          return el('div', { className: 'tp-mask', onClick: function () { setModal(null); } },
            el('div', { className: 'tp-card', onClick: function (ev) { ev.stopPropagation(); } }, inner));
        }

        var styleNode = el('style', { key: 'style', dangerouslySetInnerHTML: { __html: CSS_ALL } });

        // 停用或自动隐藏 → 只剩半透明小圆点，点击恢复
        if (!cfg.enabled || hidden) {
          var dotStyle = pos ? { left: pos.x + 'px', top: pos.y + 'px' } : {};
          return [
            styleNode,
            el('button', {
              key: 'dot', className: 'tp-dot' + (pos ? ' tp-pos-abs' : ''), style: dotStyle,
              title: hidden ? '桌宠已自动隐藏，点我唤醒' : '桌宠已停用，点我恢复',
              onClick: function () {
                bump();
                if (!cfg.enabled) applyConfig({ enabled: true });
                setHidden(false);
              },
            }),
          ];
        }

        var hungerV = Math.round(st ? st.hunger : 0);
        var moodV = Math.round(st ? st.mood : 0);
        var energyV = Math.round(st ? st.energy : 0);
        var lvText = st ? ('Lv.' + st.level) : 'Lv.--';
        var tipText = '饱食 ' + hungerV + ' · 心情 ' + moodV + ' · 精力 ' + energyV + (st ? ' · ' + lvText : '');

        var stats = el('div', { className: 'tp-stats', title: tipText, key: 'stats' },
          el('span', { className: 'tp-lv' }, lvText),
          el('span', { className: 'tp-bars' },
            meter('hunger', hungerV), meter('mood', moodV), meter('energy', energyV)),
          el('span', { className: 'tp-tip' }, tipText));

        var actions = el('div', { className: 'tp-actions', key: 'actions' },
          actionBtn('\uD83C\uDF4E\u5582\u98DF', 'feed'),
          actionBtn('\u270B\u629A\u6478', 'pet'),
          actionBtn('\uD83C\uDFBE\u73A9\u800D', 'play'),
          el('button', { className: 'tp-action', onClick: function () { interact(sleeping ? 'wake' : 'sleep'); } },
            sleeping ? '\u2600\uFE0F\u5524\u9192' : '\uD83D\uDCA4\u7761\u89C9'),
          el('button', { className: 'tp-action', onClick: function () { bump(); setModal('dex'); } }, '\uD83D\uDCD6\u56FE\u9274'),
          el('button', { className: 'tp-action', onClick: function () { bump(); setModal('settings'); } }, '\u2699\u8BBE\u7F6E'));

        var bubbleEl = bubble
          ? el('div', { className: 'tp-bubble', key: 'b' + bubble.key }, bubble.text)
          : null;

        var rootStyle = { opacity: String(cfg.opacity) };
        if (pos) { rootStyle.left = pos.x + 'px'; rootStyle.top = pos.y + 'px'; }

        return [
          styleNode,
          el('div', {
            key: 'root',
            ref: rootRef,
            className: 'totoro-pet' + (pos ? ' tp-pos-abs' : ''),
            style: rootStyle,
            onPointerDown: onPointerDown,
            onPointerMove: onPointerMove,
            onPointerUp: onPointerUp,
            onPointerCancel: onPointerCancel,
          }, bubbleEl, stats, stageNode(), actions),
        ].concat(modal ? [renderModal()] : []);
      }

      // ==================== 插件入口：注册 shell.overlay 全局悬浮层槽位 ====================
      // 层本身点击穿透；条目根容器自带 pointer-events:auto。
      //
      // 生命周期约定（对照 dsh-pocket / dream-skin 等参考件）：
      //   ctx.slots.inject 的注册随插件 ctx 自动卸载/清理，禁用或卸载插件后不会残留。
      //   严禁把 inject 包进 ctx.effect 且不在回调里返回 disposer —— 那样会让框架在插件
      //   卸载时把该回调当作“卸载钩子”再次执行，造成残留的 overlay 注册；后续刷新页面
      //   或重新启用插件时，shell 会用一个已失效的 ctx 去渲染 TotoroPetApp，从而报错或
      //   桌宠不显示（即本仓库报告的两个问题）。直接调用 ctx.slots.inject 即可正确随
      //   ctx 清理。
      function apply(ctx) {
        try {
          if (!ctx || !ctx.slots || typeof ctx.slots.inject !== 'function') {
            console.warn('[totoro-pet] ctx.slots unavailable; UI not mounted');
            return;
          }
          // 直接注册（与 dsh-pocket 同构）：提供函数返回 register 结果，随 ctx 自动清理。
          ctx.slots.inject('shell.overlay', function () {
            return ctx.slots.register({
              name: 'shell.overlay',
              id: 'totoro-pet',
              order: 10,
              inject: function () { return {}; },
            }, TotoroPetApp);
          });
        } catch (e) {
          console.warn('[totoro-pet] slot mount failed:', e && e.message);
        }
      }

      exports.inject = ['slots'];
      exports.apply = apply;
      return module.exports;
    },
  });
})();
