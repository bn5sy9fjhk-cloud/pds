/* ================================================================
   admin-core.js —— 管理端公共内核
   依赖 ui-base.css（视觉冻结）；仅含共享工具/遮罩层/表格等。
   页面组装见：admin-pages-ops.js g = 运营与治理, admin-pages-sys.js = 审计与配置
   ================================================================ */
(function(){
'use strict';

var root;
function el(id){ return document.getElementById(id); }

function esc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
/* 统一线性图标：所有视觉图标只来自 admin-icons.js(window.AdminIcon)。
   这里仅做“语义名 -> Registry key”的桥接与统一 <svg> 输出。 */
var AI = window.AdminIcon;
function svg(key){
  if (!AI) return '';
  return AI.icon(key);
}
/* 旧常量仅保留兼容语义名，值全部为上表 Registry 的 key；禁止再出现第二份 path。
   （页面上 IC 作为名称传入；核心不覆盖描边 / 不另设 20 网格。） */
var IC = {
  up: 'upload', plus: 'add', filter: 'filter', more: 'more', close: 'close',
  warn: 'warning', x: 'trash', edit: 'edit', key: 'key', recycle: 'restore',
  shield: 'shield', chk: 'check', book: 'folder', perms: 'permission',
  refresh: 'sync', folder: 'folder', pwd: 'lock', clock: 'clock',
  user: 'user', users: 'users', space: 'space', search: 'search',
  info: 'info', success: 'success', warning: 'warning', check: 'check'
};
function popup(title,msg){ esc(msg); }
function toast(msg,ms){
  var t=document.createElement('div');t.className='toast';t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .2s'; },ms||1600);
  setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); }, ms||1900);
}
function showFloat(x,y,items){
  var m=document.createElement('ul'); m.className='float-menu';
  items.forEach(function(it){
    var li=document.createElement('li');
    li.className='float-menu__item'+(it.danger?' is-danger':'');
    if(it.sep){ li.className='menu-sep'; } else {
      li.innerHTML=(it.icon?('<span>'+svg(it.icon)+'</span>'):'')+'<span>'+esc(it.label)+'</span>';
      li.addEventListener('click',function(){
        closeFloat();
        if(it.fn)it.fn();
      });
    }
    m.appendChild(li);
  });
  document.body.appendChild(m);
  function placex(){
    var r=m.getBoundingClientRect();
    var X=Math.min(x,innerWidth-r.width-8),Y=Math.min(y,innerHeight-r.height-8);
    m.style.left=Math.max(8,X)+'px'; m.style.top=Math.max(8,Y)+'px';
  }
  placex();
  var dm=function(){closeFloat();document.removeEventListener('mousedown',dm);};
  setTimeout(function(){ document.addEventListener('mousedown',dm); },0);
  window.__mf=function(){ closeFloat(); };
}
function closeFloat(){ var m=document.querySelector('.float-menu'); if(m)m.remove(); }

/* 通用 Dialog */
function dialog(cfg){
  var mr=el('modalRoot'); if(!mr)return;
  var wrap=document.createElement('div'); wrap.className='modal-scrim';
  var body=cfg.section?cfg.section:
    '<div class="'+esc(cfg.cls||'dialog')+'">'+
      (cfg.title?('<h2 class="dialog__title">'+esc(cfg.title)+'</h2>'):'')+
      (cfg.msg?('<div class="dialog__msg">'+cfg.msg+'</div>'):'')+
      (cfg.form?'<div class="dlg-form">'+cfg.form+'</div>':'')+
      '<div class="dialog__actions">'+cfg.actions+'</div>'+
    '</div>';
  wrap.innerHTML=body;
  mr.appendChild(wrap);
  function cancel(){ if(wrap.parentNode)wrap.parentNode.removeChild(wrap); }
  wrap.addEventListener('mousedown',function(ev){ if(ev.target===wrap)cancel(); },false);
  // 内部临时只读: buttons data-ok bind once after
  Array.prototype.forEach.call(wrap.querySelectorAll('[data-act="ok"]'),function(b){
    b.addEventListener('click',function(){ var r=cfg.onOk?(cfg.onOk.bind(wrap))():true; if(r!==false)cancel(); });
  });
  Array.prototype.forEach.call(wrap.querySelectorAll('[data-act="no"]'),function(b){
    b.addEventListener('click',cancel);
  });
  return {close:cancel, scope:wrap};
}
/* danger confirm 统一 */
function confirmCtrl(label,desc,danger,onOk){
  dialog({
    title:esc(label),
    cls:'dialog',
    msg:(danger&&danger.kicker?('<p style="margin:0 0 6px;color:var(--danger);font-weight:600">'+esc(danger.kicker)+'</p>'):'')+'<div>'+desc+'</div>',
    actions:'<button class="btn btn--ghost" data-act="no">取消</button>'+
      '<button class="btn '+(danger?'btn--danger':'btn--primary')+'" data-act="ok">'+esc(danger?'确认'+ctrl:'确定')+'</button>',
    onOk:onOk
  });
}

