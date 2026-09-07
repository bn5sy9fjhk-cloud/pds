/* 霍桐PDS · PC 文件管理 视觉验证原型 — app.js（最终）
 * 纯前端 Mock；无后端 / 无框架 / 无 emoji；行内线性 SVG 图标。
 * 依据《霍桐PDS-V1.0-UI-UX设计方案.md》；保持控制台零 Error。 */
(function () {
'use strict';

/* ================= 工具 ================= */
function $(id){ return document.getElementById(id); }
function esc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function toSize(n){
  if (n==null||isNaN(n)) return '—';
  if (n>=1024) return (n/1024).toFixed(1)+' GB';
  if (n>=1) return (Math.round(n*10)/10)+' MB';
  return Math.round(n*1024)+' KB';
}
function isFolder(it){ return !!it.f; }

/* ================= 行内 SVG（线性、继承 currentColor） ================= */
var FDIR = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M2 5.4 2.2 5A1.6 1.6 0 0 1 3.6 3.7h3.2l1.9 1.6h6.8A1.5 1.5 0 0 1 17 6.8v8.6A1.6 1.6 0 0 1 15.4 17H3.6A1.6 1.6 0 0 1 2 15.4V5.4Z"/></svg>';
var FF = '<svg width="17" height="20" viewBox="0 0 15 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 1H3.4A1 1 0 0 0 2.4 2v13a1 1 0 0 0 1 1h9.2a1 1 0 0 0 1-1V5.2L8.5 1Z"/><path d="M8.5 1v4.2H13.4"/></svg>';
function glyphF(it){ return it.f ? FDIR : FF; }

/* ================= Mock 目录数据 =================
 * 键 =「部门空间/…」绝对路径；目录项 {f:1,n}，文件项 {n,k,s(大小MB),t(时间),u(修改人)}。 */
var DB = {
  '部门空间': [
    { f:1, n:'研发部' }, { f:1, n:'生产部' },
    { f:1, n:'销售部' }, { f:1, n:'管理中心' }
  ],
  '部门空间/研发部': [ { f:1, n:'产品资料' } ],
  '部门空间/研发部/产品资料': [ { f:1, n:'2026' } ],
  '部门空间/研发部/产品资料/2026': [
    { f:1, n:'设计图纸' },
    { n:'DWG-001.dwg', k:'dwg',   s:24.6, t:'2026-09-04 10:21', u:'王五' },
    { n:'设备模型.step', k:'model',s:86.2, t:'2026-09-03 18:42', u:'张三' },
    { n:'产品说明书.pdf', k:'pdf', s:3.8,  t:'2026-09-03 15:20', u:'李四' },
    { n:'设备照片.jpg',   k:'img', s:6.2,  t:'2026-09-02 16:11', u:'王五' }
  ],
  '部门空间/研发部/产品资料/2026/设计图纸': [
    { n:'装配图_A2.dwg',      k:'dwg', s:12.1, t:'2026-09-03 09:10', u:'李四' },
    { f:1, n:'零件图库' },
    { n:'尺寸标注规范.pdf',    k:'pdf', s:1.2,  t:'2026-08-28 15:02', u:'王五' }
  ],
  '部门空间/研发部/产品资料/2026/设计图纸/零件图库': [
    { n:'M6-法兰座.step', k:'model', s:4.4, t:'2026-08-25 11:05', u:'张三' },
    { n:'规格清单.xlsx',   k:'xlsx',  s:0.3, t:'2026-08-24 16:40', u:'李四' }
  ],
  '部门空间/生产部': [
    { f:1, n:'工艺文件' },
    { n:'排产计划.pdf', k:'pdf', s:2.1, t:'2026-09-02 09:00', u:'赵六' }
  ],
  '部门空间/生产部/工艺文件': [
    { n:'作业指导书.docx', k:'docx', s:0.8, t:'2026-09-01 11:24', u:'赵六' },
    { n:'设备点检表.xlsx', k:'xlsx',  s:0.5, t:'2026-08-31 14:10', u:'郑七' }
  ],
  '部门空间/销售部': [
    { n:'客户需求登记.xlsx', k:'xlsx', s:1.1, t:'2026-09-04 13:40', u:'孙丽' },
    { n:'报价单-海外C单.pdf', k:'pdf', s:4.9, t:'2026-09-03 08:55', u:'孙丽' }
  ],
  '部门空间/管理中心': [
    { f:1, n:'制度公告' },
    { n:'霍桐PDS上线通知.pdf', k:'pdf', s:0.7, t:'2026-09-02 17:00', u:'周安' }
  ],
  '部门空间/管理中心/制度公告': [
    { n:'数据安全与权限管理办法.docx', k:'docx', s:1.4, t:'2026-08-27 10:05', u:'周安' }
  ]
};

/* ================= 状态 & DOM 引用 ================= */
var seg = ['研发部','产品资料','2026'];   // 不含「部门空间」外壳
var view='list';
try{ var _sv=localStorage.getItem('htpds.view'); if(_sv==='grid'||_sv==='list') view=_sv; }catch(e){}
var selIdx = new Set();                   // 目录内已选项的下标
var anchor = -1;
var D;                                    // fill via prep()
function prep() {
  D = {
    list:$('fileList'), wrap:$('fileListWrap'), head:$('tableHead'),
    chkAll:$('checkAll'), crumb:$('crumb'), idle:$('barIdle'),
    multi:$('barMulti'), multiCount:$('multiCount'),
    scrim:$('drawerScrim'), drawer:$('detailDrawer'), dBody:$('detailBody'),
    modal:$('modalRoot'),
    upF:$('uploadFloat')?$('uploadFloat'):null, upFmtWrapper:null,
    upPanel:$('uploadPanel')?$('uploadPanel'):null,
    upTitle:$('upFloatTitle')?$('upFloatTitle'):null,
    upBar:$('upFloatBar')?$('upFloatBar'):null,
    upTasks:$('upTasks')?$('upTasks'):null,
    upFoot:$('upFoot')?$('upFoot'):null,
    pills:$('demoPills')?$('demoPills'):null,
    upFloatTrg:$('uploadFloatTrg')?$('uploadFloatTrg'):null,
    upPin:$('upPin')?$('upPin'):null,
    upClose:$('upClosePanel')?$('upClosePanel'):null
  };
}

function absKey(segs){ segs=segs||seg; return '部门空间'+(segs.length?'/'+segs.join('/'):''); }
function curItems(){ return (DB[absKey()]||[]).slice(); }
function crumbArr(){ return ['部门空间'].concat(seg); }
function lastSegName(){ return seg.length?seg[seg.length-1]:'部门空间'; }
function itemAt(i){ return itemList[i]; }

/* ================= 排序（目录优先，名称字典序） ================= */
function sortedArr(raw){
  return raw.slice().sort(function(a,b){
    if (isFolder(a)!==isFolder(b)) return isFolder(a)?-1:1;
    return a.n<b.n?-1:a.n>b.n?1:0;
  });
}
var itemList=[];

/* ================= 列表/网格 行模板 ================= */
function kindTag(it){
  if (it.f) return '<span class="frow-kind-tag kind-folder">文件夹</span>';
  var map={dwg:'DWG',model:'STEP',pdf:'PDF',img:'图片',xlsx:'表格',docx:'文档'};
  return '<span class="frow-kind-tag kind-'+(it.k||'file')+'">'+(map[it.k]||'文件')+'</span>';
}
function rowHTMLMark(it,i){
  return '<div class="file-row" data-i="'+i+'" data-n="'+esc(it.n)+'" role="option" aria-selected="false">'+
    '<div class="cell-check"><input type="checkbox" data-w="row"></div>'+
    '<div class="cell-name"><span class="cell-file-icon'+(it.f?' fd':'')+'">'+glyphF(it)+'</span><span class="txt">'+esc(it.n)+'</span></div>'+
    '<div class="cell-type">'+kindTag(it)+'</div>'+
    '<div class="cell-size">'+(it.f?'—':toSize(it.s))+'</div>'+
    '<div class="cell-date">'+(it.t?esc(it.t.slice(0,16)):'—')+'</div>'+
    '<div class="cell-user">'+(it.u?esc(it.u):'—')+'</div>'+
    '<div class="col-more"><button class="row-more" data-r="menu" tabindex="-1">⋯</button></div>'+
  '</div>';
}
function emptyBox(msg,sub){
  return '<div class="empty-hint"><img class="empty-art" src="meyougengduo.png" alt="" loading="lazy">'+
    '<span class="empty-txt">'+msg+'</span>'+
    (sub?'<span class="empty-sub">'+sub+'</span>':'')+'</div>';
}
function renderList(){
  var h,i;
  if(!itemList.length){ h=emptyBox('此目录为空','点击「上传」或「新建」添加内容'); }
  else { h=''; for(i=0;i<itemList.length;i++) h+=rowHTMLMark(itemList[i],i); }
  D.list.className=itemList.length?'file-list':'file-list is-empty';
  D.list.innerHTML=h;
  D.head.hidden=false;
  postRenderRows();
}
function renderGrid(){
  var h,i,it;
  for(i=0;i<itemList.length;i++){
    it=itemList[i];
    var sub = (it.f?'文件夹':(it.k?({dwg:'DWG',model:'STEP',pdf:'PDF',img:'图片',xlsx:'表格',docx:'文档'}[it.k]||'文件'):'文件'))
      +'<span>'+(it.f?'':toSize(it.s))+'</span>';
    h=(h||'')+'<div class="file-row" data-i="'+i+'" data-n="'+esc(it.n)+'" role="option" aria-selected="false">'+
      '<span class="cell-check"></span>'+
      '<div class="grid-tile-preview"><img class="grid-ico" src="wenjian.png" alt="" loading="lazy"></div>'+
      '<div class="grid-tile-meta"><div class="grid-tile-name">'+esc(it.n)+'</div>'+
      '<div class="grid-tile-sub"><span>'+(it.f?'文件夹':(it.k?({dwg:'DWG',model:'STEP',pdf:'PDF',img:'图片',xlsx:'表格',docx:'文档'}[it.k]||'文件'):'文件'))+'</span><span>'+toSize(it.s)+'</span></div></div>'+
    '</div>';
  }
  if(!itemList.length) h=emptyBox('此目录为空','切到「上传」或「新建」开始填充内容');
  D.list.className=itemList.length?'file-list is-grid':'file-list is-grid is-empty';
  D.list.innerHTML=h;
  D.head.hidden=true;
  postRenderRows();
}
function postRenderRows(){
  var rows=D.list.querySelectorAll('.file-row'),i,row;
  for(i=0;i<rows.length;i++){
    row=rows[i];
    var on=selIdx.has(i),ck=row.querySelector('[data-w="row"]');
    row.classList.toggle('is-selected',on);
    row.setAttribute('aria-selected',on?'true':'false');
    if(ck)ck.checked=on;
  }
  updateBars();
}

/* ================= 面包屑 & 导航 ================= */
function crumbHTML(){
  var arr=crumbArr(), s='',i;
  for(i=0;i<arr.length;i++){
    s+='<button class="crumb__item'+(i===arr.length-1?' crumb__item--current':'')+'" data-g="'+i+'">'+esc(arr[i])+'</button>';
    if(i<arr.length-1)s+='<span class="crumb__sep">/</span>';
  }
  return s;
}
function goCrumb(i){
  var full=crumbArr();
  var want=[]
    ,j;
  for(j=1;j<=i;j++) want.push(full[j]);
  go(want);
}
function go(want){
  seg=want.slice();
  load();
}
function openFolder(item){
  seg=seg.concat([item.n]);
  load();
}
function jumpToDept(label){
  go([label]);
}
function load(){
  itemList=sortedArr(curItems());
  selIdx.clear(); anchor=-1;
  D.crumb.innerHTML=crumbHTML();
  if(view==='grid') renderGrid(); else renderList();
  if(D.wrap)D.wrap.scrollTop=0;
}
function setViewMode(mode){
  view=(mode==='grid')?'grid':'list';
  try{ localStorage.setItem('htpds.view', view); }catch(e){}
  toggleViewUI();
  load();
}
function toggleViewUI(){
  var listBtn=document.querySelector('[data-view="list"]');
  var gridBtn=document.querySelector('[data-view="grid"]');
  if(listBtn)listBtn.classList.toggle('view-toggle--on',view==='list');
  if(gridBtn)gridBtn.classList.toggle('view-toggle--on',view==='grid');
}

/* ================= 选中状态与顶部工具条 ================= */
function updateBars(){
  if(!D)return;
  var n=selIdx.size;
  D.idle.hidden=n>0;
  D.multi.hidden=!(n>0);
  if(D.multiCount)D.multiCount.textContent='已选择 '+n+' 项';
  var total=itemList.length;
  if(D.chkAll){D.chkAll.checked=n>0&&n===total; D.chkAll.indeterminate=n>0&&n<total;}
}
function setSelAll(on){
  selIdx.clear();
  if(on)for(var i=0;i<itemList.length;i++)selIdx.add(i);
  postRenderRows();
}
function chosenItems(){
  var out=[];
  selIdx.forEach(function(k){ if(itemList[k]) out.push(itemList[k]); });
  return out;
}
function firstChosen(){ return chosenItems()[0]; }
function ensureOneSelection(rowIdx){
  if(!selIdx.size&&!selIdx.has(rowIdx)){ selIdx.add(rowIdx); anchor=rowIdx; }
}

/* ================= Toast ================= */
var toastTimer=null;
function toast(msg){
  var old=document.querySelector('.toast');
  if(old&&old.parentNode)old.parentNode.removeChild(old);
  var e=document.createElement('div');
  e.className='toast';
  e.textContent=msg;
  document.body.appendChild(e);
  clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){ if(e&&e.parentNode)e.parentNode.removeChild(e); },2400);
}

