/* =====================================================================
   霍桐PDS · 用户端「只读占位页」共享行为  pages/user-shell.js
   供 我的文档(my-docs) / 最近使用(recent) / 收藏(starred) / 回收站(trash)
   四个轻列表页共用；不含编辑能力，仅负责：
     - 依据 <body data-page="…"> 把各导航项收进可点真实链接
     - 激活当前导航高亮
     - 渲染只读行（名称/类型/大小/修改时间/来源）
     - 回收站显示空态
   ===================================================================== */
(function () {
'use strict';

var $   = function (id){ return document.getElementById(id); };

var current = (document.body && document.body.getAttribute('data-page')) || '';

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function toSize(n){
  if(n==null||isNaN(n))return '—';
  if(n>=1024)return (n/1024).toFixed(1)+' GB';
  if(n>=1)return (Math.round(n*10)/10)+' MB';
  return Math.round(n*1024)+' KB';
}

/* 线性图标（读 currentColor） */
var FDIR  = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M2 5.4 2.2 5A1.6 1.6 0 0 1 3.6 3.7h3.2l1.9 1.6h6.8A1.5 1.5 0 0 1 17 6.8v8.6A1.6 1.6 0 0 1 15.4 17H3.6A1.6 1.6 0 0 1 2 15.4V5.4Z"/></svg>';
var FF     = '<svg width="17" height="20" viewBox="0 0 15 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 1H3.4A1 1 0 0 0 2.4 2v13a1 1 0 0 0 1 1h9.2a1 1 0 0 0 1-1V5.2L8.5 1Z"/><path d="M8.5 1v4.2H13.4"/></svg>';
var FFOLDER = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 5A1.5 1.5 0 0 1 4 3.5h3l2 2H14A1.5 1.5 0 0 1 15.5 7v6A1.5 1.5 0 0 1 14 14.5H4A1.5 1.5 0 0 1 2.5 13Z"/></svg>';

var KIND = { dwg:'DWG', model:'STEP', pdf:'PDF', img:'图片', xlsx:'表格', docx:'文档', file:'文件' };

/* —— 只读占位数据（本轮仅为可用列表，非目录权威；后续接真数据源替换此表） —— */
var RECENT = [
  { n:'DWG-001.dwg',  k:'dwg',   s:24.6, t:'2026-09-04 10:21', src:'部门空间/研发部/产品资料/2026' },
  { n:'规格清单.xlsx', k:'xlsx',  s:0.3,  t:'2026-09-04 09:05', src:'部门空间/研发部/…/零件图库' },
  { n:'排产计划.pdf',  k:'pdf',   s:2.1,  t:'2026-09-03 18:42', src:'部门空间/生产部' },
  { n:'设备照片.jpg',  k:'img',   s:6.2,  t:'2026-09-02 16:11', src:'部门空间/研发部/产品资料/2026' },
  { n:'装配图_A2.dwg', k:'dwg',   s:12.1, t:'2026-09-03 09:10', src:'部门空间/研发部/…/设计图纸' }
];
var STARRED = [
  { n:'霍桐PDS上线通知.pdf', k:'pdf', s:0.7, t:'2026-09-02 17:00', src:'部门空间/管理中心' }
];
var MYDOCS = [
  { f:1, n:'我的项目归档', t:'2026-09-01 09:12', src:'我的个人目录' },
  { f:1, n:'个人检索库',   t:'2026-08-28 14:30', src:'我的个人目录' },
  { n:'标注规范.docx', k:'docx', s:0.4, t:'2026-08-27 15:20', src:'我的个人目录' }
];
var TRASH = [];   // 空态示范

var METAS = {
  'my-docs': { rows:MYDOCS, title:'我的文档' },
  'recent' : { rows:RECENT, title:'最近使用' },
  'starred': { rows:STARRED,title:'收藏' },
  'trash'  : { rows:TRASH,  title:'回收站' }
};

function kindText(it){
  if(it.f)return '文件夹';
  return it.k? (KIND[it.k]||'文件') : '文件';
}
function rowHTML(it){
  var isFolder=!!it.f;
  var k=isFolder?'folder':(it.k?it.k:'file');
  return ''+
    '<div class="read-row">'+
      '<span class="read-name'+(isFolder?' is-folder':'')+'">'+
        '<span class="read-ico">'+(isFolder?FFOLDER:FF)+'</span>'+
        '<span class="txt">'+esc(it.n)+'</span></span>'+
      '<span><span class="lk lk-'+k+'">'+kindText(it)+'</span></span>'+
      '<span class="read-size">'+(isFolder?'—':toSize(it.s))+'</span>'+
      '<span class="read-time">'+esc(it.t||'—')+'</span>'+
      '<span class="read-src">'+esc(it.src||'—')+'</span>'+
    '</div>';
}

function setActiveNav(){
  var node=document.querySelector('.nav-item[data-nav="'+current+'"]');
  if(!node)return;
  var all=document.querySelectorAll('.nav-item');
  for(var i=0;i<all.length;i++)all[i].classList.remove('nav-item--on');
  node.classList.add('nav-item--on');
}
function emptyHTML(){
  var txt = '回收站是空的';
  var sub = '被删除的文件会保留在这里，直到清空回收站';
  return '<div class="read-empty">'+
      '<img class="empty-art" src="../meyougengduo.png" alt="" loading="lazy"/>'+
      '<div class="empty-txt">'+txt+'</div>'+
      '<div class="empty-sub">'+sub+'</div>'+
    '</div>';
}
function buildList(){
  var wrap=$('listBody'); if(!wrap)return;
  var meta=METAS[current]||{rows:[]};
  var t=$('listTitle')||$('listTitle2'); if(t)t.textContent=meta.title||'';
  var cnt=$('listCount'); if(cnt)cnt.textContent=meta.rows.length+' 项';
  var src='';
  if(!meta.rows.length){ src=emptyHTML(); }
  else{ for(var i=0;i<meta.rows.length;i++) src+=rowHTML(meta.rows[i]); }
  wrap.innerHTML=src;
}
function bindNavHrefs(){
  /* 站内真实链接：若 HTML 保留 `data-nav` 但 URL 需多页跳转，由这里统一补 href。
     命名与 <a> 上的 data-href-key 对应避免误改根部门条目。 */
  document.querySelectorAll('a[data-href-key]').forEach(function(a){
    var key=a.getAttribute('data-href-key');
    if(!key||!current)return;
    var urls={
      dept:'../index.html', 'my-docs':'my-docs.html', recent:'recent.html',
      starred:'starred.html', trash:'trash.html'
    };
    var href=urls[key];
    /* 当前页所在目录内部与部门空间都不同级，统一处理相对基准 */
    if(key==='dept') href='../index.html';
    if(href)a.setAttribute('href',href);
  });
}
function boot(){
  var capText=$('idCapUsed'); if(capText)capText.textContent='已用 128.4 GB';
  var capTotal=$('idCapTotal'); if(capTotal)capTotal.textContent='500 GB';
  bindNavHrefs();
  setActiveNav();
  buildList();
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',boot);
}else{boot();}
})();