/* 通用动作条: dialog 表单行 input */
function formRow(label,inputHTML){ return '<label class="form-field"><span class="field-label">'+esc(label)+'</span>'+inputHTML+'</label>'; }
function iw(id,val,ph){ return '<input class="inp" id="'+id+'" value="'+esc(val==null?'':val)+'" placeholder="'+esc(ph||'')+'"/>'; }

/* ---------- 通用表格构建 ---------- */
function tableNode(rows, cols, headExtras){
  // cols: [{label,cell(r),w,cls,head}]
  var thead='';
  var trows='';
  cols.forEach(function(c){
    var hd=c.head!=null?c.head:c.label;
    thead+='<th'+(c.w?' style="width:'+c.w+'"':'')+(c.hcl?' class="'+c.hcl+'"':'')+'>'+esc(hd)+'</th>';
  });
  (rows||[]).forEach(function(r,ri){
    var tds='';
    cols.forEach(function(c){
      var content;
      if(typeof c.cell==='function')content=c.cell(r,ri);
      else content=(r[c.keys]||'');
      tds+='<td'+(c.cl?' class="'+c.cl+'"':'')+'>'+content+'</td>';
    });
    trows+='<tr'+(r.sele?(' class="is-selected"'):'')+(r._tr?' '+r._tr:'')+'>'+tds+'</tr>';
  });
  var e=document.createElement('div');
  e.className='tbl-scroll';
  e.innerHTML='<table class="table-x"><thead><tr>'+thead+'</tr></thead><tbody>'+
    (trows||'<tr><td colspan="'+(cols.length||1)+'" class="empty-guide">'+esc(headExtras&&headExtras.empty||'暂无数据')+'</td></tr>')+
    '</tbody></table>';
  return e;
}
function badges(b){ return b.map(function(x){ return x.tag?('<span class="tag tag--'+x.t+'">'+(x.ico?'<i class="dot"></i>':'')+esc(x.t==='ok'||x.t==='warn'||x.t==='danger'?'':x.tag)+'</span>'):''; }).join(''); }
function humanGB(gb){
  if(gb>=1000)return (gb/1000).toFixed(gb>=10000?0:1)+' TB';
  return (gb<10?gb.toFixed(2):(gb%1?gb.toFixed(1):gb))+' GB';
}
function formGB(gb){ if(gb<1000)return gb+' GB'; return (gb/1000)+' TB'; }

/* 磁盘 GB -> 分区 */
function wrapTag(kind){
  var map={PERSONAL:['个人盘','primary'],'FOLDER-DRIVE':['部门盘','plain']};
  var m=map[kind]||[kind,'plain'];
  return '<span class="tag tag--'+m[1]+'">'+esc(m[0])+'</span>';
}

/* 顶层点击代理(命令类动作统一 bind 由各自页面负责) */
function on(rootSel,handler){
  var r=el(rootSel)||(this&&this._r)||document;
  r.addEventListener('click',handler,false);
}

root=el('aPageRoot');
el('aView');
var col={muted:'t-a'};

function section(title,sub){ return '<p class="a-nav-item--on"></p>'; }

/* 抽屉：基础/成员/配额/操作痕迹(重) ；接受 secs HTML */
function drawer(secs){
  var mr=el('modalRoot');
  var sc=document.createElement('div'); sc.className='drawer-scrim';
  var d=document.createElement('aside'); d.className='drawer'; d.style.width='560px';
  var head=secs.title||'';
  d.innerHTML=
    '<div class="drawer__head"><span>'+esc(head)+'</span><button class="icon-btn icon-btn--small" data-side-close>'+svg(IC.close)+'</button></div>'+
    '<div class="drawer__body">'+(secs.body||'')+'</div>';
  function close(){ if(sc.parentNode)sc.parentNode.removeChild(sc); if(d.parentNode)d.parentNode.removeChild(d); }
  sc.appendChild(d);
  mr.appendChild(sc);
  d.querySelector('[data-side-close]').addEventListener('click',close,false);
  sc.addEventListener('mousedown',function(ev){ if(ev.target===sc)close(); });
  return {node:d, close:close};
}
function splitKV(map){
  var s='<div class="drawer__body" style="padding:6px 16px">';
  for(var k in map)s+='<div class="a-kv"><dt>'+esc(k)+'</dt><dd>'+map[k]+'</dd></div>';
  return s+'</div>';
}

/* ======= 容量父子模型 · 共享数据源（quota 页 / spaces 页共用） ======= */
/* DEPT 父盘：部门盘 quotaBytes；子层分 公共子盘 + 个人子盘。
   个人子盘按总量占用（演示）。下方条目为单个子盘；父用量=所有子层 used 推导，
   勿用“已写死的总量常量”另行维护。DRVS 顶层 quota 即本模型单源字段。 */