/* ================= Dialog（通用） ================= */
var dlg={node:null,onOk:null};
function closeDialog(){
  if(dlg.node&&dlg.node.parentNode)dlg.node.parentNode.removeChild(dlg.node);
  dlg.node=null; dlg.onOk=null;
}
function dialog(conf){
  closeDialog();
  var scrimRoot=document.createElement('div');
  scrimRoot.className='modal-centering';
  var card=document.createElement('div');
  card.className='dialog';
  var c='<h3 class="dialog__title">'+esc(conf.title||'操作')+'</h3>'+
    (conf.before||'')+
    (conf.input?'<label class="dialog-input-label">'+esc(conf.label||'名称')+'</label><input class="dialog-input" id="dialogName" maxlength="64" value="'+esc(conf.value||'')+'">':'')+
    '<div class="dialog__actions">'+
    '<button class="btn btn--ghost" data-x="cancel">取消</button>'+
    '<button class="btn '+(conf.danger?'btn--danger-text':'btn--primary')+'" data-x="ok">'+esc(conf.ok||'确定')+'</button></div>';
  card.innerHTML=c;
  scrimRoot.appendChild(card);
  if(!D.modal){ D.modal=document.createElement('div'); D.modal.id='modalRoot'; document.body.appendChild(D.modal); }
  D.modal.appendChild(scrimRoot);
  dlg.node=scrimRoot; dlg.onOk=conf.onOk;
  var inp=$('dialogName');
  if(inp){ conf._focus=function(){
      inp.focus();
      if(conf.value){
        var d=inp.value.lastIndexOf('.');
        if(d>0&&inp.value.indexOf('.')===d){ try{inp.setSelectionRange(0,d);}catch(x){} }
        else inp.select();
      }
  }; setTimeout(conf._focus,20); }
}
function dlgOk(){
  var tinp=$('dialogName');
  var val=tinp?tinp.value.trim():'';
  var res=true;
  if(dlg.onOk){ res=dlg.onOk(val)!==false; }
  if(res) closeDialog();
}
function dlgKey(hit){
  if(hit==='ok')dlgOk();
  else { if(dlg.onOk)dlg.onOk(null); closeDialog(); }
}

