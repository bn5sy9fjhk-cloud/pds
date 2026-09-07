/* 霍桐PDS · 空间成员权限 V2 DOM 增强
   不改权限业务语义，只压平渲染层级。 */
(function(){
'use strict';
if(typeof window==='undefined')return;
var Routes=window.Routes=window.Routes||{};
var raw=Routes.perms;
if(typeof raw!=='function')return;
var root=null,obs=null,timer=null;
function enhance(){
  var page=document.querySelector('.admin-app[data-key="perms"] .a-page');
  if(!page)return;
  page.classList.add('perm-page-v2');
  var batch=page.querySelector('[data-p="batch"]');
  if(batch)batch.textContent='批量设置';
  var group=page.querySelector('.perm-group__t');
  if(group)group.textContent='文件权限';
  var foot=page.querySelector('.ped-foot');
  if(foot){
    var cancel=foot.querySelector('[data-p="cancel"]');
    var save=foot.querySelector('[data-p="save"]');
    var note=foot.querySelector('.pe-save-note');
    if(cancel)cancel.textContent='恢复默认';
    if(save)save.textContent='保存权限';
    if(note)note.textContent='修改后保存即可生效';
  }
  var body=page.querySelector('.ped-body');
  if(body&&!body.querySelector('.perm-cap-grid')){
    var caps=[].slice.call(body.querySelectorAll(':scope > .capability'));
    if(caps.length){
      var grid=document.createElement('div');
      grid.className='perm-cap-grid';
      var danger=body.querySelector(':scope > .pd-danger');
      caps.forEach(function(n){grid.appendChild(n);});
      if(danger)body.insertBefore(grid,danger); else body.appendChild(grid);
    }
  }
}
function schedule(){
  if(timer)clearTimeout(timer);
  timer=setTimeout(enhance,0);
}
Routes.perms=function(){
  var ret=raw.apply(this,arguments);
  enhance();
  root=document.getElementById('aPageRoot');
  if(root&&!obs){
    obs=new MutationObserver(schedule);
    obs.observe(root,{childList:true,subtree:true});
  }
  return ret;
};
})();