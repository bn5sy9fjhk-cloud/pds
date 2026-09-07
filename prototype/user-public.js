/* 霍桐PDS · 用户端公共 UI 增强
   统一部门空间/子目录文件夹图标；不修改目录数据和业务事件。 */
(function(){
'use strict';
if(typeof window==='undefined'||typeof document==='undefined')return;
var FOLDER='<span class="pds-folder-icon" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M2.4 5.6A1.6 1.6 0 0 1 4 4h3.1l2 2h6.8A1.6 1.6 0 0 1 17.5 7.6v7A1.5 1.5 0 0 1 16 16.1H4A1.6 1.6 0 0 1 2.4 14.5Z" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/></svg></span>';
function enhanceSideFolders(root){
  [].forEach.call((root||document).querySelectorAll('.side-sub .tree-row'),function(a){
    if(!a.querySelector('.pds-folder-icon')&&!a.querySelector('svg'))a.insertAdjacentHTML('afterbegin',FOLDER);
  });
}
function enhanceGridFolders(root){
  [].forEach.call((root||document).querySelectorAll('.grid-tile-preview'),function(p){
    var row=p.closest('.file-row');
    var type=row&&row.querySelector('.grid-tile-sub span:first-child');
    if(!type||type.textContent.trim()!=='文件夹'||p.classList.contains('is-folder-public'))return;
    p.classList.add('is-folder-public');
    p.innerHTML=FOLDER;
  });
}
function enhance(){
  enhanceSideFolders(document);
  enhanceGridFolders(document);
}
function boot(){
  enhance();
  var host=document.getElementById('fileList')||document.getElementById('listBody')||document.body;
  if(window.MutationObserver&&host){
    var ob=new MutationObserver(function(){enhanceGridFolders(host);enhanceSideFolders(document);});
    ob.observe(host,{childList:true,subtree:true});
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