function _pad2(n){ n=Number(n); return n<10?'0'+n:''+n; }
function _whoName(){ return '张研'; }
function _whoDept(){ return seg&&seg.length?seg[0]:'部门空间'; }
function _nowStamp(){ var d=new Date(); return d.getFullYear()+'/'+_pad2(d.getMonth()+1)+'/'+_pad2(d.getDate())+' '+_pad2(d.getHours())+':'+_pad2(d.getMinutes()); }
function newFolderQ(){
  var _pb='<div class="dialog__meta">'
    +'<span>创建人：'+_whoName()+'</span>'
    +'<span>部门：'+_whoDept()+'</span>'
    +'<span>时间：'+_nowStamp()+'</span>'
    +'</div>';
  dialog({
    title:'新建文件夹',
    before:_pb,
    input:true, label:'文件夹名称', value:'新建文件夹', ok:'创建',
    onOk:function(v){
      if(!v){ toast('名称不能为空'); return false; }
      if(itemList.some(function(x){return x.n===v;})){
        toast('当前目录已存在同名项'); return false;
      }
      (DB[absKey()]||(DB[absKey()]=[])).push({f:1,n:v,t:_nowStamp(),u:_whoName()});
      load(); toast('文件夹已创建');
    }
  });
}
function editNameQ(it){
  dialog({
    title:'重命名',
    before:'<p class="dialog__msg">位于 <span class="em">'+esc(lastSegName())+'</span></p>',
    input:true, label:'新名称', value:it.n, ok:'重命名',
    onOk:function(v){
      if(!v){ toast('名称不能为空'); return false; }
      if(itemList.some(function(x){return x!==it&&x.n===v;})){ toast('已存在同名项'); return false; }
      it.n=v; load(); toast('已重命名');
    }
  });
}
function confirmRemoveQ(it){
  dialog({
    title:'移入回收站',
    before:'<p class="dialog__msg">确认将 <span class="em">'+esc(it.n)+'</span> 移入回收站？</p>',
    ok:'移入回收站', danger:true,
    onOk:function(){
      var arr=DB[absKey()];
      var at=arr.indexOf(it);
      if(at>=0)arr.splice(at,1);
      load(); toast('已移入回收站');
    }
  });
}

