/* ================================================================
   admin-pages-sys.js -- 审计与系统配置页块  data-page: audit / syscfg
   依赖 admin-core（window.H）与 ui-base/admin css；纯前端 Mock。
   审计页 Keyset 分页仅为演示说明；本原型为本地数据渲染，不伪造可写后端。
   ================================================================ */
(function(){
'use strict';
if(typeof window==='undefined')return;
var Routes=window.Routes=window.Routes||{};
var H=window.H;
if(!H)return;

function esc(s){ s=(s==null)?'':s; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function tick(ok){ return H.i(H.IC[ok?'chk':'x']); }

/* 审计 mock：字段顺序列映射见下方 cols；code 为原始动作枚举(友好名做 title tooltip 反面) */
var LOG=[
  {t:'2026-09-06 15:04:32',agoH:0.1,u:'张研',dept:'平台',op:'DRIVE_QUOTA_UPDATE',opL:'调整配额',res:'部门盘 / 研发部 / 产品资料',rt:'Drive/空间',ip:'10.12.8.21',ok:1,code:'',msg:'',
    d:{actor:'张研',action:'DRIVE_QUOTA_UPDATE',drive:'drive_rnd_0402',quota_old:'800GB',quota_new:'1000GB'}},
  {t:'2026-09-06 14:51:07',agoH:0.4,u:'王祺',dept:'平台',op:'PERMISSION_SET',opL:'设置成员权限',res:'部门盘 / 新业务部 · 李明',rt:'成员权限',ip:'10.12.3.9',ok:1,cde:'',msg:'',
    d:{actor:'王祺',action:'PERMISSION_SET',target_user:'李明',scope:'drive_newbiz',perms:['DRIVE_READ','FILE_PREVIEW','FILE_DOWNLOAD']}},
  {t:'2026-09-06 14:12:19',agoH:0.8,u:'李明',dept:'研发部',op:'FILE_UPLOAD',opL:'文件上传',res:'/部门空间/研发部/产品资料/2026/DWG-037.dwg',rt:'文件',ip:'10.22.6.14',ok:1,code:'',msg:'',
    d:{actor:'李明',action:'FILE_UPLOAD',bucket:'htong-prod-rnd',key:'DWG-037.dwg',size:'18.2MB'}},
  {t:'2026-09-06 13:39:48',agoH:1.3,u:'外部访客',dept:'审计匿名',op:'AUTH_LOGIN',opL:'登录认证',res:'(无资源)',rt:'认证',ip:'47.98.1.203',ok:0,code:'430005',msg:'登录频率受限 rate limited',rty:17,
    d:{actor_ip:'47.98.1.203',action:'AUTH_LOGIN',reason:'rate_limited',retry_after:17}},
  {t:'2026-09-06 11:02:55',agoH:4,u:'陈露',dept:'生产部',op:'FILE_DOWNLOAD',opL:'文件下载',res:'/生产部/图纸/2026Q3/STEP-210.step',rt:'文件',ip:'10.22.8.66',ok:0,code:'QUOTA_EXCEEDED',msg:'配额不足 quota exhausted',
    d:{actor:'陈露',action:'FILE_DOWNLOAD',drive:'drive_prod',quota_used:'99.2%',hint:'请先清理回收站'}},
  {t:'2026-09-06 10:40:12',agoH:5,u:'周敏',dept:'研发部',op:'SPACE_CREATE',opL:'空间创建',res:'部门盘：新业务部（默认 500GB）',rt:'Drive/空间',ip:'10.12.3.9',ok:1,
    d:{actor:'周敏',action:'SPACE_CREATE',kind:'FOLDER-DRIVE',quota_gb:500,member_init:'王磊(MANAGE)'}},
  {t:'2026-09-06 10:15:40',agoH:6,u:'张研',dept:'平台',op:'MEMBER_ROLE_CHANGE',opL:'成员角色变更',res:'王磊 → 部门管理员',rt:'成员',ip:'10.12.8.21',ok:1,
    d:{actor:'张研',action:'MEMBER_ROLE_CHANGE',uid:'wanglei',role_delta:['user','dept_admin'],scope:'drive_newbiz'}},
  {t:'2026-09-05 18:22:31',agoH:21,u:'李明',dept:'研发部',op:'RECYCLE_RESTORE',opL:'回收站还原',res:'DWG-017.dwg → /研发部/品资料/恢复',rt:'回收站',ip:'10.22.6.14',ok:1,
    d:{actor:'李明',action:'RECYCLE_RESTORE',collided:false,target:'/研发部/品资料/DWG-017.dwg'}},
  {t:'2026-09-05 17:09:02',agoH:22,u:'王祺',dept:'平台',op:'RECYCLE_PURGE',opL:'回收站清空',res:'销售部-废弃镜像盘（全部 28 个对象）',rt:'回收站',ip:'10.12.3.9',ok:1,
    d:{actor:'王祺',action:'RECYCLE_PURGE',drive:'drive_sales_del',purged_objects:28,freed_gb:514.6}},
  {t:'2026-09-05 14:48:27',agoH:24,u:'陈露',dept:'生产部',op:'CFG_UPDATE',opL:'系统配置修改',res:'storage.index.concurrency',rt:'配置(G)',ip:'10.12.8.33',ok:1,
    d:{actor:'陈露',action:'CFG_UPDATE',key:'upload.chunk.concurrency',from:'4',to:'5'}},
  {t:'2026-09-05 10:03:12',agoH:28,u:'李明',dept:'研发部',op:'FILE_SHARE',opL:'文件分享',res:'/设计图纸/DWG-041 以外链开放(预览)',rt:'文件',ip:'10.22.6.14',ok:1,
    d:{actor:'李明',action:'FILE_SHARE',target:'外部OA',expire_h:72}},
  {t:'2026-09-04 19:45:50',agoH:43,u:'系统 worker',dept:'平台',op:'PREVIEW_JOB_FAIL',opL:'预览任务失败',res:'3D / 装配体-030.step',rt:'预览任务',ip:'10.30.0.7',ok:0,code:'PV_003',msg:'worker 心跳超时',
    d:{job_id:'pv_job_88412',source:'/生产部/模型/装配体-030.step',worker:'10.30.0.7'}}
];
for(var _i=0;_i<LOG.length;_i++)LOG[_i]._id=_i;

function rowsOut(){ return LOG.slice(); }
function actNameMap(){ } /* 冗余占位（无遗留引用） */

Routes['audit']=function(){
  var labelOfOp=function(v){ for(var i=0;i<LOG.length;i++)if(LOG[i].op===v)return LOG[i].opL; return v; };
  function userCodes(arr){ return arr.indexOf('全部')<0?['全部'].concat(arr):arr; }
  function hdr(title,sub){
    return '<div class="admin-page-head"><h1>'+esc(title)+'</h1>'+
      '<p class="admin-page-head__desc">'+esc(sub)+'</p>'+
      '<div class="admin-page-head__meta"><span class="agg-dot is-mock">'+H.i('info')+'</span>mock 演示本地数据 · 职能部门管理员仅可审计所辖空间</div></div>';
  }
  var ops=[]; var us=[]; var dpt=[]; var uniq=function(a,v){ if(a.indexOf(v)<0)a.push(v); };
  LOG.forEach(function(r){ uniq(ops,r.op); uniq(us,r.u); uniq(dpt,r.dept); });
  var sel=function(id,label,opts){
    var h='<label class="fl"><span>'+esc(label)+'</span><select class="sel" id="'+id+'">';
    for(var i=0;i<opts.length;i++)h+='<option value="'+esc(opts[i])+'">'+esc(opts[i])+'</option>';
    return h+'</select></label>';
  };
  var html=hdr('审计日志','审计事件全量留痕：认证 / 越权探测 / 配置 / 文件删除等入审计，不含文件正文或口令。')+
    '<div class="admin-toolbar"><div class="toolbar-left">'
    +sel('fTime','时间',['近24小时','近7天','自定义'])
    +sel('fUser','用户',userCodes(us))+sel('fDept','部门',userCodes(dpt))
    +sel('fOp','操作',['全部动作'].concat(ops.map(labelOfOp)))
    +sel('fRes','结果',['全部','成功','失败'])
    +'</div><div class="toolbar-right"><span class="result u-faint" id="logCount"></span>'
    +'<button class="btn btn--primary" id="qBtn">查询</button></div></div>';

  html+='<div class="u-faint log-hint">Keyset 分页说明：审计量大时不一次拉全量，按 (time,id) 游标下钻滚动加载。</div>';
  html+='<div id="logTableWrap"></div>';
  H.setPage(html);

  function userCell(r){ return '<span class="cell-stack"><b>'+esc(r.u)+'</b><small class="u-faint">'+esc(r.dept)+'</small></span>'; }
  function refilter(){
    var ft=esc(elT('fTime'),0), fu=esc(elT('fUser')), fd=esc(elT('fDept')),
        fo=esc(elT('fOp')), fr=esc(elT('fRes'));
    var rows=LOG.filter(function(r){
      var okUser=(fu==='全部'||fu===r.u);var okDep=(fd==='全部'||fd===r.dept);
      var okOp=(fo==='全部动作'||fo===r.opL);
      var okOk=(fr==='全部'||(fr==='成功'? r.ok===1 : r.ok===0));
      var hrsOK=true; if(ft==='近24小时')hrsOK=r.agoH<=24; else if(ft==='近7天')hrsOK=r.agoH<=168;
      return okUser&&okDep&&okOp&&okOk&&hrsOK;
    });
    var cnt=document.getElementById('logCount');
    if(cnt)cnt.textContent='共 '+rows.length+' 条';
    var cols=[
      {label:'时间',cell:function(r){return '<span class="u-mono">'+esc(r.t)+'</span>';}},
      {label:'用户 / 部门',cell:function(r){return userCell(r);}},
      {label:'操作',head:'操作(原文 tooltip)',cell:function(r){return '<span title="'+esc('原始动作码: '+r.op)+'">'+esc(r.opL)+'</span>';}},
      {label:'资源',cell:function(r){return '<span title="'+esc(r.res)+'">'+esc(shortRes(r.res))+'</span>';}},
      {label:'资源类型',cell:function(r){return esc(r.rt);}},
      {label:'IP',cell:function(r){return '<span class="u-mono u-faint">'+esc(r.ip)+'</span>';}},
      {label:'结果',cell:function(r){ return r.ok
          ?'<span class="audit-res-ok"><span class="res-mark">'+tick(true)+'</span>成功</span>'
          :'<span class="audit-res-fail" title="'+esc(r.code+' / '+r.msg)+'"><span class="res-mark">'+tick(false)+'</span>失败</span>';}},
      {label:'',cell:function(r){return '<a class="t-a" data-log="'+r._id+'">查看详情</a>';}}
    ];
    var wrap=document.getElementById('logTableWrap');
    if(!wrap)return;
    while(wrap.firstChild) wrap.removeChild(wrap.firstChild);
    wrap.appendChild(H.table(rows,cols));
  }
  function shortRes(p){ return p.length>34? (p.slice(0,31)+'…') : p; }
  var aT=function(){ var v=$3('audit'); return ''; };
  function elT(id){ var n=document.getElementById(id); return n?n.value:''; }
  function $3(){ if($3.value===undefined)$3.value=true; }
  (function bindActions(){
    ['fTime','fUser','fDept','fOp','fRes'].forEach(function(id){ var n=document.getElementById(id); if(n)n.addEventListener('change',refilter); });
    var q=document.getElementById('qBtn'); if(q)q.addEventListener('click',function(){ refilter(); H.toast('查询已完成（本地条件）'); });
    document.getElementById('logTableWrap').addEventListener('click',function(ev){
      var a=ev.target.closest('.t-a'); if(!a||!a.hasAttribute('data-log'))return;
      var r=LOG[+(a.getAttribute('data-log'))]; openAudit(r,ev);
    });
  })();
  refilter();

  function openAudit(r,ev){
    var text=JSON.stringify(r.d||{actor:r.u,action:r.op,ip:r.ip},null,2);
    var meta='reqId · '+esc(r.ip)+'　操作码 '+esc(r.op);
    var wid='width:580px;';
    var html='<div class="dialog" style="'+wid+'max-width:94vw">'
      +'<h2 class="dialog__title">审计事件详情</h2>'
      +'<div class="dialog__msg">'+meta+'<br/><span class="u-mono u-faint">'+esc(r.t)+' · 用户 '+esc(r.u)+' · '+esc(r.res)+'</span></div>'
      +'<div class="audit-detail"><pre class="u-mono">'+esc(text)+'</pre></div>'
      +'<div class="dialog__actions">'
      +'<button class="btn btn--ghost" data-act="no">关闭</button>'
      +'<button class="btn btn--small copy-btn" id="copyAudit">复制 JSON</button>'
      +'</div></div>';
    var dl=H.dialog({cls:'x',section:html});
    var cp=(dl&&dl.scope)?dl.scope.querySelector('#copyAudit'):null;
    if(cp)cp.addEventListener('click',function(){
      copyText(text);
    });
    function copyText(tx){
      try{ navigator.clipboard.writeText(tx).then(function(){H.toast('JSON 已复制');},function(){H.toast('复制失败，请手动选择');}); }
      catch(e){ H.toast('当前环境不支持剪贴板'); }
    }
  }
};

/* =================================================================
   syscfg —— 系统配置（storage_config 键值 · 声明驱动分组表单）
   ================================================================= */
var CFG=[
  {key:'oss',title:'OSS / 存储',sub:'对象存储声明配置',fld:[
    ['select','region','地域',['cn-east-1','cn-north-1']],
    ['text','endpoint','Endpoint 域名']],
   wide:'bucket read 测试按钮'},
  {key:'upload',title:'上传 / 分片',sub:'边界配置',fld:[
    ['select','chunk','分片阈值',['8MB','16MB','32MB']],
    ['num','concurrency','分片并发',0],
    ['num','multipart_keep','分片保留天数',7],
    ['text','direct_host','直传域名']]},
  {key:'recycle',title:'回收站',sub:'保留与告警',fld:[
    ['num','keep_days','保留天数',30],
    ['num','warn_gb','占用告警阈值(GB)',40]]},
  {key:'worker',title:'预览 / 转换',sub:'worker 心跳与资源',fld:[
    ['num','hb_timeout','心跳超时(秒)',5],
    ['select','pools','转换并发档',['低','标准','高']],
    ['text','out_path','产物目录'],
    ['secret','oss_watermark','水印密钥']]}
];
/* 驱动式填充 placeholder 用 default 值，保留作为可读示例 */
function buildGroupsHtml(containerId){
  var html='';
  CFG.forEach(function(grp){
    html+='<section class="form-sec"><div class="form-sec__t"><span>'+esc(grp.title)+'</span><small>'+esc(grp.sub)+'</small></div><div class="form-sec__b">';
    grp.fld.forEach(function(f,fi){
      var key=grp.key+'.'+f[1]; var lbl=f[2];
      var ctrl;
      if(f[0]==='select')ctrl='<select class="sel" id="cfg_'+key+'">'+f[3].map(function(o){return '<option>'+esc(o)+'</option>';}).join('')+'</select>';
      else if(f[0]==='num')ctrl='<input class="inp" id="cfg_'+key+'" inputmode="decimal" value="'+((f.length>3&&f[3]!=null)?f[3]:'')+'" />';
      else if(f[0]==='secret')ctrl='<input class="inp" id="cfg_'+key+'" readonly value="sk-••••••••3F9A" /><button class="link-btn" id="see_'+key+'" type="button">查看</button>';
      else ctrl='<input class="inp" id="cfg_'+key+'" spellcheck="false" placeholder="'+esc(f[1])+'" />';
      ctrl=ctrl||'';
      html+='<label class="form-field'+(fi===grp.fld.length-1?'':'')+'"><span class="field-label">'+esc(lbl)+'</span>'+ctrl+'</label>';
    });
    // 特殊 oss wide：域名只读bucket + 连通性测试
    if(grp.key==='oss'){
      html+='<div class="form-field wide" style="grid-column:1/-1;display:block">'+
        '<span class="field-label">Bucket（只读）</span>'+
        '<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center">'+
        '<input class="inp" id="cfg_bucket" readonly value="htong-pds-prod-cn-east-1" style="width:100%"/>'+
        '<button class="btn btn--ghost btn--small" id="testConn" type="button">测试连接</button>'+
        '</div><span class="u-faint field-hint">生产环境请勿在前端 UI 展示密钥明文</span></div>';
    }
    html+='</div></section>';
  });
  var host=document.getElementById(containerId);
  if(host)host.innerHTML=html;
}

Routes['syscfg']=function(){
  var last='2026-09-06 14:58 · 张研';
  var head='<div class="admin-page-head"><h1>系统配置</h1>'+
    '<p class="admin-page-head__desc">storage_config · 键值声明式分组编辑。</p>'+
    '<div class="admin-page-head__meta"><span class="agg-dot is-mock">'+H.i('info')+'</span>mock 态仅覆盖当前会话，不写远端</div></div>'+
    '<div class="admin-toolbar"><div class="toolbar-left"><span class="u-faint">提交策略：按“配置分区键”merge —— 仅上传统一分组的被改动单键。</span></div>'+
    '<div class="toolbar-right"><span class="u-faint header-meta" id="lastSave">上次保存：'+esc(last)+'</span>'+
    '<button class="btn btn--primary" id="saveAll">保存全部</button></div></div>';
  var front='';   // 已并入头部工具栏说明，此处不再重复占位
  var layout='<div class="cfg-layout"><div class="cfg-col" id="c1">'+front+'</div>'+
    '<aside class="cfg-aside"><div class="panel"><div class="panel__head"><span class="t">分区最近修改</span></div>' +
    '<div class="panel__body" id="recentCfg"></div></div>'+
    '<div class="aside-actions">'+
    '<button class="btn btn--ghost btn--small" id="envBtn">导出样例.env</button>'+
    '<button class="btn btn--ghost btn--small" id="jsonBtn">完整 JSON</button>'+
    '</div></aside></div>';
  H.setPage(head+layout);

  buildGroupsHtml('c1');

  function e(id){return document.getElementById(id);}
  var rc=e('recentCfg');
  if(rc)rc.innerHTML=
    kv('OSS · 存储','张研 · 2 分钟前')+kv('upload.chunk 分片','陈露 · 9 分钟前')+
    kv('worker.pool 并发档','运维 · 26 分钟前')+kv('recycle.keep_days','张研 · 2026-09-05');
  function kv(k,v){return '<div class="a-kv"><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>';}

  /* save all */
  var sv=e('saveAll');
  if(sv)sv.addEventListener('click',function(){
    var keep=cfgNum('recycle.keep_days');
    var warnG=cfgNum('recycle.warn_gb');
    var issues=[];
    if(!(keep>=30&&keep<=90))issues.push('回收站保留天数须为 30~90 天（当前 '+keep+'）');
    if(!(warnG>0))issues.push('告警阈值需大于 0');
    var bucket=e('cfg_bucket'); if(bucket&&!String(bucket.value||'').trim())issues.push('bucket 不可为空');
    if(issues.length){ H.toast('保存失败：'+issues.join('；'),3000); return; }
    var now=new Date(); function p(n){return(n<10?'0':'')+n;} var ts=now.getFullYear()+'-'+p(now.getMonth()+1)+'-'+p(now.getDate())+' '+p(now.getHours())+':'+p(now.getMinutes());
    var ls=e('lastSave'); if(ls)ls.textContent='上次保存：'+ts+' · 张研';
    H.toast('配置已保存（演示，未写入远端 storage_config）');
  });
  function cfgNum(key){ var v=e('cfg_'+key); return v?parseFloat(v.value):NaN; }
  var tc=e('testConn'); if(tc)tc.addEventListener('click',function(){ var self=this; self.disabled=true; var o=this.textContent; this.textContent='检测中…'; setTimeout(function(){ self.textContent=o; H.toast('OSS Bucket 可达 · 延迟 42ms(示例)'); self.disabled=false; },500); });
  /* 查看（secret 类）：仅提示不在前端明文展示密钥 */
  var sees=document.querySelectorAll('#c1 [id^="see_"]');
  for(var si=0;si<sees.length;si++){
    sees[si].addEventListener('click',function(){
      H.toast('演示态：密钥显示被遮挡，生产请仅由服务端读取、前端不落明文。');
    });
  }
  /* 导出样例 */
  var env=e('envBtn'); if(env)env.addEventListener('click',function(){ viewEnv(); });
  function viewEnv(){
    var h='<div class="dialog" style="width:540px;max-width:94vw"><h2 class="dialog__title">oss.env（样例 · 不含真实密钥）</h2>'+
      '<div class="dialog__msg">仅演示导出形态；不写文件，生产端由服务端生成下发。</div>'+
      '<div class="audit-detail"><pre class="u-mono">'+
      esc('OSS_REGION=cn-east-1\nOSS_BUCKET=htong-pds-prod-cn-east-1\nUPLOAD_CHUNK=16MB\nRECYCLE_KEEP_DAYS=30\nWORKER_OPTS=standard')+'</pre></div>'+
      '<div class="dialog__actions"><button class="btn btn--ghost" data-act="no">关闭</button></div></div>';
    H.dialog({cls:'x',section:h});
  }
  var jb=e('jsonBtn');
  if(jb)jb.addEventListener('click',function(){
    function v(id,d){ var n=document.getElementById(id); return n?(n.value||d):d; }
    var obj={
      oss:{region:v('cfg_oss.region','cn-east-1'),endpoint:'https://oss.cn-east-1.example.com'},
      bucket:v('cfg_bucket','htong-pds-prod-cn-east-1'),
      upload:{chunk:v('cfg_upload.chunk','16MB'),direct_host:v('cfg_upload.direct_host','https://up.htong.test')},
      recycle:{keep_days:+v('cfg_recycle.keep_days',30)||30,warn_gb:+v('cfg_recycle.warn_gb',40)||40},
      worker:{hb_timeout:+v('cfg_worker.hb_timeout',5)||5,pools:v('cfg_worker.pools','标准')}
    };
    alertJson(obj);
  });
  function alertJson(obj){ 
    var h='<div class="dialog" style="width:600px;max-width:94vw"><h2 class="dialog__title">storage_config（只读快照）</h2>'+
      '<div class="audit-detail"><pre class="u-mono">'+esc(JSON.stringify(obj,null,2))+'</pre></div>'+
      '<div class="dialog__actions"><button class="btn btn--ghost" data-act="no">关闭</button></div></div>';
    H.dialog({cls:'x',section:h});
  }
};
})();
