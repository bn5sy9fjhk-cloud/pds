/* =====================================================================
   霍桐PDS · UI Density 共享模块  ui-scale.js
   —— 用户端(index + pages) 与管理端(admin/*.html) 共用。
   职责：读/写 localStorage('htpds.scale') 并应用 S/M/L；
   用户端同时从本共享入口加载 user-public.css / user-public.js，确保公共页面视觉一致。
   ===================================================================== */
(function () {
'use strict';
if (typeof window === 'undefined' || typeof document !== 'object') return;

var KEY  = 'htpds.scale';
var VALID = { s: true, m: true, l: true };

function normalize(k){ return VALID[k] ? k : 'm'; }
function readScale(){
  var v = 'm';
  try {
    if (window.localStorage) {
      var s = window.localStorage.getItem(KEY);
      if (VALID[s]) v = s;
    }
  } catch (e) {}
  return v;
}
function saveScale(k){
  k = normalize(k);
  try { if (window.localStorage) window.localStorage.setItem(KEY, k); } catch (e) {}
  return k;
}
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
function setScale(k, persist){
  k = normalize(k);
  if (persist) saveScale(k);
  return applyScale(k);
}
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

/* 用户端公共视觉入口。
   通过 ui-scale.js 自身 URL 解析资源，因此 index.html 与 pages/*.html 都无需复制路径判断。 */
function loadUserPublic(){
  if (document.body.classList.contains('admin-app')) return;
  var src = (document.currentScript && document.currentScript.src) || '';
  if (!src) {
    var ss=document.getElementsByTagName('script');
    for(var i=ss.length-1;i>=0;i--){ if(/ui-scale\.js(?:\?|$)/.test(ss[i].src||'')){src=ss[i].src;break;} }
  }
  if(!src)return;
  var cssUrl,jsUrl;
  try{cssUrl=new URL('user-public.css',src).href;jsUrl=new URL('user-public.js',src).href;}catch(e){return;}
  if(!document.querySelector('link[data-user-public]')){
    var link=document.createElement('link');
    link.rel='stylesheet';link.href=cssUrl;link.setAttribute('data-user-public','true');
    document.head.appendChild(link);
  }
  if(!document.querySelector('script[data-user-public]')){
    var js=document.createElement('script');
    js.src=jsUrl;js.defer=true;js.setAttribute('data-user-public','true');
    document.head.appendChild(js);
  }
}

function init(){
  loadUserPublic();
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