/* ================= 详情 Drawer ================= */
var DRAW_IT=null;                 // 详情当前项
function pathStr(){ return '部门空间/'+(seg.length?seg.join('/'):''); }
function openDetail(it){
  if(!D.drawer)return;
  DRAW_IT=it;
  var kind=it.f?'文件夹':(it.k?(({dwg:'DWG',model:'STEP',pdf:'PDF',img:'图片',xlsx:'表格',docx:'文档'})[it.k]||'文件'):'文件');
  var rows=''+
    '<div class="detail-row"><dt>位置</dt><dd>'+esc(pathStr()+'/'+it.n)+'</dd></div>'+
    '<div class="detail-row"><dt>类型</dt><dd>'+kind+'</dd></div>'+
    (it.t?'<div class="detail-row"><dt>修改时间</dt><dd>'+esc(it.t.slice(0,16))+'</dd></div>':'')+
    (it.u?'<div class="detail-row"><dt>修改人</dt><dd>'+esc(it.u)+'</dd></div>':'')+
    (it.f?'':'<div class="detail-row"><dt>大小</dt><dd>'+toSize(it.s)+'</dd></div>')+
  '';
  D.dBody.innerHTML=
    '<div class="detail-hero"><span class="cell-dicon" style="color:#2454E1">'+glyphF(it)+'</span>'+
      '<div><div class="detail-dname">'+esc(it.n)+'</div>'+
      '<div class="detail-dsub">'+kind+(it.f?'':(' · '+toSize(it.s)))+'</div></div></div>'+
    '<dl class="detail-rows">'+rows+'</dl>'+
    '<div class="detail-preview">'+
      '<div class="prev-ico">'+glyphF(it)+'</div>'+
      '<div class="prev-txt">'+(it.f?'文件夹预览（此处为占位）':'预览占位 · 需前端渲染服务接入')+'</div>'+
    '</div>'+
    '<div class="drawer-actions">'+
      '<button class="btn btn--ghost btn-grow" data-x="c/down">下载</button>'+
      '<button class="btn btn--ghost btn-grow" data-x="c/move">移动</button>'+
    '</div>';
  D.drawer.setAttribute('aria-hidden','false');
  if(D.scrim)D.scrim.hidden=false;
}
function closeDrawerBox(){
  if(D.drawer)D.drawer.setAttribute('aria-hidden','true');
  if(D.scrim)D.scrim.hidden=true;
  DRAW_IT=null;
}

