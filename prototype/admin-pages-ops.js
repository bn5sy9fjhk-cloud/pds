/* ================================================================
   霍桐PDS · 管理端「运营与治理」页面模块  admin-pages-ops.js
   路由：overview 平台概览 / org 组织与成员 / spaces 空间管理 / perms 空间成员权限
   依赖：admin-core.js(window.H) · admin.css · ui-base.css（复用令牌，无裸色值）
   约定：不引第三方 / 不写持久化；全部数据为上提的本地 mock 常量（演示约定，
        非后端实时量），刷新即还原。替换数据仅需改各页面数据数组。
   ================================================================ */
(function(){
'use strict';
var H=window.H, esc=H.escape, ic=H.i, IC=H.IC;
window.Routes=window.Routes||{};
function pg(){ return H.root().querySelector('.a-page')||H.root(); }
function avatar(nm,cls){
  var AV=['var(--primary)','var(--ok)','var(--warn)','var(--danger)','#7a5ae0','#0e9b9b'];
  var h=7,i; for(i=0;i<nm.length;i++)h=(h*31+nm.charCodeAt(i))>>>0;
  return '<span class="'+(cls||'mem-avatar')+'" style="background:'+AV[h%AV.length]+'">'+esc(nm.charAt(0))+'</span>';
}

/* ============ 1) overview · 平台概览 · 演示 mock 数组即数据源 ============ */
var OV={
  kpi:[
    { k:'用户总数', v:'258',   d:'+12 近30日' },
    { k:'部门数',   v:'12',    d:'全部启用' },
    { k:'空间数',   v:'31',    d:'25 在用' },
    { k:'总配额',   v:'26', u:'TB', d:'已分配 24.3 TB' }
  ],
  cap:{ used:11.8, reserved:2.1, avail:12.1 },   // 三段和 = 26 TB
  drives:[
    { n:'研发部 部门盘',  used:5119, rev:0,   quota:10400 },
    { n:'生产部 部门盘',  used:1716, rev:410, quota:5175 },
    { n:'个人盘 · 张研',  used:238,  rev:0,   quota:1990 },
    { n:'管理中心 空间',  used:272,  rev:0,   quota:3400 }
  ],
  days:['09/01','09/02','09/03','09/04','09/05','09/06','09/07'],
  pts:[0.61,0.55,0.70,0.64,0.78,0.72,0.91],      // TB/日
  total:'近 7 日 4.2 TB', delta:'↑12%',
  acts:[
    { a:'系统管理员 张研', t:'关闭空间 · 生产部 · 已用超限告警', s:'今天 09:41', k:'warn' },
    { a:'用户 李明',       t:'上传 · 资源 /研发部/产品资料/DWG-041-工装.dwg', s:'今天 09:12', k:'up' },
    { a:'部门管理员 王磊', t:'初始化空间 · 新业务部（默认配额「部门盘 500 GB」）', s:'昨天 17:26', k:'x' },
    { a:'用户 周敏',       t:'移动 · 跨盘 /生产部/图纸 → /管理中心/文件', s:'昨天 15:03', k:'recycle' },
    { a:'平台管理员 张研', t:'变更成员权限 · 空间/研发部 · 李明 → 协作者', s:'昨天 11:48', k:'shield' },
    { a:'系统 密钥网关',   t:'轮换 · 应用密钥到期并自动重签', s:'昨天 10:02', k:'key' }
  ],
  alerts:[
    { k:'tag--danger', t:'1 个异步生成任务失败（预览渲染）· 待人工介入', m:'最近一次 09:20' },
    { k:'tag--danger', t:'对象预览失败率 2.4%（近 1h）· 网关判断为解析超时', m:'需重试' },
    { k:'tag--warn',   t:'平台管理员密钥 2 日后到期 · 已排队自动续期', m:'到期 09/08' }
  ]
};
function ovC3(){
  var u=+(OV.cap.used/26*100).toFixed(1), r=+(OV.cap.reserved/26*100).toFixed(1), a=(100-u-r).toFixed(1);
  return '<div class="c-flow"><div class="c3-legend" style="justify-content:flex-start;margin-bottom:6px;padding:0">'+
    '<span class="li"><span class="sw" style="background:var(--primary)"></span>已用 '+OV.cap.used+' TB</span>'+
    '<span class="li"><span class="sw" style="background:var(--warn)"></span>已预留 '+OV.cap.reserved+' TB</span>'+
    '<span class="li"><span class="sw" style="background:var(--color-border-light)"></span>可用 '+OV.cap.avail+' TB</span></div>'+
    '<span class="c3-track">'+
      '<span class="c3-seg c3-used"  style="width:'+u+'%" title="已用 11.8 TB"></span>'+
      '<span class="c3-seg c3-resv"  style="width:'+r+'%" title="已预留 2.1 TB"></span>'+
      '<span class="c3-seg c3-avail" style="width:'+a+'%" title="可用 12.1 TB"></span></span></div>';
}
function ovSpaces(){
  var s='';
  OV.drives.forEach(function(d){
    var uc=d.used/d.quota*100, rw=d.rev/Math.max(d.rev,0)&&d.rev?Math.min(d.rev/d.quota*100,100-uc):0;
    var pct=Math.min(uc+rw,100).toFixed(0);
    var title='已用 '+esc(H.fgb(d.used))+' · 预留 '+esc(H.fgb(d.rev))+' · 配额 '+esc(H.fgb(d.quota));
    s+='<div class="spacestrip" title="'+title+'"><span class="nm">'+ic(IC.recycle)+esc(d.n)+'</span>'+
      '<span class="bar">'+(d.used>0?'<i class="bu" style="width:'+uc.toFixed(1)+'%"></i>':'')+
      (d.rev?'<i class="br" style="width:'+rw.toFixed(1)+'%"></i>':'')+'</span>'+
      '<span class="cnt">'+pct+'%</span></div>';
  });
  return s;
}
function ovTrend(){
  var W=470,HH=160,m=18,t=10,b=HH-28,pts=OV.pts;
  var mn=Math.min.apply(null,pts),mx=Math.max.apply(null,pts),rg=(mx-mn)||0.01;
  function X(i){return m+(W-2*m)*(i/(pts.length-1));}
  function Y(v){return b-((b-t)*((v-mn)/rg));}
  var poly=[],line=[];
  pts.forEach(function(v,i){ poly.push(X(i).toFixed(0)+','+Y(v).toFixed(0)); line.push((i?'L':'M')+X(i).toFixed(0)+' '+Y(v).toFixed(0)); });
  var gid='o'+Math.floor(Math.random()*1000);
  return '<svg viewBox="0 0 '+W+' '+HH+'" style="display:block;width:100%;height:auto" role="img" aria-label="近7日上传量趋势（TB/日）">'+
    '<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--primary)" stop-opacity=".16"/><stop offset="1" stop-color="var(--primary)" stop-opacity="0"/></linearGradient></defs>'+
    '<polygon fill="url(#'+gid+')" points="'+X(0).toFixed(0)+','+b+' '+poly.join(' ')+' '+X(pts.length-1).toFixed(0)+','+b+'"/>'+
    '<polyline fill="none" stroke="var(--primary)" stroke-width="1.8" stroke-linecap="round" points="'+line.join(' ')+'"/></svg>';
}
function Routes_overview(){
  var st='',acts='',al='',dax='';
  OV.kpi.forEach(function(x){ st+='<div class="numstat"><div class="k">'+esc(x.k)+'</div><div class="v">'+esc(x.v)+(x.u?'<small>'+esc(x.u)+'</small>':'')+'</div><div class="d">'+esc(x.d)+'</div></div>'; });
  OV.acts.forEach(function(a){ acts+='<div class="recent-item"><span class="ri-ico">'+ic(IC[a.k]||IC.shield)+'</span>'+
      '<div class="rText"><div class="rMain"><b>'+esc(a.a)+'</b></div><div class="rSub">'+esc(a.t)+'</div></div>'+
      '<span class="rTime">'+esc(a.s)+'</span></div>'; });
  OV.alerts.forEach(function(x){ al+='<div class="alert-item">'+
      '<span class="tag '+(x.k==='tag--warn'?'tag--warn':'tag--danger')+'">'+(x.k==='tag--warn'?'提醒':'告警')+'</span>'+
      '<span class="alert-t">'+esc(x.t)+
      '<span class="u-faint blk">'+esc(x.m)+'</span></span></div>'; });
  OV.days.forEach(function(d){ dax+='<span>'+esc(d)+'</span>'; });
  H.setPage(
    '<div class="admin-page-head"><h1>平台概览</h1>'+
      '<p class="admin-page-head__desc">空间 / 配额 / 告警与近期治理活动的平台级总览。</p>'+
      '<div class="admin-page-head__meta"><span class="agg-dot is-mock">'+H.i('info')+'</span>mock 演示快照 · 与 H.drvs 同源，非后端实时量</div></div>'+
    '<div class="num-strip">'+st+'</div>'+
    '<div class="cap3">'+ovC3()+'</div>'+
    '<div class="o-grid">'+
      '<div class="o-col">'+
        '<div class="panel"><div class="panel__head"><span class="t">空间用量 Top</span><span class="u">hover 可见 used / reserved / quota</span></div>'+
          '<div class="panel__body">'+ovSpaces()+'</div></div>'+
        '<div class="panel"><div class="panel__head"><span class="t">近7日上传量</span><span class="u">细趋势 · 单图</span></div>'+
          '<div class="tv-body"><div class="trend-head"><span class="big">'+esc(OV.total)+'</span><span class="up">&nbsp;'+esc(OV.delta)+'</span></div>'+
          ovTrend()+'<div class="trend-axis">'+dax+'</div></div></div>'+
      '</div>'+
      '<div class="o-col">'+
        '<div class="panel"><div class="panel__head"><span class="t">近期活动</span><span class="u">审计事件</span></div>'+
          '<div class="panel__body">'+acts+'</div></div>'+
        '<div class="panel"><div class="panel__head"><span class="t">告警与到期提醒</span><span class="u">一次性</span></div>'+
          '<div class="panel__body" style="padding:2px 14px 8px">'+al+'</div></div>'+
      '</div>'+
    '</div>');
}
Routes['overview']=Routes_overview;
/* ============ 2) org · 组织与成员 · 演示 mock ============ */
var ORG={
  tree:[
    { n:'总公司', c:258, sub:[
      { n:'研发部', c:126, sub:[ {n:'产品技术组',c:58},{n:'工艺设计组',c:30},{n:'测试验证组',c:38} ] },
      { n:'生产部', c:84,  sub:[ {n:'装配车间',c:52},{n:'质检组',c:32} ] },
      { n:'销售部', c:31 },
      { n:'管理中心', c:17, sub:[ {n:'行政',c:9},{n:'IT运维',c:8} ] }
    ]}
  ],
  roles:{ '平台管理员':'tag--primary', '部门管理员':'tag--warn', '成员':'tag--plain' },
  members:[
    { n:'张研', dept:'管理中心', role:'平台管理员', st:'ok',  ph:'138****2101', sp:2, last:'今天 09:32' },
    { n:'王磊', dept:'研发部',   role:'部门管理员', st:'ok',  ph:'139****7344', sp:2, last:'今天 08:47' },
    { n:'李明', dept:'研发部',   role:'成员',       st:'ok',  ph:'137****9812', sp:3, last:'昨天 21:15' },
    { n:'赵志', dept:'生产部',   role:'部门管理员', st:'ok',  ph:'150****2246', sp:1, last:'昨天 17:30' },
    { n:'周敏', dept:'管理中心', role:'部门管理员', st:'ok',  ph:'136****3308', sp:4, last:'09/05 16:02' },
    { n:'孙丽', dept:'销售部',   role:'成员',       st:'off', ph:'158****6642', sp:0, last:'09/01 10:44' }
  ]
};
function orgTreeHtml(){
  var out='';
  function walk(g,lv){
    var open=(g.sub&&g.sub.length)?' is-open':'';
    var lead=(lv===0)?' dt-row--on':'';
    var arrow=(g.sub&&g.sub.length)
      ? '<span class="dt-arrow">'+H.i('chevronRight')+'</span>'
      : '<span class="dt-arrow is-end"></span>';
    out+='<div class="dt-row'+open+lead+'" data-depth="'+lv+'" '+
      'style="padding-left:'+((lv?10:6)+lv*14)+'px" data-org="'+esc(g.n)+'" data-leaf="'+((g.sub&&g.sub.length)?0:1)+'">'+
      arrow+'<span class="dt-folder">'+H.i(g.sub&&g.sub.length?'department':'user')+'</span>'+
      '<span class="dt-name">'+esc(g.n)+'</span><span class="dt-count">'+esc(String(g.c))+'</span></div>';
    if(g.sub) g.sub.forEach(function(s2){ walk(s2,lv+1); });
  }
  ORG.tree.forEach(function(t){ walk(t,0); });
  return out;
}
function orgRoleText(r){ /* 成员类型为弱辅助，仅三种可控 */
  return '<span class="chip-inline '+(r==='平台管理员'?'is-admin':(r==='部门管理员'?'is-dep':'is-member'))+'">'+esc(r)+'</span>';
}
function orgStatCell(m){
  return m.st==='ok'
    ? '<span class="state-inline is-ok"><span class="pt"></span>在职</span>'
    : '<span class="state-inline is-off"><span class="pt"></span>停用</span>';
}
function orgMemberCell(m){
  return '<span class="member-cell">'+avatar(m.n,'member-avatar')+
    '<span class="member-info"><span class="member-name">'+esc(m.n)+'</span>'+
    '<span class="member-dept">'+esc(m.dept)+'</span></span></span>';
}
function orgRowMore(m){
  return '<span class="rest cell-actions"><button class="icon-btn icon-btn--small table-more" data-om="menu" data-name="'+esc(m.n)+'" title="更多操作">'+H.i('more')+'</button></span>';
}
function Routes_org(){
  var cols=[
    { label:'成员', w:'30%', hcl:'col-member', cell:function(m){ return orgMemberCell(m); } },
    { label:'成员类型', w:'150px', hcl:'col-role', cell:function(m){ return orgRoleText(m.role); } },
    { label:'状态', w:'100px', hcl:'col-stat', cell:function(m){ return orgStatCell(m); } },
    { label:'空间', w:'96px', hcl:'col-space', cell:function(m){ return esc(String(m.sp))+' <span class="k-unit">个</span>'; } },
    { label:'最近登录', w:'158px', hcl:'col-last', cell:function(m){ return '<span class="last-c">'+esc(m.last)+'</span>'; } },
    { label:'', head:'', w:'58px', hcl:'col-op', cell:function(m){ return orgRowMore(m); } }
  ];
  var tbl=H.table(ORG.members,cols,{empty:'无成员'}).outerHTML;
  H.setPage(
    '<div class="admin-page-head"><h1>组织与成员</h1>'+
      '<p class="admin-page-head__desc">管理企业组织架构、成员状态与角色。</p>'+
      '<div class="admin-page-head__meta"><span class="agg-dot is-mock">'+H.i('info')+'</span>组织名称/成员数据按后端组织服务为准</div></div>'+
    '<div class="admin-toolbar"><div class="toolbar-left">'+
      '<button class="btn btn--primary" data-om="add">'+H.i('userAdd')+'<span>添加成员</span></button>'+
      '<button class="btn btn--ghost" data-om="sync">'+H.i('sync')+'<span>从钉钉同步</span></button></div>'+
      '<div class="toolbar-right">'+
        '<div class="kw-wrap">'+H.i('search')+'<input class="inp kw-input" data-om="kw" type="search" placeholder="搜索姓名 / 部门"></div>'+
        '<select class="sel st-sel" data-om="status"><option value="">全部状态</option><option value="ok">在职</option><option value="off">停用</option></select>'+
      '</div></div>'+
    '<div class="org-cols"><div class="dtree-panel panel"><div class="panel__head"><span class="t">组织架构</span>'+
      '<span class="u">'+esc(String(258))+' 人</span></div>'+
      '<div class="dtree-body" data-tree>'+orgTreeHtml()+'</div></div>'+
      '<div class="member-body"><div class="member-scroll" data-mwrap><div class="x-table member-dense">'+tbl+
      '</div></div></div></div>', orgBind);
}
function orgBind(){
  var page=pg(),tree=page.querySelector('[data-tree]');
  if(tree) tree.addEventListener('click',function(e){
    var d=e.target.closest?e.target.closest('.dt-row'):null; if(!d)return;
    [].forEach.call(tree.querySelectorAll('.dt-row'),function(x){x.classList.remove('dt-row--on');});
    d.classList.add('dt-row--on');
    if(d.getAttribute('data-leaf')==='1') H.toast('此为按需 / 演示目录：'+(d.getAttribute('data-org')||'')+'（真实数据来自后端组织）');
  });
  orgWireFilters(page);
}
function orgWireFilters(page){
  var kw=page.querySelector('[data-om="kw"]'), st=page.querySelector('[data-om="status"]');
  var run=function(){ orgFilterRows(page); };
  if(kw)kw.addEventListener('input',run);
  if(st)st.addEventListener('change',run);
  page.addEventListener('click',function(e){
    var o=e.target.closest?e.target.closest('[data-om]'):null;
    if(!o)return;
    if(o===kw||o===st)return;
    if(o.closest('[data-tree]'))return;
    orgAct(o.getAttribute('data-om'),o.getAttribute('data-name'),o);
  });
}
function orgFilterRows(page){
  var host=page.querySelector('[data-mwrap] .table-x tbody'); if(!host)return;
  var kw=page.querySelector('[data-om="kw"]').value.trim().toLowerCase();
  var st=page.querySelector('[data-om="status"]').value;
  var trs=host.querySelectorAll('tr');
  ORG.members.forEach(function(m,i){
    var pass=true;
    if(st==='ok'&&m.st!=='ok')pass=false;
    if(st==='off'&&m.st!=='off')pass=false;
    if(pass&&kw&&(m.n+m.dept+m.ph).toLowerCase().indexOf(kw)<0)pass=false;
    if(trs[i])trs[i].style.display=pass?'':'none';
  });
}
function orgMember(name){ var i; for(i=0;i<ORG.members.length;i++)if(ORG.members[i].n===name)return ORG.members[i]; return null; }
function orgAct(v,name){
  if(v==='add'){ H.toast('添加成员（钉钉）：演示将打开钉钉通讯录选择；真实后端从钉钉同步（静态 mock，未持久化）'); return; }
  if(v==='sync'){ H.toast('已触发一次从钉钉同步（演示端点：后端将拉取部门 / 成员增量）'); return; }
  if(v==='menu'){ var m=orgMember(name); if(m)orgMenu(m); }
}
function orgMenu(m){
  var anchor=document.querySelector('[data-om="menu"][data-name="'+esc(m.n)+'"]');
  var r=anchor&&anchor.getBoundingClientRect();
  H.float(Math.min(innerWidth-228,(r?r.right+4:innerWidth-231)),(r?r.bottom+2:innerHeight-180),[
    { icon:IC.book, label:'查看详情', fn:function(){ orgDetail(m); } },
    { icon:IC.x,    label:m.st==='ok'?'停用账户':'启用账户', fn:function(){ orgToggle(m); } },
    { icon:IC.shield,label:'设为部门管理员', fn:function(){ H.toast('原型交互：设定 '+m.n+' 为部门管理员（演示端点，真实按组织角色校验）'); } },
    { sep:1 },
    { icon:IC.key, label:'重置密码', fn:function(){ H.toast('已向 '+m.n+' 发送重置密码指引（演示）'); } },
    { icon:IC.recycle, label:'重置鉴权（密钥类）', danger:true, fn:function(){ orgResetAuth(m); } }
  ]);
}
function orgDetail(m){
  H.drawer({ title:m.n+' · 详情（演示）', body:
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">'+avatar(m.n)+
      '<div><div style="font-weight:600">'+esc(m.n)+'</div><div class="u-faint" style="font-size:12px">'+esc(m.dept)+' · '+esc(m.role)+'</div></div></div>'+
    H.kv({ '部门':esc(m.dept),'成员类型':esc(m.role),'手机号':esc(m.ph),
      '在职状态':m.st==='ok'?'在职':'停用','所属空间数':String(m.sp),'最近登录':esc(m.last),
      '说明':'演示性基础信息；真实账号 / 任职 / 角色归属以后端组织为准。' }) });
}
function orgToggle(m){
  if(m.st==='off'){ m.st='ok'; Routes_org(); H.toast('已启用 '+m.n+' 的账户（演示）'); return; }
  H.confirm('停用账户',
    '确认停用 <b>'+esc(m.n)+'</b>？<br><br>账户停用后，其已有 JWT token（含已在多端登录的会话）立即失效；'+
    '该成员在各空间的成员关系不会据此解除，也不影响同空间中其他成员的权限（成员关系为独立维度）。<br><br>属演示危险操作，需再次确认。',
    function(){ m.st='off'; Routes_org(); H.toast('账户 '+m.n+' 已停用（演示），其 token 随即失效'); },
    { kicker:'停用账户 · 涉及访问安全' });
}
function orgResetAuth(m){
  H.confirm('重置鉴权（密钥）',
    '将吊销 '+esc(m.n)+' 当前会话鉴权材料并重新发放密钥；重置后其既有 JWT token 立即失效。<br>属演示危险操作，需再次确认。',
    function(){ H.toast('已重置 '+m.n+' 的鉴权与密钥（演示）；既有 token 已失效'); },
    { kicker:'重置鉴权 · 涉及访问安全' });
}
Routes['org']=function(){ Routes_org(); };

/* ============ 3) spaces · 空间 / 配额（父子容量，同一 H.drvs 源） ============ */
var SPCUR=0;
function Routes_spaces(){
  var deps=H.drvs(), home=deps[SPCUR]||deps[0], s=H.getDepartmentDriveStats(home.dept);
  function gb(x){ return esc(H.gb(Math.max(Number((x)||0),0))); }
  function segPct(x){ return s.quota?Math.max(0,Math.min((x||0)/s.quota*100,100)):0; }
  var track='<span class="c3-track">';
  var u=Math.min(segPct(s.used),100); var r=Math.min(segPct(s.reserved),100-u); var avail=Math.max(0,100-u-r);
  if(s.used)track+='<span class="c3-seg c3-used" style="width:'+u.toFixed(1)+'%"></span>';
  if(s.reserved)track+='<span class="c3-seg c3-resv" style="width:'+r.toFixed(1)+'%"></span>';
  if(avail>0.01)track+='<span class="c3-seg c3-avail" style="width:'+avail.toFixed(1)+'%"></span>';
  track+='</span>';
  var nav=''; deps.forEach(function(d,i){
    nav+='<button class="sp-nav'+(i===SPCUR?' sp-nav--on':'')+'" data-sp="pick" data-i="'+i+'" type="button">'+
      '<span class="sp-nav__ic">'+ic(IC.folder)+'</span><span class="sp-tx">'+
      '<span class="sp-nav__t">'+esc(d.dept)+' 部门盘</span><span class="sp-nav__s">'+esc(d.folderDrive)+'</span></span></button>';
  });
  var left='<div class="dtree-panel panel"><div class="panel__head"><span class="t">部门盘（父）</span>'+
    '<span class="u">'+esc(String(deps.length))+' 个</span></div>'+
    '<div class="dtree-body" data-mwrap>'+nav+'</div><div class="sp-foot">'+ic(IC.folder)+' 父子容量共享 H.drvs 源</div></div>';
  var pub=home.public||{};
  var childQ=+(s.drives||[]).reduce(function(x,y){return x+(Number(y.quota)||0);},0);
  var mStat=function(lab,val,sw){ return '<span class="cf kv"><span class="cf-dot" style="background:'+sw+'"></span><span class="cf-tx"><span>'+lab+'</span><b>'+val+'</b></span></span>'; };
  var sumMetrics=
    mStat('父 quotaBytes（单一来源）',gb(s.quota),'var(--text-1)')+
    mStat('已用 · 父子合计',gb(s.used),'var(--primary)')+
    mStat('预留',gb(s.reserved),'var(--warn)')+
    mStat('可用',gb(s.available),'var(--color-border-light)')+
    mStat('子层总量',gb(childQ),'var(--text-3)');
  var scopeBand=
    '<div class="scope-head">'+
      '<span class="scope-ic">'+ic(IC.folder)+'</span>'+
      '<span class="cell-stack"><b>'+esc(home.dept)+' · 部门盘（父）</b>'+
        '<span class="u-faint">'+esc(home.folderDrive||'')+' · platform H.drvs 单源父 quotaBytes · 满额风险在下方成员行以状态给出</span></span>'+
      '<span class="sf-metrics">'+sumMetrics+'</span></div>';
  function driveUsage(pp){
    var pu=pp.quota?Math.min((pp.used||0)/pp.quota*100,100):0;
    var pc=pp.quota?Math.min(Math.round((pp.used||0)/pp.quota*100),999):0;
    var over=pp.used>pp.quota;
    var st=!pp.quota?'<span class="tr-st tr-st-idle">未设配额</span>':over?'<span class="tr-st tr-st-danger">超限</span>':(pc>=90?'<span class="tr-st tr-st-warn">近满 '+pc+'%</span>':'<span class="tr-st tr-st-ok">正常</span>');
    return '<span class="pc-bar">'+
        '<span class="dq-bar">'+(pp.used?'<i style="background:'+(over?'var(--danger)':'var(--primary)')+';width:'+pu.toFixed(1)+'%"></i>':'')+'</span>'+
        '<span class="x-nums">'+gb(pp.used)+' / '+gb(pp.quota)+' GB</span>'+
      '</span><span class="col-badge">'+st+'</span>';
  }
  var cols=[
    { label:'成员', hcl:'col-member', cell:function(pp){ return '<span class="member-cell">'+avatar(pp.name,'member-avatar')+
        '<span class="member-info"><span class="member-name">'+esc(pp.name)+'</span>'+
        '<span class="member-dept">个人子盘 · '+esc(home.folderDrive||'')+'</span></span></span>'; } },
    { label:'层级 / 绑定', w:'210px', cls:'col-dir', cell:function(pp){
        return '<span class="cell-stack"><b>个人盘</b><span class="u-faint">'+esc(home.dept)+' / '+esc(home.folderDrive)+'</span></span>'; } },
    { label:'个人 quotaBytes', w:'128px', hcl:'col-num col-q', cell:function(pp){ return '<b>'+gb(pp.quota)+'</b> <span class="u-faint">GB</span>'; } },
    { label:'用量 / 状态', w:'236px', cls:'col-used', cell:function(pp){ return driveUsage(pp); } },
    { label:'操作', w:'84px', hcl:'col-op', cell:function(pp){ return '<span class="cell-actions"><a class="t-a" data-sa="pq" data-dep="'+esc(home.dept)+'" data-person="'+esc(pp.name)+'">编辑</a></span>'; } }
  ];
  var child=(s.drives||[]).length?'<span class="panel__head pc-head">'+
      '<span class="t">成员个人盘（child quotaBytes）</span><span class="u">'+esc(String(s.personalDriveCount))+' 个 · 说明：若 {{上逾}} 忽略上方总和符号，单一 parent quotaBytes 不作个人之和强绑定</span></span>'+
      H.table(s.drives,cols).outerHTML
    : '<div class="empty-guide">该部门暂无个人子盘 — 可在上层「部门盘 quota」内初始化成员个人盘。</div>';
  var publicLine='<div class="public-line">'+avatar('公共','member-avatar member-avatar--plain')+
      '<span class="cell-stack"><span class="tc"><b>公共子盘（只读）</b>'+ic(IC.info)+'</span>'+
      '<span class="u-faint">'+esc(pub.name||'共享区')+' · 公共文件父目录由空间级权限控制，不随个人盘编辑联动 · quota '+gb(pub.quota)+' GB.</span></span></div>';
  var body=publicLine+
    '<div class="child-zone" data-mwrap-child>'+child+'</div>';
  var tb='<div class="admin-toolbar"><div class="toolbar-left">'+
      '<span class="tb-accent">'+ic(IC.folder)+'已选：<b>'+esc(home.dept)+' 部门盘</b></span>'+
      '<span class="u-faint">个人盘为父 quotaBytes 之下之子层资源 · 可下行逐盘编辑</span></div>'+
      '<div class="toolbar-right"><span class="u">公共子盘绑定 = 唯一共享父目录 · 不随个人编辑联动</span></div></div>';
  H.setPage(
    '<div class="admin-page-head"><h1>空间管理</h1>'+
      '<p class="admin-page-head__desc">按部门组织个人 / 公共子盘的父子磁盘关系，并在同源 H.drvs 上维护个人盘 quotaBytes。</p>'+
      '<div class="admin-page-head__meta"><span class="agg-dot is-mock">'+H.i('info')+'</span>父 quotaBytes 为平台侧单一来源；本页仅在「层次/单子层」之间展示，不重复维护列表</div></div>'+
    scopeBand+
    tb+
    '<div class="org-cols"><div class="dtree-wrap">'+left+'</div>'+
      '<div class="member-body"><div class="member-scroll" data-sp="host">'+body+'</div></div></div>',
    function(){ spacesBind(); });
}
function spacesBind(){
  var page=pg(); if(!page) return;
  if(page.__spacesBound){ return; }   // a-page 每次重建前才被替换，防重复累加同义点击
  page.__spacesBound=true;
  page.addEventListener('click',function(e){
    var nav=e.target&&e.target.closest?e.target.closest('[data-sp="pick"]'):null;
    if(nav){ SPCUR=+nav.getAttribute('data-i'); Routes_spaces(); return; }
    var a=e.target&&e.target.closest?e.target.closest('[data-sa="pq"]'):null;
    if(a) editPers(a.getAttribute('data-dep'), a.getAttribute('data-person'));
  });
}
function editPers(dep, person, page){
  var s=H.getDepartmentDriveStats(dep);
  var found=null; s.drives.forEach(function(p){ if(p.name===person)found=p; });
  if(!found)return;
  var min=Math.ceil((found.used+(found.res||0))*10)/10;
  var dlg=H.dialog({
    title:'编辑个人盘 quotaBytes',
    msg:'个人子盘：'+esc(person)+'（'+esc(dep)+'）',
    form:'<label class="form-field"><span class="field-label">目标 quota（GB，下限 '+min+'）</span>'+
      '<input class="inp" data-pqgb type="number" min="'+min+'" step="1" value="'+found.quota+'"/></label>'+
      '<div class="u-faint" style="font-size:12px">低于'+min+'GB客户端阻止；改动仅落在 shared H.drvs，同源 quota 页联动。</div>',
    actions:'<button class="btn btn--ghost" data-act="no">取消</button><button class="btn btn--primary" data-act="ok">保存</button>',
    onOk:function(){
      var input=dlg.scope&&dlg.scope.querySelector('[data-pqgb]'); var v=Number(input&&input.value);
      if(!isFinite(v)||v<min||v<1){ H.toast('校验失败：个人盘 quota 至少 '+min+' GB'); return false; }
      H.driveUpdate(dep,'personalQuota',person,v);
      Routes_spaces();
      H.toast('已更新个人盘 "'+person+'" quota = '+v+' GB');
    }
  });
}
Routes['spaces']=Routes_spaces;   // 原 old SPACES/_legacy 数据完全退役
/* ============ 4) perms · 空间成员权限（管理员核心） ============ */
var PERM={
  scopes:[ '研发部-产品资料（部门盘）','生产部-图纸（部门盘）','管理中心-文件（部门盘）','销售部 镜像盘（部门盘）' ],
  scopeIdx:0,
  caps:[
    { k:'DRIVE_READ',    name:'浏览',       dep:null,     lock:true },
    { k:'FILE_PREVIEW',  name:'预览',       dep:['DRIVE_READ'], lock:false },
    { k:'FILE_DOWNLOAD', name:'下载',       dep:['FILE_PREVIEW'], lock:false },
    { k:'FILE_CREATE',   name:'上传 / 新建', dep:['DRIVE_READ'], lock:false },
    { k:'FILE_WRITE',    name:'重命名 / 编辑', dep:['FILE_CREATE'], lock:false },
    { k:'FILE_MOVE_COPY',name:'移动 / 复制', dep:['FILE_CREATE'], lock:false },
    { k:'FILE_DELETE',   name:'删除',       dep:['FILE_CREATE'], lock:false }
  ],
  presets:[
    { label:'仅查看',     h:null,  set:['DRIVE_READ'] },
    { label:'浏览+预览+下载', h:'基础能力', set:['DRIVE_READ','FILE_PREVIEW','FILE_DOWNLOAD'] },
    { label:'协作者（读写）', h:'协作',     set:['DRIVE_READ','FILE_PREVIEW','FILE_DOWNLOAD','FILE_CREATE','FILE_WRITE','FILE_MOVE_COPY'] },
    { label:'内容全权（可删）', h:'全权',   set:['DRIVE_READ','FILE_PREVIEW','FILE_DOWNLOAD','FILE_CREATE','FILE_WRITE','FILE_MOVE_COPY','FILE_DELETE'] }
  ],
  members:[
    { name:'张研', dept:'平台管理员 · 研发部', perms:['MANAGE'], meta:'空间管理者（owner）', editable:false },
    { name:'王磊', dept:'部门管理员 · 研发部', perms:['DRIVE_READ','FILE_PREVIEW','FILE_DOWNLOAD','FILE_CREATE','FILE_WRITE','FILE_MOVE_COPY','FILE_DELETE'], meta:'协作者' },
    { name:'周敏', dept:'部门盘 owner · 研发部', perms:['DRIVE_READ','FILE_PREVIEW','FILE_DOWNLOAD','FILE_CREATE','FILE_WRITE','FILE_MOVE_COPY','FILE_DELETE'], meta:'owner', isOwner:true },
    { name:'李明', dept:'成员 · 研发部', perms:['DRIVE_READ'], meta:'仅查看（用户无预览）', readOnlyLock:true }
  ],
  order:['DRIVE_READ','FILE_PREVIEW','FILE_DOWNLOAD','FILE_CREATE','FILE_WRITE','FILE_MOVE_COPY','FILE_DELETE']
};
var PERM_CUR=null;
function permPresetBtn(){}
function Routes_perms(){
  renderPerm(0);
}
Routes['perms']=Routes_perms;
function permChipClass(set){
  // 单一语义标注：仅查看 / 只读等，实际能力集合体由编辑器勾选呈现
  return '';
}
function permSel(i){ PERM_CUR=i; renderPerm(i); }
function permNote(list){
  return list.join('、');
}
function memberBadge(m){
  if(m.isOwner)return '<span class="tag tag--primary">owner</span>';
  if(m.dept.indexOf('平台管理员')>=0)return '<span class="tag tag--danger">空间管理者</span>';
  if(m.readOnlyLock)return '<span class="tag tag--warn">仅查看</span>';
  return '<span class="tag tag--plain">成员</span>';
}
function renderPerm(active){
  var m=PERM.members[active==null?0:active];
  PERM_CUR=PERM.members.indexOf(m);
  var list='<div class="ofilter"><span class="kw-wrap">'+H.i('search')+'<input class="inp" data-p="q" placeholder="搜索成员姓名"></span></div>'+
    '<div class="perm-who" data-p="who">';
  PERM.members.forEach(function(mm,i){
    list+='<button class="mem-item'+(i===PERM_CUR?' mem-item--on':'')+'" data-p="pick" data-i="'+i+'">'+
      avatar(mm.name)+'<span class="mem-body"><span class="mn">'+esc(mm.name)+memberBadge(mm)+'</span>'+
      '<span class="ms">'+esc(mm.dept)+'</span></span></button>';
  });
  list+='</div>';
  var editor=permEditor(m);
  H.setPage(
    '<div class="admin-page-head"><h1>空间成员权限</h1>'+
      '<p class="admin-page-head__desc">管理各范围（部门盘 / 项目盘）下成员的精确权限。</p>'+
      '<div class="admin-page-head__meta"><span class="agg-dot is-mock">'+H.i('info')+'</span>能力集为 5.5 精确语义；演示 mock，保存仅当前会话</div></div>'+
    '<div class="admin-toolbar"><div class="toolbar-left"><span class="fl">范围</span>'+
      '<select class="sel" data-p="scope" style="width:250px">'+PERM.scopes.map(function(s,i){return '<option'+(i===0?' selected':'')+'>'+esc(s)+'</option>';}).join('')+'</select></div>'+
      '<div class="toolbar-right"><button class="btn btn--ghost" data-p="batch">批量设置…</button></div></div>'+
    '<div class="perm-cols">'+
      '<div class="dtree-panel panel"><div class="panel__head"><span class="t">成员</span><span class="u">'+esc(String(PERM.members.length))+'</span></div>'+
        '<div class="perm-list-holder" data-p="host">'+list+'</div></div>'+
      '<div class="panel perm-editor" data-p="ed">'+editor+'</div>'+
    '</div>', permBind);
}
function capRow(c,m){
  // 浏览始终锁定勾选不可去勾(DRIVE_READ)；携依赖与禁组合校验
  var locked = (c.lock && m.readOnlyLock) || (c.k==='DRIVE_READ');
  var checked = hasCap(m,c.k);
  var forb=false,tip='';
  if(c.k==='FILE_PREVIEW' && !hasCap(m,'DRIVE_READ')){ forb=true; tip='需先具备「浏览」'; }
  if(c.k==='FILE_DOWNLOAD'){
    if(!hasCap(m,'FILE_PREVIEW')){ forb=true; tip='需先具备「预览」依赖后可选'; }
    else if(!hasCap(m,'DRIVE_READ')){ forb=true; }
  }
  if(/CREATE|WRITE|MOVE_COPY|DELETE/.test(c.k) && !hasCap(m,'DRIVE_READ')){ forb=true; tip='需先具备「浏览」'; }
  var disable=(c.k!=='DRIVE_READ'&&c.k!=='FILE_PREVIEW')&&false; // 单独预览需浏览
  // 单元级即时禁选表达：
  var canChk=true;
  if(c.k==='FILE_PREVIEW'&&!hasCap(m,'DRIVE_READ')){canChk=false;}
  if(c.k==='FILE_DOWNLOAD'&&!hasCap(m,'FILE_PREVIEW')){canChk=false;}
  if(c.k==='FILE_CREATE'&&!hasCap(m,'DRIVE_READ')){canChk=false;}
  if(c.k==='FILE_WRITE'/*需上传*/&&!hasCap(m,'FILE_CREATE')){canChk=false;}
  if(c.k==='FILE_MOVE_COPY'&&!hasCap(m,'FILE_CREATE')){canChk=false;}
  if(c.k==='FILE_DELETE'&&!hasCap(m,'FILE_CREATE')){canChk=false;}
  var reallyLock=m.isOwner||m.readOnlyLock||(m.perms&&m.perms.indexOf('MANAGE')>=0);
  var editOk=c.k==='DRIVE_READ'||(!m.isOwner&&!m.readOnlyLock&&c.k!=='MANAGE');
  var allowRow=canChk&&editOk;
  var chkRows='<input type="checkbox" class="chk" data-p="cap" data-k="'+c.k+'"'+(checked?' checked':'')+
    (allowRow?'':' disabled')+">";
  if(!editOk&&c.k!=='DRIVE_READ')chkRows+='<span class="locked-tip">只读</span>';
  var sub=(c.dep&&c.dep.length?' <span class="u-faint">依赖：'+c.dep.map(function(d){return d==='DRIVE_READ'?'浏览':'上传' ;}).join('、')+'</span>':'');
  return '<div class="capability'+(canChk&&c.k!=='DRIVE_READ'?' can-c':'')+'" '+(locked&&canChk?'':'')+'>'+
    '<div class="cap-left"><span class="cap-title">'+esc(c.name)+sub+'</span></div>'+
    (c.k==='DRIVE_READ'?'<span class="tag tag--plain t-locked">锁定启用</span>':'')+
    '<span class="cap-check">'+chkRows+(canChk?'':('<span class="cap-note">'+(c.k==='FILE_PREVIEW'?'需浏览':(c.k==='FILE_DOWNLOAD'?'需预览':'需浏览'))+'</span>'))+'</span></div>';
}
function hasCap(m,k){ return !!(m.perms&&m.perms.indexOf(k)>=0); }
function permEditor(m){
  var preset='<span class="lbl">快捷预设</span>';
  PERM.presets.forEach(function(p){ preset+='<button class="preset" data-p="preset" data-set="'+esc(p.set.join(','))+'">'+esc(p.label)+'</button>'; });
  var scopeName='范围：'+esc(PERM.scopes[PERM.scopeIdx]||'部门盘·研发部');
  var rows=PERM.order.map(function(k,i){ return capRow(PERM.caps[i],m); }).join('');
  var header=
    '<div class="pe-head">'+
    avatar(m.name)+
    '<div class="pe-id"><div class="pe-name">'+esc(m.name)+memberBadge(m)+'</div>'+
    '<div class="u-faint">'+esc(m.dept||'')+'</div></div>'+
    '<span class="u-faint pe-scope">'+scopeName+'</span></div>';
  var readOnlyTip=(m.readOnlyLock)?('<div class="ped-readonly"><span class="tag tag--warn">仅查看</span><span class="u-faint">细粒度只读：该成员当前仅被授予浏览（DRIVE_READ），无写能力。</span></div>'):'';
  var mgr=m.isOwner||(m.perms&&m.perms.indexOf('MANAGE')>=0&&!m.editable);
  var canLeave=(m.isOwner||m.perms&&m.perms.indexOf('MANAGE')>=0)&&!m.isOwner===false;
  var danger='';
  if(m.isOwner||m.perms&&m.perms.indexOf('MANAGE')>=0&&!m.editable){
    var ownerBox=m.isOwner;
    var chkMAN= ownerBox
      ? '<span class="tag tag--plain">MANAGE 对 owner 恒置开</span>'
      : '<label class="mgr-chk"><input type="checkbox" class="chk" data-p="mgr" checked>空间管理（MANAGE）</label>';
    danger='<div class="pd-danger">'+
      '<div class="pd-row">'+
      '<div><div class="pd-t">空间管理者 / owner 区</div>'+
      '<div class="pd-copy">'+(ownerBox?'当前用户为本空间 owner，MANAGE 由对象属性决定，不能被降为纯只读；如需降级应先移交 owner。':'空间管理者：可被移出本空间，MANAGE 表示对成员与对象的治理级能力。')+'</div></div>'+
      '<div class="pd-ops">'+chkMAN+
      '<button class="btn btn--danger-text btn--small" data-p="rm"'+((m.isOwner)?' disabled':'')+'>移出空间</button>'+
      '<button class="link-btn link-danger" data-p="transfer">移交 owner</button>'+
      '</div></div></div>';
  }
  return '<div class="ped-head">'+header+
    '<div class="pe-presets">'+preset+'</div></div>'+
    '<div class="ped-body">'+readOnlyTip+
    '<div class="perm-group__t">内容能力集 · 精确到能力点</div>'+rows+
    (danger||'')+'</div>'+
    '<div class="ped-foot"><span class="u-faint pe-save-note">显式保存：保存后权限即时生效，不随 token 缓存。</span><span class="spacer"></span>'+
    '<button class="btn btn--ghost btn--small" data-p="cancel">取消（回默认）</button>'+
    '<button class="btn btn--primary btn--small" data-p="save">保存权限</button></div>';
}
var PlatformAdmin=true;              // 演示上下文：当前登录平台管理员

var PERM_ACV=null;                    // 当前激活成员引用（重绘以它为准）
function hasC(m,k){ return (m.perms||[]).indexOf(k)>=0; }
function capDepsK(k){ var c=_craw(k); return c? (c.dep||[]) : []; }
function capImmediateDep(k){ var c=_craw(k); return c&&c.dep&&c.dep[0]||'DRIVE_READ'; }
function _craw(k){ var i; for(i=0;i<PERM.caps.length;i++)if(PERM.caps[i].k===k)return PERM.caps[i]; return null; }

/* 保证能力组合一致：勾选时自动补齐祖先；取消时级联取消其下级能力的祖先缺失者 */
function permInvariants(m,forceBrowse){
  var set=m.perms||(m.perms=[]);
  set.sort(function(a,b){ return PERM.order.indexOf(b)-PERM.order.indexOf(a); });
  set=set.filter(function(k){ return k==='MANAGE'||PERM.order.indexOf(k)>=0; });
  // 若拥有写/预览却不含浏览，则默认其本来自带 Browse（浏览恒为基底）
  var hasBrowse=set.indexOf('DRIVE_READ')>=0;
  var hasWrite=set.some(function(k){ return /PREVIEW|DOWNLOAD|CREATE|WRITE|MOVE|DELETE/.test(k)&&k!=='MANAGE'; });
  if(hasWrite&&!hasBrowse){ set.push('DRIVE_READ'); hasBrowse=true; }
  // 补齐缺失祖先（下载依赖预览 → 预览依赖浏览）
  function need(k){ return k!=='DRIVE_READ'&&k!=='MANAGE'?_craw(k):null; }
  var grew=true; var g=0;
  while(grew&&g<8){ grew=false; g++;
    set.slice().forEach(function(k){
      var c=need(k); if(!c)return;
      (c.dep||[]).forEach(function(p){ if(set.indexOf(p)<0&&p!=='MANAGE'){ set.push(p); if(p==='DRIVE_READ'||/_CREATE|WRITE|MOVE|DELETE|DOWNLOAD|PREVIEW/.test(p)){} grew=true; } });
    });
  }
  // 从不含祖先 = 浏览的空集成员开（防止孤点）
  set=set.filter(function(k){ return k==='MANAGE'||hasBrowse||k==='DRIVE_READ'; });
  if(forceBrowse){ // readOnly 强制最小集
    var mo=set.indexOf('MANAGE')>=0;
    m.perms = ['DRIVE_READ'].concat(mo?['MANAGE']:[]);
  } else {
    m.perms=set;
  }
  return m;
}
function permDraftFor(m){
  // 可撤销：m 上直接改，取消走从 PERM 初始 build 数据重新生成成员对象? 直接改意味着取消无法还原，
  // 故取消/切换保留一份 baseline（在 PERM.members 对象内）由 guard: 我们用 permRaw 存副本。
  return m;
}
function flipCapFor(m,k,on){
  var locked=(m.isOwner)||(m.readOnlyLock)||(m.perms&&m.perms.indexOf('MANAGE')>=0&&k!=='MANAGE');
  var mgrOnly=k!=='MANAGE';
  if((m.readOnlyLock&&k!=='DRIVE_READ'&&k!=='MANAGE')||(m.isOwner)){ return {proceed:false,msg:'该成员为锁定 / owner，仅查看。'}; }
  if(k==='DRIVE_READ')on=true;   // 浏览锁定常开
  var i=m.perms.indexOf(k);
  if(on&&i<0)m.perms.push(k);
  if(!on&&i>=0)m.perms.splice(i,1);
  permInvariants(m,m.readOnlyLock);
  return {proceed:true};
}
function applyPreset(m,set,onLocked){
  if(m.isOwner||m.readOnlyLock) return {proceed:false,msg:'锁定 / owner 成员不支持快捷预设'};
  m.perms=set.slice();
  if(m.perms.indexOf('MANAGE')<0 && (m.meta&&/管理|治理/.test(m.meta)) ) { /* 管理者MANAGE独立于内容，由系统决定 */ }
  permInvariants(m,false);
  return {proceed:true};
}
/* perms 页交互 */
function permBind(){
  var page=pg();
  var q=page.querySelector('[data-p="q"]');
  page.addEventListener('click',function(e){
    var t=e.target;
    var pick=t.closest?t.closest('[data-p="pick"]'):null;
    if(pick){ var i=+pick.getAttribute('data-i'); permEdit(i); return; }
    var pre=t.closest?t.closest('[data-p="preset"]'):null;
    if(pre){ var m=PERM.members[activeIdx()]; var set=(pre.getAttribute('data-set')||'').split(',').filter(Boolean).concat((m.perms||[]).indexOf('MANAGE')>=0?['MANAGE']:[]);
      var r=applyPreset(m,unique(set),!!m.readOnlyLock);
      if(!r.proceed){ H.toast(r.msg); return; } renderPerm(activeIdx()); return; }
    if((t.closest&&t.closest('[data-p="save"]'))){ var mm=PERM.members[activeIdx()]; H.toast('已保存 '+mm.name+' 的权限（演示：随 token 缓存即时生效）'); return; }
    if((t.closest&&t.closest('[data-p="cancel"]'))){ permReset(activeIdx()); return; }
    var transfer=t.closest&&t.closest('[data-p="transfer"]'); if(transfer){ permTransfer(); return; }
    var rm=t.closest&&t.closest('[data-p="rm"]'); if(rm){ permRemoveM(); return; }
    var batch=t.closest&&t.closest('[data-p="batch"]'); if(batch){ H.toast('批量设置：演示将对本范围全体成员按所选策略覆盖设置（此处仅示意）'); return; }
    var mgr=t.closest&&t.closest('[data-p="mgr"]'); if(mgr){ H.toast('MANAGE 为治理级，由成员角色决定，此处演示不修改'); }
  });
  page.addEventListener('change',function(e){
    var t=e.target;
    if(t&&t.hasAttribute&&t.hasAttribute('data-p')&&t.getAttribute('data-p')==='cap'){
      var mm=PERM.members[activeIdx()];
      var k=t.getAttribute('data-k'), on=t.checked;
      var r=flipCapFor(mm,k,on);
      if(!r.proceed){ if(!on){t.checked=true;} H.toast(r.msg); return; }
      // 依赖缺失即时自动打勾提示
      var needAll=(_anc(k)||[]).filter(function(x){return !hasC(mm,x);});
      renderPerm(activeIdx());
      if(!on&&needAll.length)H.toast('已取消 '+_craw(k).name+'：将不会自动影响下游（浏览保持常开）');
      // H.toast(...) empty path leaks none
    }
  });
  if(q)q.addEventListener('input',function(){
    var mwrap=page.querySelector('[data-perm-list]') || page.querySelector('[data-p="host"]');
    var kw=(q.value||'').trim().toLowerCase();
    if(!mwrap)return;
    [].forEach.call(mwrap.querySelectorAll('[data-p="pick"]'),function(row){
      var idx=+row.getAttribute('data-i'); var m=PERM.members[idx]; if(!m)return;
      row.style.display=(!kw||(m.name+m.dept+m.meta||'').toLowerCase().indexOf(kw)>=0)?'':'none';
    });
  });
}
function _anc(k){ // 递归祖先（不含自身）
  var out=[],vis={};
  function walk(x){ var c=_craw(x); if(!c)return; (c.dep||[]).forEach(function(p){ if(!vis[p]){vis[p]=1;out.push(p);walk(p);} }); }
  walk(k); return out;
}
function activeIdx(){ return PERM_ACV==null?0:PERM.members.indexOf(PERM_ACV); }
function permEdit(i){ PERM.members[i] && (PERM_ACV=PERM.members[i]); renderPerm(PERM.members.indexOf(PERM_ACV)); }
function permReset(i){ var m=PERM.members[i]; if(!m)return; /* 复位：用元数据 build 还原 */ if(m._seed){ m.perms=m._seed.slice(); } renderPerm(i); }
function permSeeds(){ PERM.members.forEach(function(m){ m._seed=(m.perms||[]).slice(); }); }
permSeeds();
function permTransfer(){ H.confirm('移交 owner','请先在成员中选择新 owner；真实流程需二次确认后生效。<br>属演示危险操作，请再次确认。',function(){ H.toast('已发起 owner 移交（需在确认弹窗点击二次确认；此处仅演示重绘态）'); },{ kicker:'移交 owner · 仅平台管理员可执行' }); }
function permRemoveM(){ var i=activeIdx(); if(permAvi(i)){} H.confirm('移出空间','确认将该成员移出本空间？成员关系为独立维度，移出后其访问随之失效。<br>属演示危险操作，请再次确认。',function(){ H.toast('演示：已移出 '+PERM.members[i].name+'（真实为显式删除关系，此处静态 mock 不生效）'); },{ kicker:'移出空间成员' }); }
function permAvi(i){ return true; }
function unique(a){ return a.filter(function(x,i){ return a.indexOf(x)===i; }); }
/*__APPEND__*/
})();










