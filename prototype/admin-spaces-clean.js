/* ================================================================
   空间管理 · 简化版
   目标：保留部门盘 → 个人盘的真实容量关系，但不把技术层级直接堆给管理员。
   页面只保留：部门选择 / 部门容量摘要 / 成员个人盘列表。
   ================================================================ */
(function(){
'use strict';
if(typeof window==='undefined'||!window.H)return;
var H=window.H, esc=H.escape;
window.Routes=window.Routes||{};
var CUR=0;

function avatar(name){
  var palette=['var(--primary)','var(--ok)','var(--warn)','#7a5ae0','#0e9b9b'];
  var h=7,i; for(i=0;i<name.length;i++)h=(h*31+name.charCodeAt(i))>>>0;
  return '<span class="member-avatar" style="background:'+palette[h%palette.length]+'">'+esc(name.charAt(0))+'</span>';
}
function gb(v){ return esc(H.gb(Math.max(Number(v||0),0))); }
function pct(used,quota){ return quota?Math.max(0,Math.min(Math.round((used||0)/quota*100),999)):0; }
function statusHtml(p){
  if(!p.quota)return '<span class="state-inline is-off"><span class="pt"></span>未设置</span>';
  var n=pct(p.used,p.quota);
  if((p.used||0)>p.quota)return '<span class="space-state is-danger">超限</span>';
  if(n>=90)return '<span class="space-state is-warn">接近上限</span>';
  return '<span class="state-inline is-ok"><span class="pt"></span>正常</span>';
}
function usageHtml(p){
  var n=pct(p.used,p.quota), w=Math.min(n,100);
  return '<span class="space-usage"><span class="space-usage__bar"><i style="width:'+w+'%"></i></span><span>'+n+'%</span></span>';
}

function render(){
  var deps=H.drvs(), home=deps[CUR]||deps[0], s=H.getDepartmentDriveStats(home.dept);
  if(!home||!s)return;

  var nav='';
  deps.forEach(function(d,i){
    var st=H.getDepartmentDriveStats(d.dept);
    nav+='<button class="sp-nav spaces-clean-nav'+(i===CUR?' sp-nav--on':'')+'" data-space-dept="'+i+'" type="button">'+
      '<span class="sp-nav__ic">'+H.i('department')+'</span>'+
      '<span class="sp-tx"><span class="sp-nav__t">'+esc(d.dept)+'</span>'+
      '<span class="sp-nav__s">已用 '+gb(st.used)+' / '+gb(st.quota)+'</span></span></button>';
  });

  var left='<div class="dtree-panel panel spaces-clean-side">'+
    '<div class="panel__head"><span class="t">部门</span><span class="u">'+deps.length+'</span></div>'+
    '<div class="dtree-body">'+nav+'</div></div>';

  var summary='<div class="spaces-clean-summary">'+
    '<div class="spaces-clean-summary__name"><span class="spaces-clean-folder">'+H.i('folder')+'</span><span><b>'+esc(home.dept)+'部门盘</b><small>'+esc(home.folderDrive||'')+'</small></span></div>'+
    '<div class="spaces-clean-metrics">'+
      '<span><small>总容量</small><b>'+gb(s.quota)+'</b></span>'+
      '<span><small>已用</small><b>'+gb(s.used)+'</b></span>'+
      '<span><small>剩余</small><b>'+gb(s.available)+'</b></span>'+
    '</div>'+
    '<div class="spaces-clean-breakdown">公共空间 '+gb(s.publicUsed)+' · 个人空间 '+gb(s.personalUsed)+' · '+s.personalDriveCount+' 名成员</div>'+
  '</div>';

  var cols=[
    {label:'成员',hcl:'col-member',cell:function(p){return '<span class="member-cell">'+avatar(p.name)+'<span class="member-info"><span class="member-name">'+esc(p.name)+'</span><span class="member-dept">个人空间</span></span></span>'; }},
    {label:'已用',w:'140px',cell:function(p){return '<span class="space-num">'+gb(p.used)+'</span>'; }},
    {label:'个人容量上限',w:'160px',cell:function(p){return '<span class="space-num"><b>'+gb(p.quota)+'</b></span>'; }},
    {label:'使用率',w:'190px',cell:function(p){return usageHtml(p); }},
    {label:'状态',w:'110px',cell:function(p){return statusHtml(p); }},
    {label:'操作',w:'90px',hcl:'col-op',cell:function(p){return '<span class="cell-actions"><a class="t-a" data-space-edit="'+esc(p.name)+'">设置容量</a></span>'; }}
  ];
  var table=H.table(s.drives||[],cols,{empty:'该部门暂无个人空间'}).outerHTML;

  var right='<div class="member-body spaces-clean-main">'+summary+'<div class="member-scroll spaces-clean-table">'+table+'</div></div>';

  H.setPage(
    '<div class="admin-page-head"><h1>空间管理</h1>'+
      '<p class="admin-page-head__desc">查看各部门空间用量，并设置成员个人空间容量上限。</p>'+
      '<div class="admin-page-head__meta">部门总容量请在「配额管理」中调整</div></div>'+
    '<div class="org-cols spaces-clean-layout"><div class="dtree-wrap">'+left+'</div>'+right+'</div>',
    bind
  );
}

function bind(){
  var page=H.root().querySelector('.a-page');
  if(!page||page.__spacesCleanBound)return;
  page.__spacesCleanBound=true;
  page.addEventListener('click',function(e){
    var d=e.target.closest&&e.target.closest('[data-space-dept]');
    if(d){ CUR=Number(d.getAttribute('data-space-dept'))||0; render(); return; }
    var a=e.target.closest&&e.target.closest('[data-space-edit]');
    if(a)editQuota(a.getAttribute('data-space-edit'));
  });
}

function editQuota(name){
  var deps=H.drvs(), home=deps[CUR]||deps[0], s=H.getDepartmentDriveStats(home.dept), found=null;
  (s.drives||[]).forEach(function(p){ if(p.name===name)found=p; });
  if(!found)return;
  var reserved=Number(found.res||0), min=Math.ceil((Number(found.used||0)+reserved)*10)/10;
  var dlg=H.dialog({
    title:'设置个人空间容量',
    msg:'<div class="space-dialog-summary"><b>'+esc(found.name)+'</b><span>'+esc(home.dept)+' · 当前已用 '+gb(found.used)+' · 部门剩余 '+gb(s.available)+'</span></div>',
    form:'<label class="form-field space-quota-field"><span class="field-label">容量上限（GB）</span><input class="inp" data-space-quota type="number" min="'+min+'" step="1" value="'+found.quota+'"></label>'+
      '<div class="field-hint">容量上限不能低于当前已用 '+gb(min)+'。调整个人上限不会改变部门总容量。</div>',
    actions:'<button class="btn btn--ghost" data-act="no">取消</button><button class="btn btn--primary" data-act="ok">保存</button>',
    onOk:function(){
      var input=dlg.scope&&dlg.scope.querySelector('[data-space-quota]'), v=Number(input&&input.value);
      if(!isFinite(v)||v<min){ H.toast('容量上限不能低于当前已用 '+gb(min)); return false; }
      H.driveUpdate(home.dept,'personalQuota',found.name,v);
      render();
      H.toast('已更新 '+found.name+' 的个人空间容量');
    }
  });
}

window.Routes['spaces']=render;
})();