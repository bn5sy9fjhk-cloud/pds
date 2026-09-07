/* 霍桐PDS · 空间成员权限 V3 DOM 整理
   不改权限业务语义，只把展示层压平为：成员列表 / 成员摘要+快捷权限 / 权限行 / 保存栏。 */
(function(){
'use strict';
if(typeof window==='undefined')return;
var Routes=window.Routes=window.Routes||{};
var raw=Routes.perms;
if(typeof raw!=='function')return;
var root=null,obs=null,timer=null;

function unwrapGrid(body){
  var grid=body&&body.querySelector('.perm-cap-grid');
  if(!grid)return;
  var parent=grid.parentNode;
  while(grid.firstChild) parent.insertBefore(grid.firstChild,grid);
  parent.removeChild(grid);
}

function enhance(){
  var page=document.querySelector('.admin-app[data-key="perms"] .a-page');
  if(!page)return;
  page.classList.remove('perm-page-v2');
  page.classList.add('perm-page-v3');

  var head=page.querySelector('.admin-page-head__desc');
  if(head)head.textContent='选择空间与成员，直接设置可用权限。';
  var meta=page.querySelector('.admin-page-head__meta');
  if(meta)meta.remove();

  var toolbarLabel=page.querySelector('.admin-toolbar .fl');
  if(toolbarLabel)toolbarLabel.textContent='空间';
  var batch=page.querySelector('[data-p="batch"]');
  if(batch)batch.textContent='批量设置';

  var sideTitle=page.querySelector('.dtree-panel>.panel__head .t');
  if(sideTitle)sideTitle.textContent='成员';

  var editorHead=page.querySelector('.pe-head');
  var presets=page.querySelector('.pe-presets');
  if(editorHead&&presets&&!editorHead.querySelector('.pe-presets')){
    presets.classList.add('pe-presets--inline');
    editorHead.appendChild(presets);
  }
  var presetLabel=page.querySelector('.pe-presets .lbl');
  if(presetLabel)presetLabel.textContent='快捷权限';

  var body=page.querySelector('.ped-body');
  if(body){
    unwrapGrid(body);
    var group=body.querySelector('.perm-group__t');
    if(group)group.remove();
    [].forEach.call(body.querySelectorAll(':scope > .capability'),function(row){row.classList.add('permission-row');});
  }

  var foot=page.querySelector('.ped-foot');
  if(foot){
    var cancel=foot.querySelector('[data-p="cancel"]');
    var save=foot.querySelector('[data-p="save"]');
    var note=foot.querySelector('.pe-save-note');
    if(cancel)cancel.textContent='恢复默认';
    if(save)save.textContent='保存';
    if(note)note.textContent='修改后点击保存生效';
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