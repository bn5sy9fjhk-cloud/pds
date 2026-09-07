/* 霍桐PDS · pages 统一公共壳
   所有 pages/*.html 只保留页面标识，头部、搜索、侧栏、列表和高亮全部由本文件统一生成。
   不读取 ui-scale，不改变字号与框架尺寸。 */
(function(){
'use strict';
if(typeof document!=='object')return;

var PAGE=(document.body&&document.body.getAttribute('data-page'))||'my-docs';
var PAGE_META={
  'my-docs':{title:'我的文档',file:'my-docs.html'},
  'recent':{title:'最近使用',file:'recent.html'},
  'starred':{title:'收藏',file:'starred.html'},
  'trash':{title:'回收站',file:'trash.html'}
};
if(!PAGE_META[PAGE])PAGE='my-docs';

var DATA={
  'my-docs':[
    {folder:true,name:'我的项目归档',time:'2026-09-01 09:12',source:'我的个人目录'},
    {folder:true,name:'个人检索库',time:'2026-08-28 14:30',source:'我的个人目录'},
    {name:'标注规范.docx',kind:'docx',size:.4,time:'2026-08-27 15:20',source:'我的个人目录'}
  ],
  'recent':[
    {name:'DWG-001.dwg',kind:'dwg',size:24.6,time:'2026-09-04 10:21',source:'部门空间/研发部/产品资料/2026'},
    {name:'规格清单.xlsx',kind:'xlsx',size:.3,time:'2026-09-04 09:05',source:'部门空间/研发部/零件图库'},
    {name:'排产计划.pdf',kind:'pdf',size:2.1,time:'2026-09-03 18:42',source:'部门空间/生产部'},
    {name:'设备照片.jpg',kind:'img',size:6.2,time:'2026-09-02 16:11',source:'部门空间/研发部/产品资料/2026'},
    {name:'装配图_A2.dwg',kind:'dwg',size:12.1,time:'2026-09-03 09:10',source:'部门空间/研发部/设计图纸'}
  ],
  'starred':[
    {name:'霍桐PDS上线通知.pdf',kind:'pdf',size:.7,time:'2026-09-02 17:00',source:'部门空间/管理中心'}
  ],
  'trash':[]
};

var ICON={
  brand:'<svg viewBox="0 0 22 22" fill="none" aria-hidden="true"><rect x="3.5" y="3.5" width="15" height="15" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M11 8v6M8 11h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  search:'<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5" stroke="currentColor" stroke-width="1.6"/><path d="M12.4 12.4 16 16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  admin:'<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2.5l5 2v4.2c0 3-2 5-5 5.3-3-.3-5-2.3-5-5.3V4.5l5-2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M6 8.2l1.4 1.4L10 6.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  my:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M3 5.6 3.2 5A1.7 1.7 0 0 1 4.8 3.6h2.8l1.9 1.7h5.7A1.4 1.4 0 0 1 16.6 6.7v9.4A1.3 1.3 0 0 1 15.3 17.4H4.7A1.3 1.3 0 0 1 3.4 16L3 5.6Z"/><path d="M6 13l2.5-2L10.5 13l3-3.4" stroke-linecap="round"/></svg>',
  dept:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 5.5A1.5 1.5 0 0 1 4 4h3l2 2h7A1.5 1.5 0 0 1 17.5 7.5v7A1.5 1.5 0 0 1 16 16H4A1.5 1.5 0 0 1 2.5 14.5Z"/></svg>',
  recent:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M10 7v3l2 1.5" stroke-linecap="round"/></svg>',
  star:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="m10 3.6 1.9 3.9 4.3.6-3.1 3 .7 4.3L10 13.6l-3.8 2 .7-4.3-3.1-3 4.3-.6L10 3.6Z"/></svg>',
  trash:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h12M8 3.5h4M6 6l.6 9A1.5 1.5 0 0 0 8.1 16.5h3.8a1.5 1.5 0 0 0 1.5-1.4L14 6"/><path d="M8.5 9v4.5M11.5 9v4.5"/></svg>',
  folder:'<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 5A1.5 1.5 0 0 1 4 3.5h3l2 2H14A1.5 1.5 0 0 1 15.5 7v6A1.5 1.5 0 0 1 14 14.5H4A1.5 1.5 0 0 1 2.5 13Z"/></svg>',
  file:'<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M10 2H5A1.2 1.2 0 0 0 3.8 3.2v11.6A1.2 1.2 0 0 0 5 16h8a1.2 1.2 0 0 0 1.2-1.2V6.2L10 2Z"/><path d="M10 2v4.2h4.2"/></svg>',
  empty:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M9 16h12l4 4h14v18H9V16Z" stroke-linejoin="round"/><path d="M16 29h16" stroke-linecap="round"/></svg>'
};

function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function size(v){if(v==null)return '—';if(v>=1024)return (v/1024).toFixed(1)+' GB';if(v>=1)return (Math.round(v*10)/10)+' MB';return Math.round(v*1024)+' KB'}
function kindLabel(row){if(row.folder)return '文件夹';return {dwg:'DWG',xlsx:'表格',pdf:'PDF',img:'图片',docx:'文档'}[row.kind]||'文件'}
function navItem(key,title,icon,href){return '<a class="pages-nav-item'+(PAGE===key?' is-current':'')+'" href="'+href+'"'+(PAGE===key?' aria-current="page"':'')+'><span class="pages-nav-icon">'+icon+'</span><span>'+title+'</span></a>'}
function deptRow(name){return '<li><a class="pages-dept-row" href="../index.html?dept='+encodeURIComponent(name)+'"><span class="pages-dept-icon">'+ICON.folder+'</span><span>'+name+'</span></a></li>'}

function shell(){
  var meta=PAGE_META[PAGE];
  return '<div class="pages-app">'+
    '<header class="pages-topbar">'+
      '<div class="pages-topbar-left"><span class="pages-brand-mark">'+ICON.brand+'</span><span class="pages-brand-name">霍桐PDS</span><span class="pages-brand-sep"></span><span class="pages-breadcrumb">'+meta.title+'</span></div>'+
      '<div class="pages-search-wrap"><label class="pages-search">'+ICON.search+'<input id="pagesSearchInput" type="search" autocomplete="off" spellcheck="false" placeholder="搜索文件、文件夹、图纸……" aria-label="搜索当前页面"><span class="pages-search-key">Ctrl K</span></label></div>'+
      '<div class="pages-topbar-right"><a class="pages-admin-entry" href="../admin/overview.html">'+ICON.admin+'<span>管理中心</span></a><span class="pages-user"><span class="pages-avatar">张</span><span>张研</span></span></div>'+
    '</header>'+
    '<div class="pages-layout">'+
      '<aside class="pages-sidebar">'+
        '<nav class="pages-side-nav" aria-label="主导航">'+
          navItem('my-docs','我的文档',ICON.my,'my-docs.html')+
          navItem('dept','部门空间',ICON.dept,'../index.html')+
          navItem('recent','最近使用',ICON.recent,'recent.html')+
          navItem('starred','收藏',ICON.star,'starred.html')+
          navItem('trash','回收站',ICON.trash,'trash.html')+
        '</nav>'+
        '<section class="pages-side-block"><p class="pages-side-label">部门空间</p><ul class="pages-dept-list">'+deptRow('研发部')+deptRow('生产部')+deptRow('销售部')+'</ul></section>'+
        '<div class="pages-side-footer"><p class="pages-side-label">空间使用情况</p><div class="pages-capacity-label"><span>已用 128.4 GB</span><span>500 GB</span></div><div class="pages-capacity-track"><i class="pages-capacity-fill"></i></div></div>'+
      '</aside>'+
      '<main class="pages-main"><div class="pages-main-toolbar"><span class="pages-main-title">'+meta.title+'</span><span class="pages-main-count" id="pagesListCount">0 项</span></div><section class="pages-file-panel"><div class="pages-grid pages-head"><div>名称</div><div>类型</div><div>大小</div><div>修改时间</div><div>来源</div></div><div class="pages-list-scroll"><div class="pages-list" id="pagesList"></div></div></section></main>'+
    '</div>'+
  '</div>';
}

function rowHTML(row){
  var folder=!!row.folder,kind=folder?'folder':(row.kind||'file');
  return '<div class="pages-row" data-search="'+esc([row.name,kindLabel(row),row.time,row.source].join(' ').toLowerCase())+'">'+
    '<div class="pages-name"><span class="pages-file-icon'+(folder?' folder':'')+'">'+(folder?ICON.folder:ICON.file)+'</span><span>'+esc(row.name)+'</span></div>'+
    '<div><span class="pages-tag '+esc(kind)+'">'+kindLabel(row)+'</span></div>'+
    '<div class="pages-size">'+(folder?'—':size(row.size))+'</div>'+
    '<div class="pages-time">'+esc(row.time||'—')+'</div>'+
    '<div class="pages-source">'+esc(row.source||'—')+'</div>'+
  '</div>';
}

function renderRows(filter){
  var host=document.getElementById('pagesList');
  var cnt=document.getElementById('pagesListCount');
  if(!host||!cnt)return;
  var q=String(filter||'').trim().toLowerCase();
  var rows=DATA[PAGE]||[];
  if(!rows.length){host.innerHTML='<div class="pages-empty">'+ICON.empty+'<div class="pages-empty-title">回收站是空的</div><div class="pages-empty-sub">被删除的文件会保留在这里，直到清空回收站</div></div>';cnt.textContent='0 项';return}
  var out=[],visible=0;
  rows.forEach(function(row){var hay=[row.name,kindLabel(row),row.time,row.source].join(' ').toLowerCase();if(!q||hay.indexOf(q)!==-1){out.push(rowHTML(row));visible++}});
  if(!visible&&q){host.innerHTML='<div class="pages-empty">'+ICON.search+'<div class="pages-empty-title">没有找到匹配内容</div><div class="pages-empty-sub">请尝试其他关键词</div></div>'}else{host.innerHTML=out.join('')}
  cnt.textContent=visible+' 项';
}

function bindSearch(){
  var input=document.getElementById('pagesSearchInput');if(!input)return;
  input.addEventListener('input',function(){renderRows(input.value)});
  document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&String(e.key).toLowerCase()==='k'){e.preventDefault();input.focus();input.select()}
    if(e.key==='Escape'&&document.activeElement===input){input.value='';renderRows('');input.blur()}
  });
}

function boot(){
  var app=document.getElementById('pagesApp');if(!app)return;
  app.innerHTML=shell();
  document.title='霍桐PDS · '+PAGE_META[PAGE].title;
  renderRows('');
  bindSearch();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