/* ================= 右键/⋯ ================= */
var MENU=null;
var curRowIt=null;
function hullRowData(it,x,y){
  var items=[];
  if(it.f){
    items=[
      [ '打开', function(){ openFolder(it); }, 0],
      ['在新标签打开',null,1], ['sep',null,0],
      ['重命名',null,1], ['sep',null,0],
      ['移动到…',function(){ toast('原型：未实现移动目标选择'); },0],
      ['分享',null,1], ['删除到回收站',function(){ confirmRemoveQ(it); },2]
    ];
  }else{
    items=[
      ['预览',function(){ openDetail(it); },0],
      ['下载',function(){ toast('已开始下载（演示）: '+it.n); },0],
      ['sep',0,0],
      ['重命名',function(){ editNameQ(it); },0],
      ['移动到…',function(){ toast('原型：未实现移动目标选择'); },0],
      ['复制到…',function(){ toast('已选择复制目标'); },0],
      ['收藏',function(){ toast('已加入收藏'); },0],
      ['sep',0,0],
      ['分享',null,1],
      ['删除到回收站',function(){ confirmRemoveQ(it); },2]
    ];
  }
  showContext(items,x,y);
}
function showContext(items,x,y){
  closeMenu();
  curRowIt=items;
  var ul=document.createElement('ul');
  ul.className='float-menu';
  for(var i=0;i<items.length;i++){
    var line=items[i];
    if(line[0]==='sep'){ var si=document.createElement('li'); si.className='menu-sep'; ul.appendChild(si); continue;}
    var li=document.createElement('li');
    var b=document.createElement('button');
    b.type='button';
    b.className='float-menu__item'
      +(line[2]===2?' is-danger':'')
      +(line[1]===null?' is-disabled':'');
    b.textContent=line[0];
    if(line[1]===null){ b.setAttribute('data-dis',1); b.title='原型暂未开放'; }
    (function(ln,btndom){
      btndom.addEventListener('click',function(ev){
        ev.stopPropagation(); closeMenu();
        if(ln[1]===null){ toast('原型暂未开放该能力'); }
        else ln[1]();
      });
    })(line,b);
    li.appendChild(b); ul.appendChild(li);
  }
  MENU=ul;
  document.body.appendChild(ul);
  var pad=8, rw=ul.offsetWidth||192, rh=ul.offsetHeight||210;
  var winW=document.documentElement.clientWidth, winH=document.documentElement.clientHeight;
  ul.style.left=(Math.max(pad,Math.min(x,winW-rw-pad)))+'px';
  ul.style.top =(Math.max(pad,Math.min(y,winH-rh-pad)))+'px';
}
function closeMenu(){ if(MENU&&MENU.parentNode)MENU.parentNode.removeChild(MENU); MENU=null; }

/* ================= 行交互处理器 ================= */
function pickRow(rowEl, ev){
  var i=+(rowEl.getAttribute('data-i'));
  if(i<0||i>=itemList.length)return;
  var ctrl=ev.ctrlKey||ev.metaKey;
  if(ev.shiftKey){
    if(anchor<0)anchor=i;
    var a=Math.min(anchor,i), b=Math.max(anchor,i);
    if(!ctrl)selIdx.clear();
    for(var k=a;k<=b;k++)selIdx.add(k);
    anchor=i;
  }else if(ctrl){
    if(selIdx.has(i))selIdx.delete(i); else selIdx.add(i);
    anchor=i;
  }else{
    if(selIdx.size===1&&selIdx.has(i)){ selIdx.clear(); anchor=-1; }
    else{ selIdx.clear(); selIdx.add(i); anchor=i; }
  }
  if(view==='grid'||true)postRenderRows();
}
function rowContext(rowEl,x,y){
  var i=+(rowEl.getAttribute('data-i'));
  if(i>=0&&itemList[i])hullRowData(itemList[i],x,y);
}
function cellOf(rowEl){ return rowEl; }

function selectedOnly(){ setSelAll(false); }

/* ================= 顶/工具栏·action ================= */
function actTop(op){
  switch(op){
    case 'collapse-nav': document.body.classList.toggle('nav-collapsed'); break;
    case 'nav-upload': floatShow(true); break;
    case 'notify': toast('暂无新通知'); break;
    case 'avatar': toast('测试环境：演示登录态'); break;
    default: break;
  }
}
function actMulti(op){
  var sel=chosenItems();
  if(!sel.length){ toast('请先选择文件'); return; }
  switch(op){
    case 'download': toast('打包下载 ' + sel.length + ' 个文件（演示）'); break;
    case 'move': toast('移动：请选择目标目录（演示端点）'); break;
    case 'copy': toast('复制到…：选择目标目录（演示）'); break;
    case 'star': selIdx.clear(); postRenderRows(); toast('已加入我的收藏'); break;
    case 'delete':
      var arr=DB[absKey()];
      sel.forEach(function(it){ var at=arr.indexOf(it); if(at>=0)arr.splice(at,1); });
      selIdx.clear();
      load();
      toast('已删除 ' + sel.length + ' 项（回收站演示）');
      break;
    case 'more':
      toast('更多操作：请在对象上使用右键菜单');
      break;
    default: break;
  }
}

