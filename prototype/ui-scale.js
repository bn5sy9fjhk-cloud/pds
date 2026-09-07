/* =====================================================================
   霍桐PDS · UI Density 共享模块  ui-scale.js
   —— 用户端(index + pages) 与管理端(admin/*.html) 共用。
   职责：只负责读/写/持久 localStorage('htpds.scale')，
         并把当前档设置到 <body data-ui-scale="s|m|l">，
         再高亮对应「大/中/小」按钮。
   ★ 真正的视觉尺寸完全由 ui-base.css 里的三档 Display Size Token 决定，
     JS 不再设置 body.style.zoom，也不再直接改任何字号/px。
   按钮约定：user 用 data-sc / admin 用 data-mgrsc（共用 .mt-scale-btn 视觉）。
   ===================================================================== */
(function () {
'use strict';
if (typeof window === 'undefined' || typeof document !== 'object') return;

var KEY  = 'htpds.scale';
var VALID = { s: true, m: true, l: true };

function normalize(k){ return VALID[k] ? k : 'm'; }

/* 读取当前档（默认 Medium，校验落在 s/m/l） */
function readScale(){
  var v = 'm';
  try {
    if (window.localStorage) {
      var s = window.localStorage.getItem(KEY);
      if (VALID[s]) v = s;
    }
  } catch (e) { /* ignore */ }
  return v;
}
/* 保存用户选择（与两端共用同一键，不改名、不改值域） */
function saveScale(k){
  k = normalize(k);
  try { if (window.localStorage) window.localStorage.setItem(KEY, k); } catch (e) {}
  return k;
}
/* 真正落档：body[data-ui-scale]+按钮高亮 */
function paint(k){
  k = normalize(k);
  var all = document.querySelectorAll('.mt-scale-btn[data-sc], .mt-scale-btn[data-mgrsc]');
  for (var i = 0; i < all.length; i++){
    var b = all[i];
    var v = b.getAttribute('data-sc');
    if (v == null) v = b.getAttribute('data-mgrsc');
    b.classList.toggle('is-on', v === k);
  }
}
function applyScale(k){
  k = normalize(k);
  document.body.setAttribute('data-ui-scale', k);
  paint(k);
  return k;
}
/* 切换并存档 */
function setScale(k, persist){
  k = normalize(k);
  if (persist) saveScale(k);
  return applyScale(k);
}
/* 事件委托：一端点按任一 scale 按钮即全表高亮 + 落档 */
function bind(){
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var b = t.closest('.mt-scale-btn[data-sc], .mt-scale-btn[data-mgrsc]');
    if (!b) return;
    var v = b.getAttribute('data-sc');
    if (v == null) v = b.getAttribute('data-mgrsc');
    if (VALID[v]) setScale(v, true);
  });
}
/* 可选：进入页面时依据存储档应用（不发 click，避免重复存） */
function init(){
  applyScale(readScale());
  bind();
}

window.UIScale = {
  read: readScale, save: saveScale, apply: applyScale, set: setScale, init: init
};
if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', function () { window.UIScale.init(); });
} else {
  window.UIScale.init();
}
})();
