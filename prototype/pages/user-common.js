/* 霍桐PDS · pages 公共行为层
   统一处理：顶部搜索栏、一级导航高亮、部门子项高亮。
   不处理单页业务数据。 */
(function(){
'use strict';
if(typeof document!=='object')return;

var PAGE=(document.body&&document.body.getAttribute('data-page'))||'';

function addSearch(){
  var host=document.querySelector('.topbar__center-headline');
  if(!host||host.querySelector('.page-global-search'))return;
  host.removeAttribute('aria-hidden');
  host.innerHTML=''+
    '<label class="page-global-search" id="pageGlobalSearch">'+
      '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12.4 12.4 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'+
      '<input id="pageSearchInput" type="search" autocomplete="off" spellcheck="false" placeholder="搜索文件、文件夹、图纸……" aria-label="搜索当前页面" />'+
      '<span class="search-key">Ctrl K</span>'+
    '</label>';
}

function syncMainNav(){
  var all=document.querySelectorAll('.side-nav .nav-item');
  for(var i=0;i<all.length;i++){
    var a=all[i];
    var key=a.getAttribute('data-nav')||'';
    var on=key===PAGE;
    a.classList.toggle('nav-item--on',on);
    a.classList.toggle('is-current',on);
    if(on)a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  }
}

function syncDeptNav(){
  var qs='';
  try{qs=new URLSearchParams(location.search).get('dept')||'';}catch(e){}
  var rows=document.querySelectorAll('.side-sub .tree-row');
  for(var i=0;i<rows.length;i++){
    var row=rows[i];
    var label=(row.getAttribute('data-dept')||row.textContent||'').trim();
    var on=!!qs&&label===qs;
    row.classList.toggle('is-current',on);
    if(on)row.setAttribute('aria-current','page');
    else row.removeAttribute('aria-current');
    if(!row.getAttribute('data-dept'))row.setAttribute('data-dept',label);
    if(label){
      row.setAttribute('href','../index.html?dept='+encodeURIComponent(label));
    }
  }
}

function bindSearch(){
  var inp=document.getElementById('pageSearchInput');
  if(!inp)return;
  document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&String(e.key).toLowerCase()==='k'){
      e.preventDefault();
      inp.focus();
      inp.select();
    }
    if(e.key==='Escape'&&document.activeElement===inp){inp.value='';inp.blur();filterRows('');}
  });
  inp.addEventListener('input',function(){filterRows(inp.value);});
}

function filterRows(keyword){
  var q=String(keyword||'').trim().toLowerCase();
  var rows=document.querySelectorAll('#listBody .read-row');
  var visible=0;
  for(var i=0;i<rows.length;i++){
    var txt=(rows[i].textContent||'').toLowerCase();
    var show=!q||txt.indexOf(q)!==-1;
    rows[i].style.display=show?'':'none';
    if(show)visible++;
  }
  var cnt=document.getElementById('listCount');
  if(cnt&&rows.length)cnt.textContent=(q?visible:rows.length)+' 项';
}

function boot(){
  addSearch();
  syncMainNav();
  syncDeptNav();
  bindSearch();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();
})();