/* ================= Upload 浮层 ================= */
var floatOpen=false;
function floatShow(forceOpen){
  if(!D.upF)return;
  D.upF.hidden=false;
  floatOpen=forceOpen;
  refreshFloatUI();
  if(forceOpen){ floatCollapseOpenHide(); }
}
function floatCollapseOpenHide(){
  // 初始不展开面板
}
function refreshFloatUI(){
  if(!D.upPanel)return;
}

/* ================= 视图切换 & 演示态 ================= */
function ensureBase(){ load(); }
function selIndexes1to3(){
  selIdx.clear();
  for(var i=1;i<=3;i++)if(itemList[i])selIdx.add(i);
  postRenderRows();
}
function demoState(s){
  closeMenu(); closeDrawerBox(); closeDialog();
  if(s==='A'){
    go(BASE_SEG.slice());          // 回到默认 2026
    view='list'; toggleViewUI();
    setSelAll(false); selIdx.clear(); postRenderRows();
    if(D.upF)D.upF.hidden=true;
    toast('演示态 A · 正常浏览');
  }else if(s==='B'){
    if(view!=='list')setViewMode('list');
    go(BASE_SEG.slice());
    selIndexes1to3();
    if(D.upF)D.upF.hidden=true;
    toast('演示态 B · 已选择 3 项');
  }else if(s==='C'){
    if(view!=='list')setViewMode('list');
    go(BASE_SEG.slice());
    setSelAll(false);
    // 详情
    if(itemList.length>3)openDetail(itemList[2]);
    // 上传浮层
    showFloating(); fillFloatingTasks(true);
    toast('演示态 C · 详情 + 上传在途');
  }
}
var BASE_SEG=['研发部','产品资料','2026'];
function isDemoView(){}
/* 上传浮层实现 */
function showFloating(){
  if(!D.upF)return;
  D.upF.hidden=false;
  if(D.upPanel)D.upPanel.hidden=false;
  fillFloatingTasks(true);
  var mini=D.upBar; if(mini)mini.style.width='48%';
  if(D.upTitle)D.upTitle.textContent='上传任务 · 2 个文件正在上传';
}
function hideFloating(){ if(D.upF)D.upF.hidden=true; }
function fillFloatingTasks(ensure){
  if(!D.upTasks)return;
  if(ensure && !D.upTasks.children.length){
    D.upTasks.innerHTML=
      '<div class="up-task"><div class="up-task__top"><span class="up-file-ico">'+FF+'</span>'+
        '<span class="up-task__name">DWG-017-工装.dwg<small>部门空间/研发部/产品资料/2026</small></span></div>'+
        '<div class="up-bar"><i style="width:72%"></i></div>'+
        '<div class="up-task__rate"><span>72%</span><span>18 MB / 24.6 MB · 12 MB/s</span></div></div>'+
      '<div class="up-task"><div class="up-task__top"><span class="up-file-ico">'+FF+'</span>'+
        '<span class="up-task__name">规格清单.xlsx<small>部门空间/研发部/产品资料/2026</small></span></div>'+
        '<div class="up-bar"><i style="width:34%"></i></div>'+
        '<div class="up-task__rate"><span>34%</span><span>0.1 MB / 0.3 MB · 2 MB/s</span></div></div>';
    if(D.upFoot)D.upFoot.innerHTML='已完成 8　·　失败 1';
  }
}