var DRVS=[
  { id:'rd',  dept:'研发部',   folderDrive:'研发部-产品资料', quota:800, res:12,
    public:{ name:'研发部-产品资料 · 共享文件', quota:300, used:236, res:12 },
    personal:[ {name:'张研',quota:120, used:80,  res:0},
               {name:'张三',quota:90,  used:80,  res:0},
               {name:'李四',quota:200, used:110, res:0} ] },
  { id:'prd', dept:'生产部',   folderDrive:'生产部-图纸', quota:500, res:0,
    public:{ name:'生产部-图纸 · 工艺公共区', quota:320, used:256, res:0 },
    personal:[ {name:'陈露',quota:100, used:44, res:0} ] },
  { id:'sale',dept:'销售部',   folderDrive:'销售部 镜像盘', quota:800, res:0,
    public:{ name:'销售部 镜像盘（停用）', quota:800, used:0, res:0, off:true },
    personal:[] },
  { id:'ctr', dept:'管理中心', folderDrive:'管理中心-文件', quota:400, res:0,
    public:{ name:'管理中心-文件 · 综合共享', quota:200, used:128, res:0 },
    personal:[ {name:'周敏',quota:128, used:6, res:0} ] }
];
function drvDepObj(dept){ for(var i=0;i<DRVS.length;i++) if(DRVS[i].dept===dept)return DRVS[i]; return null; }
function drvUsed(d){ var s=0; if(d.public)s+=(d.public.used||0); (d.personal||[]).forEach(function(p){ s+=p.used; }); return s; }
function drvReserved(d){ var s=(d.res||0); if(d.public)s+=(d.public.res||0); return s; }
function getDepartmentDriveStats(dept){
  var d=drvDepObj(dept); if(!d)return null;
  var personalUsed=0,personalReserved=0,personalQuota=0;
  (d.personal||[]).forEach(function(p){ personalUsed+=p.used; personalReserved+=(p.res||0); personalQuota+=p.quota; });
  return { dept:d.dept, folderDrive:d.folderDrive, quota:d.quota, reserved:drvReserved(d),
    used:drvUsed(d), available:Math.max(d.quota-drvUsed(d)-drvReserved(d),0),
    publicUsed:d.public?(d.public.used||0):0, publicReserved:d.public?(d.public.res||0):0, publicQuota:d.public?(d.public.quota||0):0,
    personalUsed:personalUsed, personalReserved:personalReserved, personalQuota:personalQuota,
    personalDriveCount:(d.personal||[]).length, drives:d.personal||[], public:d.public||null };
}
function drivesUpdate(dept,what,a,b){
  var d=drvDepObj(dept); if(!d)return;
  if(what==='deptQuota'&&isFinite(a)&&a>=(drvUsed(d)+drvReserved(d))) d.quota=a;
  else if(what==='personalQuota'&&b){
    (d.personal||[]).forEach(function(p){ if(p.name===a&&isFinite(b)&&b>=(p.used+(p.res||0)))p.quota=b; });
  }
}

window.H={
  root:function(){return root;},
  setPage:function(html,onReady){ root.innerHTML='<div class="a-page">'+html+'</div>'; if(onReady)onReady(); },
  escape:esc, i:svg, IC:IC, toast:toast,
  dialog:dialog, confirm:function(t,d,onOk,dg){ confirmCtrl(t,d,dg,onOk); },
  float:showFloat, closeFloat:closeFloat, drawer:drawer,
  table:tableNode, formRow:formRow, iw:iw,
  tag:wrapTag, gb:humanGB, fgb:formGB, col:col, kv:splitKV, el:el,
  navswitch:function(name){ if(el('aView'))el('aView').setAttribute('data-page',name); },
  /* —— 容量父子模型（多页面共享同一数据，勿各自建另一套总量） —— */
  drvs:function(){ return DRVS; },
  driveStats:getDepartmentDriveStats,
  getDepartmentDriveStats:getDepartmentDriveStats,
  driveList:function(){ return DRVS.map(function(x){ return { dept:x.dept,folderDrive:x.folderDrive,quota:x.quota }; }); },
  driveUsed:function(dept){ var d=drvDepObj(dept); return d?drvUsed(d):0; },
  driveReserved:function(dept){ var d=drvDepObj(dept); return d?drvReserved(d):0; },
  driveAvail:function(dept){ var d=drvDepObj(dept); return d?Math.max(d.quota-drvUsed(d)-drvReserved(d),0):0; },
  driveUpdate:drivesUpdate
};
window.HF = {
  T:function(name,coldefs,rows){
    return tableNode(rows,coldefs);
  }
};
/* nav dot 自动 */
})();
