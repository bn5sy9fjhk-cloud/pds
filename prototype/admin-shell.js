/* ================================================================
   admin-shell.js —— 独立后台页共享壳（admin/*.html）
   公共约定（唯一的公共：导航数据、缩放控件、当前页标注即读取 body.dataset）
   - 每个后台页都是真实独立 html，与本文件同兄弟目录；
   - 左栏为真实链接导航，不再做同页 SPA 路由切换；
   - 右上头像保留为登录态占位；“返回文件工作台”是真实回到 ../index.html 的链接；
   - 大 / 中 / 小 缩放与文件工作台共用 localStorage('htpds.scale')。
   依赖 admin-core.js(window.H) 与对应页面对应的 admin-pages-*.js(window.Routes)。
   ================================================================ */
(function () {
'use strict';
if (typeof window === 'undefined' || typeof document !== 'object') return;

var H = window.H;
if (!H) return;

var KEY = String(document.body.getAttribute('data-key') || 'overview');
var NAV = [
  { g: '运营', items: [['overview', '平台概览'], ['org', '组织与成员'], ['spaces', '空间管理'], ['perms', '空间成员权限']] },
  { g: '治理', items: [['filegov', '文件 / 回收站治理'], ['quota', '配额管理']] },
  { g: '审计与系统', items: [['audit', '审计日志'], ['syscfg', '系统配置']] }
];
/* 导航图标沿菜单字面 key 引用统一 Registry(window.AdminIcon)。 */
var RKEY = {
  overview: 'overview', org: 'org', spaces: 'drive', perms: 'permission',
  filegov: 'folder', quota: 'quota', audit: 'audit', syscfg: 'settings'
};


function nameOf(k){ var t = k; for (var i = 0; i < NAV.length; i++){ for (var j = 0; j < NAV[i].items.length; j++){ if (NAV[i].items[j][0] === k) t = NAV[i].items[j][1]; } } return t; }

function buildTopbar(){
  var cur = document.querySelector('[data-cur]');
  if (cur) cur.textContent = nameOf(KEY);
  var docT = document.querySelector('title');
  if (docT) docT.textContent = '霍桐PDS · 管理中心 · ' + nameOf(KEY) + '（视觉验证原型）';
}
function buildNav(){
  var el = document.getElementById('mNav');
  if (!el) return;
  NAV.forEach(function (grp) {
    var sec = document.createElement('section');
    sec.className = 'a-nav__group';
    var p = document.createElement('h3');
    p.className = 'a-nav__label';
    p.textContent = grp.g;
    sec.appendChild(p);
    grp.items.forEach(function (it) {
      var k = it[0];
      var is = k === KEY;
      var a = document.createElement('a');
      a.className = 'a-nav-item' + (is ? ' a-nav-item--on' : '');
      a.href = k + '.html';
      a.innerHTML = AdminIcon.mark(RKEY[k] || k) + '<span>' + it[1] + '</span>';
      sec.appendChild(a);
    });
    el.appendChild(sec);
  });
}

/* 缩放：小/中/大 逻辑已上收至共享 ui-scale.js —— 这里只做 UA 壳侧接线，
   不在此直接控制 zoom；视觉尺寸由 ui-base.css 的 [data-ui-scale] Token 决定。 */
function SC(){
  return (window.UIScale) ? window.UIScale : null;
}
function bootCurrent(){
  buildTopbar();
  buildNav();
  var n = document.querySelectorAll('#mNav .a-nav-item');
  for (var i = 0; i < n.length; i++) n[i].setAttribute('aria-current', n[i].getAttribute('href') === KEY + '.html' ? 'page' : 'false');
  /* 落档：交给共享 ui-scale.js（其上已覆盖 body[data-ui-scale] + 按钮高亮），仅确保已应用 */
  if (SC()) SC().apply(SC().read());
  /* 渲染当前页面对应唯一正文（对应脚本已按页面按其组引入） */
  var fn = window.Routes && window.Routes[KEY] ? window.Routes[KEY] : null;
  if (fn && typeof fn === 'function') { try { fn(); } catch (e) { if (window.console) window.console.error(e); } }
}
if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', bootCurrent); } else { bootCurrent(); }
})();