/* ================= 全局事件委托 ================= */
function onBodyClick(ev){
  var t=ev.target;
  // 关闭抽屉
  if(D && D.scrim && D.scrim===t){ closeDrawerBox(); return; }
  if(t && t.closest && t.closest('#closeDrawer')){ closeDrawerBox(); return; }
  // 菜单
  if(menuTap(ev,t))return;
  // crumb
  var cb=t.closest?t.closest('[data-g]'):null;
  if(cb&&!cb.getAttribute('data-r')&&cb.parentNode===D.crumb){
    var gi=cb.getAttribute('data-g');
    if(/^\d+$/.test(gi)){ if(+gi!==seg.length)goCrumb(+gi); return; }
    return;
  }
  dispatchAttr(ev,t);
}
function menuTap(ev,t){
  if(MENU&&MENU.contains(t))return true;   // 已由各自按钮处理
  if(t.closest&&t.closest('.float-menu'))return true;
  if(MENU&&!MENU.contains(t)){ closeMenu(); }
  return false;
}
function dispatchAttr(ev,t){
  var map=[ ['data-nav',onNav],['data-drive-dir',onDrive],['data-view',onView],
            ['data-state',onDemo],['data-sc',onScale],['data-act',onAction],['data-btn',onBtn],['data-x',onDialogs] ];
  for(var i=0;i<map.length;i++){
    var el= t.closest? t.closest('['+map[i][0]+']') : null;
    if(!el)continue;
    var val=el.getAttribute(map[i][0]);
    if(val!=null){ ev.stopPropagation&&ev.stopPropagation(); map[i][1](val,el,ev); return; }
  }
}
function onNav(v,btn){
  if(v==='dept-space'){ go([]); }
  else if(v==='my-docs'){ window.location.assign('pages/my-docs.html'); }
  else if(v==='home'){ window.location.assign('pages/my-docs.html'); }
  else if(v==='recent'){ window.location.assign('pages/recent.html'); }
  else if(v==='starred'){ window.location.assign('pages/starred.html'); }
  else if(v==='trash'){ window.location.assign('pages/trash.html'); }
}
function onDrive(v){
  var m=v.indexOf('/');
  if(m>=0)go([v.slice(m+1)]);
  else go([]);
}
function onView(v){ setViewMode(v); }
function onDemo(v){ demoState(v); updatePill(v); }
function updatePill(sel){
  var ps=document.querySelectorAll('.demo-pill');
  for(var i=0;i<ps.length;i++)ps[i].classList.toggle('is-on',ps[i].getAttribute('data-state')===sel);
}
/* ---------- 界面大小（大/中/小）折叠 —— 实际档位逻辑统由共享 ui-scale.js 承担 ---------- */
function scaleFactor(){ return 1; }
function paintScales(k){
  if (window.UIScale) { window.UIScale.apply(k); return; }
  var bs=document.querySelectorAll('.mt-scale-btn[data-sc]'),i,v;
  for(i=0;i<bs.length;i++){ v=bs[i].getAttribute('data-sc'); bs[i].classList.toggle('is-on', v===k); }
}
function applyScale(k, save){
  k = (k==='s'||k==='m'||k==='l') ? k : 'm';
  if (window.UIScale) { window.UIScale.set(k, !!save); }
  else { document.body.setAttribute('data-ui-scale', k); if(save){ try{ localStorage.setItem('htpds.scale',k);}catch(e){} } }
  return k;
}
function onScale(v){ applyScale(v, true); }
function onAction(v){
  if(v==='upload'){ onUpload(); }
  else if(v==='newfolder'){ newFolderQ(); }
  else if(v==='collapse-nav'){ document.body.classList.toggle('nav-collapsed'); }
  else actMulti(v);
}
function onUpload(){ showFloating(); }
function onBtn(v){
  if(v==='upload')showFloating();
  else if(v==='notify')toast('暂无新通知');
  else if(v==='avatar')toast('演示环境：当前登录 张研');
}
function onDialogs(v){
  if(!v)return;
  if(v==='cancel')dlgKey('cancel');
  else if(v==='ok')dlgKey('ok');
  else if(v.indexOf('c/')===0){ 
    var sub=v.slice(2);
    if(sub==='down')toast('开始下载（演示）');
    else if(sub==='move')toast('移动目标选择（演示端点）');
    closeDrawerBox();
  }
  else if(v==='rm'){ }
}

/* ================= 列表容器事件（持久绑定，渲染后仍可用） ================= */
function bindRows(){
  if(!D.list)return;
  // click：区分行、复选框
  D.list.addEventListener('click',function(ev){
    var t=ev.target;
    var more=t.closest?t.closest('[data-r="menu"]'):null;
    if(more){ // ⋯
      var r0=more.closest('.file-row');
      if(r0)rowContextMenuHere(r0, ev);
      ev.stopPropagation&&ev.stopPropagation();
      return;
    }
    var row=t.closest?t.closest('.file-row'):null;
    if(!row)return;
    var ck=t.closest('[data-w="row"]');
    if(ck){
      var ci=+(row.getAttribute('data-i'));
      if(selIdx.has(ci))selIdx.delete(ci); else selIdx.add(ci);
      anchor=ci; postRenderRows();
      return;
    }
    pickRow(row,ev);
  });
  // contextmenu（右键）
  D.list.addEventListener('contextmenu',function(ev){
    var row=ev.target.closest?ev.target.closest('.file-row'):null;
    if(!row){closeMenu();return;}
    ev.preventDefault();
    rowContextMenu(row,ev.clientX,ev.clientY);
  });
  // 双击打开
  D.list.addEventListener('dblclick',function(ev){
    var row=ev.target.closest?ev.target.closest('.file-row'):null;
    if(!row)return;
    var di=+(row.getAttribute('data-i'));
    var it=itemList[di];
    if(!it)return;
    if(it.f)openFolder(it); else openDetail(it);
  });
}
function menuForRowItem(it,x,y){ hullRowData(it,x,y); }
function rowContextMenu(row,x,y){ rowContext(row,x,y); }
function rowContextMenuHere(row){ rowContext(row,10,10); }
function onCheckAllChange(){
  setSelAll(!!this.checked);
}
function hideItVia(elm){
  if(elm)elm.hidden=true;
}
/* 上传浮层按钮 */
function touchUpload(){
  showFloating();
  var trg=$('uploadFloatTrg');
  if(trg){
    trg.onclick=function(){
      if(D.upPanel)D.upPanel.hidden=!D.upPanel.hidden;
    };
  }
  var close=$('upClosePanel');
  if(close)close.onclick=function(){ hideItVia(D.upF); };
  var pin=$('upPin');
  if(pin)pin.onclick=function(){
    showFloating();
  };
}
/* ================= 拖拽上传 ================= */
var _ddDepth=0;
function _ddMark(on){ var w=D&&D.wrap; if(w){ if(on)w.classList.add('dragover'); else w.classList.remove('dragover'); } }
function _ddReset(){ _ddDepth=0; _ddMark(false); }
var _pendingLive=0, _autoTimer=null;
function _progScale(row,rate,tt){
  var w=row.querySelector('.up-bar i'); if(w)w.style.width=rate;
  var t=row.querySelector('.rt'); if(t&&tt&&tt!==undefined)t.textContent=tt;
}
function hideFloatAfter(ms){
  if(_autoTimer)clearTimeout(_autoTimer);
  _autoTimer=setTimeout(function(){
    _autoTimer=null;
    if(_pendingLive>0)return;
    var uf=document.getElementById('uploadFloat');
    var pn=document.getElementById('uploadPanel');
    if(uf&&!uf.hidden)uf.hidden=true;
    if(pn&&!pn.hidden)pn.hidden=true;
  },ms);
}
function finishJob(row){
  if(row.getAttribute('data-done'))return;
  row.setAttribute('data-done','1');
  _progScale(row,'100%','上传完成');
  _pendingLive--; if(_pendingLive<0)_pendingLive=0;
  hideFloatAfter(900);
}
function addDroppedTask(f){
  var node=D.upTasks; if(!node||!f)return;
  if(!node.children.length){
    if(D.upF)D.upF.hidden=false;
    if(D.upPanel)D.upPanel.hidden=false;
  }
  var name=f.name||'未命名';
  var b=f.size||0;
  var mb=b>0?(b/1048576).toFixed(1)+' MB':'';
  var row=document.createElement('div');
  row.className='up-task';
  row.innerHTML='<div class="up-task__top">'+
      '<span class="up-file-ico">'+FF+'</span>'+
      '<span class="up-task__name">'+esc(name)+
        (mb?'<small>'+mb+'</small>':'')+
      '</span></div>'+
    '<div class="up-bar"><i style="width:12%"></i></div>'+
    '<div class="up-task__rate"><span class="rt">排队上传…</span><span>'+mb+'</span></div>';
  node.insertBefore(row,node.firstChild);
  _pendingLive++;
  var fiv=row.querySelector('.up-bar i');
  if(fiv)fiv.style.transition='width .5s ease';
  setTimeout(function(){ _progScale(row,'90%','上传中…'); },220);
  setTimeout(function(){ finishJob(row); },1000);
}
function handleDrop(e){
  if(e.preventDefault)e.preventDefault();
  if(e.stopPropagation)e.stopPropagation();
  var fs=e.dataTransfer&&e.dataTransfer.files;
  _ddReset();
  if(!fs||!fs.length)return;
  var i,m;
  for(i=0,m=fs.length;i<m;i++)addDroppedTask(fs[i]);
  toast('已加入上传：'+fs.length+' 个文件');
}
function dndUI(){
  var w=D&&D.wrap; if(!w)return;
  w.addEventListener('dragenter',function(){ _ddDepth++; if(_ddDepth===1)_ddMark(true); });
  w.addEventListener('dragover',function(ev){ if(ev.preventDefault)ev.preventDefault(); if(ev.dataTransfer)ev.dataTransfer.dropEffect='copy'; });
  w.addEventListener('dragleave',function(){ _ddDepth--; if(_ddDepth<=0)_ddReset(); });
  w.addEventListener('drop',handleDrop);
  document.addEventListener('dragend',_ddReset);
  document.addEventListener('drop',function(ev){ if(ev.preventDefault)ev.preventDefault(); if(ev.target&&ev.target!==w)_ddReset(); });
}
/* 键盘 */
function onKey(ev){
  if(ev.key==='Escape'){
    closeDialog(); closeMenu(); closeDrawerBox();
  }else if((ev.key==='F2')){
    // 重命名焦点行（如果恰有单选）先不实现
  }else if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='a'){
    var tag=(ev.target&&ev.target.tagName);
    if(tag!=='INPUT'&&tag!=='TEXTAREA'){ ev.preventDefault(); setSelAll(!(selIdx.size===itemList.length)); }
  }
}

function initApp(){
  prep();
  if(!D.list||!D.crumb){ if(console&&console.warn)console.warn('霍桐所需节点缺失'); return; }
  document.body.addEventListener('click',onBodyClick,true);
  bindRows();
  if(D.chkAll)D.chkAll.addEventListener('change',onCheckAllChange);
  if(D.crumb){ /* crumb handled in onBodyClick */ }
  touchUpload();
  dndUI();
  document.addEventListener('keydown',onKey,false);
  // 初始视角
  if(!seg.length)seg=BASE_SEG.slice();
  load();
  toggleViewUI();
  var _sk='m'; try{ var _q=localStorage.getItem('htpds.scale'); if(_q==='s'||_q==='m'||_q==='l')_sk=_q; }catch(e){}
  applyScale(_sk,false);
  D.drawer.setAttribute('aria-hidden','true');
  if(D.scrim)D.scrim.hidden=true;
  updatePill('A');
  var shown=$('uploadFloat'); if(shown)shown.hidden=true;
  if(console&&console.info)console.info('霍桐PDS 原型就绪');
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initApp);
}else{
  initApp();
}

})();
