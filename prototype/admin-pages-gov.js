/* ================================================================
   admin-pages-gov.js -- 治理中心页面块  (data-page: filegov / quota)
   纯前端 Mock：无后端 / 无第三方依赖 / 无 emoji；复用 window.H 与 UI 样式。
   写 / 删仅 UI 小步 + H.toast（演示数据），不做持久化。
   注册 window.Routes['filegov'] 与 ['quota']，由导航点击对应 data-page
   触发内部渲染（H.setPage）。文件由单一 IIFE 组装。
   ================================================================ */
(function () {
'use strict';

if (typeof window === 'undefined') return;
var Routes = window.Routes = window.Routes || {};
var H = window.H;

function esc(s) {
  s = s == null ? '' : s;
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
/* 图标全部委托给唯一 window.AdminIcon（20 网格 / currentColor / 1.5px） */
var IC = {
  refresh: 'refresh', sync: 'sync', check: 'check', folder: 'folder',
  dustbin: 'trash', trash: 'trash', flag: 'warning', clock: 'clock'
};
function ic(k, size) {
  return (window.AdminIcon && window.AdminIcon.icon(k, size || 16)) || '';
}
function pageHead(t, s, o) {
  var meta = (o && o.meta) || '演示 mock 数据，非后端实时量';
  return '<div class="admin-page-head"><h1>' + esc(t) + '</h1>' +
    '<p class="admin-page-head__desc">' + esc(s || '') + '</p>' +
    '<div class="admin-page-head__meta">' + esc(meta) + '</div></div>';
}
function tag(kind, text) {
  var m = { file: 'primary', ok: 'ok', warn: 'warn', danger: 'danger', folder: 'plain' };
  return '<span class="tag tag--' + (m[kind] || 'plain') + '">' + esc(text) + '</span>';
}
function th(w, label, cls) {
  return '<th style="width:' + w + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(label) + '</th>';
}
function tdCell(html, n) {
  return '<td style="padding:0 ' + (n || 12) + 'px">' + html + '</td>';
}
function linkRow(acts) {
  var o = '';
  for (var i = 0; i < acts.length; i++) o += '<a class="t-a' + (acts[i].d ? ' is-danger' : '') + '" data-a="' + acts[i].a + '" data-i="' + acts[i].i + '">' + esc(acts[i].t) + '</a>';
  return '<div class="rest">' + o + '</div>';
}
function tdOp(op) { /* op = {a,i,t,d} */ return '<td style="width:110px"><div class="rest">' + '<a class="t-a' + (op.d ? ' is-danger' : '') + '" data-a="' + op.a + '" data-i="' + op.i + '">' + esc(op.t) + '</a></div></td>'; }
function ext(n) { var m = n.match(/\.([A-Za-z0-9]+)$/); return m ? m[1].toUpperCase() : '文件'; }
function pillBadge(n) { return '<span class="pill-badge">' + esc(n) + '</span>'; }

/* =================================================================
   data-page: filegov — 文件 / 回收站治理（治理定位 · 非代删）
   ================================================================= */
Routes['filegov'] = (function () {
  var SCOPES = ['研发部（部门盘）', '生产部（部门盘）', '销售部（部门盘）', '张研（个人盘）', '李四（个人盘）'];
  var curS = 0;   // scope index
  var tabI = 0;   // 0 文件浏览 / 1 回收站
  var TRASH = [
    { p: '/研发部/产品资料/2026/设计图纸/DWG-001-H组装.dwg', by: '王五', at: '2026-09-04 09:31', keep: 12, sz: '24.6 GB', ok: true },
    { p: '/研发部/工艺文件/2026Q3 工艺规划.xlsx', by: '李四', at: '2026-09-02 16:02', keep: 5, sz: '0.9 GB', ok: true },
    { p: '/研发部/测试数据/压测记录-oldV3.log', by: '赵六', at: '2026-08-31 11:20', keep: 2, sz: '6.4 GB', ok: true },
    { p: '/生产部/设备档案/退线夹具-archive.dwg', by: '郑八', at: '2026-09-01 14:05', keep: 19, sz: '3.1 GB', ok: true },
    { p: '/销售部/线索管理/重复导入批次.bak', by: '孙丽', at: '2026-08-27 10:10', keep: 30, sz: '0.4 GB', ok: true },
    { p: '/张研/我的文档/草稿/旧简历-2025.zip', by: '张研', at: '2026-08-25 09:40', keep: 0, sz: '0.2 GB', ok: false }
  ];
  var FILE = {
    0: [
      ['DWG-001-H组装.dwg', '/研发部/产品资料/2026/设计图纸', '24.6 GB', '2026-09-04 10:21', '王五'],
      ['设备平台模型_G3.step', '/研发部/产品资料/2026', '86.2 GB', '2026-09-03 18:42', '张三'],
      ['技术规格表-终审.xlsx', '/研发部/工艺文件', '0.9 GB', '2026-09-02 15:20', '李四'],
      ['拓扑验证报告-Final.pdf', '/研发部/测试数据', '2.1 GB', '2026-09-01 09:44', '赵六'],
      ['渲染源文件-项目A.zip', '/研发部/市场支撑/渲染', '12.4 GB', '2026-08-30 11:02', '王五'],
      ['元器件采购清单Q3.xlsx', '/研发部/采购', '1.0 GB', '2026-08-28 16:18', '钱七']
    ],
    1: [['产线点检表-5号线.xlsx', '/生产部/工艺文件', '0.5 GB', '2026-09-04 08:12', '郑八'],
      ['作业指导书-冲压A.pdf', '/生产部/工艺文件', '1.8 GB', '2026-09-02 13:40', '郑八'],
      ['设备图纸M6-工位.step', '/生产部/设备档案', '14.0 GB', '2026-08-31 10:05', '吴九']],
    2: [['海外报价单-统单.pdf', '/销售部/报价归档', '1.2 GB', '2026-09-03 15:12', '孙丽'],
      ['客户线索池-清洗.xlsx', '/销售部/线索管理', '9.9 GB', '2026-09-01 11:22', '孙丽']],
    3: [['个人2026作品集.pdf', '/我的文档/作品集', '1.3 GB', '2026-09-02 20:41', '张研'],
      ['家庭影像-整理优化.zip', '/我的文档/备份', '8.1 GB', '2026-08-26 22:10', '张研'],
      ['随笔随感.xlsx', '/我的文档/汇总', '0.04 GB', '2026-08-24 09:00', '张研']],
    4: [['获奖证书扫描-2025.pdf', '/我的文档/证书', '0.6 GB', '2026-09-01 19:05', '李四'],
      ['参考零件模型.step', '/设计/临期归档', '18.2 GB', '2026-08-29 08:33', '李四']]
  };

  function rows() { return FILE[curS] || []; }
  function scOpts() {
    var h = '';
    for (var i = 0; i < SCOPES.length; i++) h += '<option value="' + i + '"' + (i === curS ? ' selected' : '') + '>' + esc(SCOPES[i]) + '</option>';
    return h;
  }
  function remainBox(d) {
    if (d <= 0) return tag('danger', '已过保留期');
    if (d <= 5) return tag('danger', d + ' 天');
    if (d <= 15) return tag('warn', d + ' 天');
    return tag('ok', d + ' 天');
  }
  function rName(p) { var a = p.split('/'); return a[a.length - 1]; }

  function filesView() {
    var rr = rows();
    var h = '<div class="tbl-scroll"><table class="table-x"><thead><tr>' +
      th('26%', '名称') + th('34%', '所属目录路径') + th('11%', '大小') + th('15%', '修改时间') + th('14%', '归属人')
      + '</tr></thead><tbody>';
    for (var i = 0; i < rr.length; i++) {
      var r = rr[i];
      h += '<tr>' + tdCell('<div class="tb-2line"><span class="tl">' + tag('file', ext(r[0])) + ' ' + esc(r[0]) + '</span>' +
        '<span class="ts">' + esc(r[0]) + '</span></div>', 12) + tdCell('<span class="u-faint">' + esc(r[1]) + '</span>', 12) +
        tdCell(esc(r[2]), 12) + tdCell(esc(r[3]), 12) + tdCell(esc(r[4]), 12) +
        '<td style="width:110px"><div class="rest"><a class="t-a is-danger" data-a="loc">定位回收</a></div></td>' + '</tr>';
      /* 定位回收 danger 链接走对话框确认 */
    }
    return h + '</tbody></table></div>';
  }
  function trashView() {
    var h = '<div class="tbl-scroll"><table class="table-x"><thead><tr>' +
      th('34%', '原始路径 / 回收', '') + th('24%', '删除人 / 时间') + th('13%', '保留剩余') + th('10%', '大小') + th('', '操作', 't-a')
      + '</tr></thead><tbody>';
    for (var i = 0; i < TRASH.length; i++) {
      var r = TRASH[i];
      h += '<tr>' +
        tdCell('<div class="tb-2line"><span class="tl">' + esc(rName(r.p)) + '</span>' +
        '<span class="ts">' + esc(r.p) + '</span></div>', 12) +
        tdCell('<div class="tb-2line"><span class="tl">' + esc(r.by) + '</span><span class="ts">' + esc(r.at) + '</span></div>', 12) +
        tdCell(remainBox(r.keep), 12) + tdCell(esc(r.sz), 12) +
        '<td style="width:150px"><div class="rest">' +
        (r.ok ? '<a class="t-a" data-a="recover" data-i="' + i + '">恢复</a>' : '<span class="u-faint">—</span>') +
        '<a class="t-a is-danger" data-a="purge" data-i="' + i + '">彻底删除</a></div></td>' + '</tr>';
    }
    return h + '</tbody></table></div>';
  }

  function contentHTML() {
    var body;
    var heads;
    if (tabI === 0) {
      body = filesView();
      heads = '文件清单 · 所属：' + esc(SCOPES[curS]);
    } else {
      body = trashView();
      heads = '回收站（按所辖空间） · ' + TRASH.length + ' 条';
    }
    return '<div class="admin-toolbar"><div class="toolbar-left"><span class="fl">范围（所辖）</span>' +
      '<select class="sel scope-fg" data-fgScope>' + scOpts() + '</select>' +
      '<span class="result u-faint" data-count></span></div>' +
      '<div class="toolbar-right"><button class="btn btn--ghost" data-refresh>' + ic(IC.refresh) + '刷新（演示）</button></div></div>' +
      '<nav class="tabbar">' +
      '<button class="tab' + (tabI === 0 ? ' tab--on' : '') + '" data-tab="0">' + ic(IC.folder) + '文件 · 浏览 ' + pillBadge(rows().length) + '</button>' +
      '<button class="tab' + (tabI === 1 ? ' tab--on' : '') + '" data-tab="1">' + ic(IC.dustbin) + '回收站 ' + pillBadge(TRASH.length) + '</button>' +
      '<span class="spacer"></span>' +
      '<button class="btn btn--danger btn--small" data-empty>' + ic(IC.dustbin) + '清空回收站</button>' +
      '</nav>' +
      '<section class="panel data-panel">' +
      '<div class="panel__head"><span class="t">' + (tabI === 0 ? '文件 · 浏览' : '回收站（按所辖空间）') + '</span><span class="u">' + heads + '</span></div>' +
      '<div class="panel__body">' + body + '</div></section>' +
      '<p class="x-note">治理仅限所辖空间不代删：“定位回收”只引导到该空间可逆回收站，不做跨空间全局删除。以上全部为演示数据。</p>';
  }

  function render() {
    H.setPage(pageHead('文件 / 回收站治理', '治理：“定位回收”只引导进入可逆回收路径；管理员不得越空间清零删除。') + contentHTML());
  }
  function draw() {
    var sel = document.querySelector('[data-fgScope]');
    if (sel && +sel.value !== curS) curS = +sel.value;
    var tabs = document.querySelectorAll('.tab[data-tab]');
    for (var i = 0; i < tabs.length; i++) tabs[i].className = 'tab' + (+tabs[i].getAttribute('data-tab') === tabI ? ' tab--on' : '');
    var main = document.querySelector('.panel__body');
    var count = document.querySelector('[data-count]');
    if (count) count.textContent = '共 ' + rows().length + ' 条 · ' + esc(SCOPES[curS]) + '（演示数据）';
    if (!main) return;
    main.innerHTML = tabI === 0 ? filesView() : trashView();
  }
  function bind() {
    var root = H.root();
    if (!root) return;
    function once(sel, type, fn) { var e = root.querySelector(sel); if (e) e.addEventListener(type, fn); }
    once('[data-tab="0"]', 'click', function () { tabI = 0; draw(); });
    once('[data-tab="1"]', 'click', function () { tabI = 1; draw(); });
    once('[data-refresh]', 'click', function () { draw(); H.toast('演示快照已刷新'); });
    once('[data-empty]', 'click', function () {
      if (!TRASH.length) { H.toast('回收站已空'); return; }
      H.dialog({
        title: '清空回收站',
        cls: 'dialog',
        msg: '<div>将把<b>当前范围</b>回收站的 ' + esc(TRASH.length) + ' 条彻底删除。清空为整批不可逆操作，仅按当前所辖空间作用（演示 mock，仅本会话）。</div>',
        actions: '<button class="btn btn--ghost" data-act="no">取消</button>' +
          '<button class="btn btn--danger" data-act="ok">清空并删除</button>',
        onOk: function () { TRASH.length = 0; draw(); H.toast('回收站已清空（演示数据）'); }
      });
    });
    once('[data-fgScope]', 'change', function (e) { curS = +e.target.value; draw(); H.toast('已切换"范围"演示快照到：' + esc(SCOPES[curS])); });
    /* 行级操作统一委托在持久 container（draw 仅重刷其 inner，不移除监听）。 */
    var main = root.querySelector('.panel__body');
    if (main) {
      main.addEventListener('click', function (e) {
        var a = e.target && e.target.closest ? e.target.closest('[data-a]') : null;
        if (!a) { return; }
        var kind = a.getAttribute('data-a');
        if (kind === 'loc') {
          H.dialog({
            title: '定位回收',
            cls: 'dialog',
            msg: '<div>将把该对象引入其所在空间的“回收站”，保留恢复入口。治理定位可逆，不跨空间“物理删除”。</div>',
            actions: '<button class="btn btn--ghost" data-act="no">取消</button>' +
              '<button class="btn btn--primary" data-act="ok">转至回收站定位</button>',
            onOk: function () { H.toast('已定位到该空间回收站（可逆治理，演示数据）'); }
          });
          return;
        }
        var i = +a.getAttribute('data-i');
        var tr = TRASH[i];
        if (!tr) return;
        if (kind === 'recover') {
          TRASH.splice(i, 1); draw();
          H.toast('已恢复「' + rName(tr.p) + '」（原位若被占用将自动改名，演示数据）');
        } else if (kind === 'purge') {
          var rm = tr;
          H.dialog({
            title: '彻底删除（危险）',
            cls: 'dialog',
            msg: '<div>将把该回收对象彻底移出回收站且<b>不可恢复</b>。仅针对单条回收对象，不做跨空间清除。确认此自删操作（演示 mock，仅本会话）。</div>',
            actions: '<button class="btn btn--ghost" data-act="no">取消</button>' +
              '<button class="btn btn--danger" data-act="ok">确认彻底删除</button>',
            onOk: function () {
              var at = TRASH.indexOf(rm); if (at >= 0) TRASH.splice(at, 1); draw(); H.toast('已彻底删除（演示数据）');
            }
          });
        }
      }, true);
    }
  }

  return function () {
    curS = 0; tabI = 0; /* 幂等重置快照，避免跨页脏状态 */
    render();
    setTimeout(bind, 0);
  };
})();

/* =================================================================
   data-page: quota — 配额管理（部门盘=父级唯一总量）
   数据源 window.H（drvs / getDepartmentDriveStats / driveUpdate），
   与空间管理(spaces)同一来源；本页只改“部门盘 quotaBytes”。
   子层（公共/个人盘）明细展示在 spaces 页，避免双写入。
   ================================================================= */
Routes['quota'] = (function () {
  var DEF = { f: 500 };
  function fmt(g){ return esc(H.fgb(Math.round(g*10)/10)); }
  function barCell(s, over){
    var q=s.quota||1, used=Math.min(s.used/q*100,100), reserved=Math.min(s.reserved/q*100,Math.max(0,100-used));
    var segs='';
    if(s.used)   segs+='<i style="background:var(--primary);width:'+used.toFixed(2)+'%"></i>';
    if(s.reserved)segs+='<i style="background:var(--warn);width:'+reserved.toFixed(2)+'%"></i>';
    if(over)      segs+='<i class="dq-over" style="width:3%"></i>';
    return '<div class="bar-col">'+
      '<span class="dq-bar">'+segs+'</span>'+
      '<span class="x-nums">已用 '+fmt(s.used)+' · 已预留 '+fmt(s.reserved)+
      ' · 可用 '+fmt(Math.max(s.available,0))+' / 总量 '+fmt(q)+'</span>'+
      (over?'<span class="dq-over-tag">超配额</span>':'')+'</div>';
  }
  function page(){
    var body='';
    H.drvs().forEach(function(d){
      var s=H.getDepartmentDriveStats(d.dept);
      var over=Math.round((s.used+s.reserved-s.quota)*100)/100 > 0;   // 编辑时不得小于此
      body +=
        '<tr data-dep="' + esc(d.dept) + '" data-over="' + (over ? 1 : 0) + '">' +
          '<td class="col-dr"><span class="q-drive">' + H.i('folder') +
            '<span class="tb-2line"><span class="tl">' + esc(d.dept) + ' 部门盘</span>' +
            '<span class="ts u-faint">' + esc(d.folderDrive) + ' · 已分配个人盘 ' + esc(String(s.personalDriveCount)) + ' 个</span></span></span></td>' +
          '<td class="col-state"><span class="tag ' + (d.public && d.public.off ? 'tag--warn' : 'tag--ok') + '">' + (d.public && d.public.off ? '停用' : '启用') + '</span></td>' +
          '<td class="col-total"><b>' + fmt(s.quota) + '</b></td>' +
          '<td class="col-used">' + barCell(s, over) + '</td>' +
          '<td class="col-op"><div class="rest"><a class="t-a" data-a="eDep" data-dep="' + esc(d.dept) + '">编辑总量</a></div></td>' +
        '</tr>';
    });
    var html = pageHead('配额管理', '父级 quotaBytes 是部门盘唯一配额；个人/公共盘明细只到“空间管理”，避免双写同一字段。') +
      '<div class="admin-toolbar">' +
        '<div class="toolbar-left"><label class="fl q-def">新建部门盘默认 quota&nbsp;' +
          '<select class="sel" data-deff><option value="200">200 GB</option><option value="500" selected>500 GB</option><option value="1000">1000 GB</option></select></label>' +
          '<span class="u-faint">演示默认 = ' + DEF.f + ' GB</span></div>' +
        '<div class="toolbar-right"><button class="btn btn--ghost" data-sdef>保存默认(mock)</button></div>' +
      '</div>' +
      '<section class="mod q-mod" data-qlist>' +
        '<header class="panel__head"><span class="t">部门盘 quota 一览</span>' +
          '<span class="u">父 quota 总量与『空间管理』同源 H.drvs（写在此处实时联动，不重复列表数据）</span></header>' +
        '<div class="panel__body qbody"><div class="table-body qu-o"><table class="table-x double-row">' +
        '<thead><tr><th>部门盘</th><th class="col-state">状态</th><th class="col-total">父 quotaBytes</th>' +
        '<th class="col-cap">容量 · used / reserved / available</th><th></th></tr></thead>' +
        '<tbody>' + body + '</tbody></table></div>' +
        '<p class="u-sub qcap">编辑父 quota 时客户端下限 ≥ 本部门（已用+预留）；不越过父总量即可继续给个人盘扩容分盘。</p></div>' +
      '</section>';
    return html;
  }
  function render(){ H.setPage(page()); bind(); }
  function bind(){
    var root=H.root(); if(!root) return;
    var once=function(sel,fn){ var e=root.querySelector(sel); if(e)e.addEventListener('click',fn); };
    once('[data-sdef]',function(){ H.toast('默认策略已保存（演示，新建部门用）'); });
    var initOnce=false;
    root.addEventListener('click',function(e){
      var a=e.target&&e.target.closest?e.target.closest('[data-a="eDep"]'):null;
      if(!a) return;
      editDep(a.getAttribute('data-dep'));
    });
  }
  function editDep(dep){
    var s=H.getDepartmentDriveStats(dep);
    var min=Math.max(1,Math.ceil((s.used+s.reserved)*10)/10);
    H.dialog({
      title:'编辑部门盘总量 · '+dep,
      msg:'父级 quotaBytes 是唯一部门配额字段；下限 ≥ 已用+预留 '+esc(String(min))+' GB。',
      form:'<label class="form-field"><span class="field-label">新 total（GB）</span>'+
           '<input class="inp" data-q type="number" step="1" min="'+min+'" value="'+s.quota+'" /></label>',
      actions:'<button class="btn btn--ghost" data-act="no">取消</button><button class="btn btn--primary" data-act="ok">保存</button>',
      onOk:function(){
        var dq=dlg && dlg.scope && dlg.scope.querySelector('[data-q]');
        var v=Number((dq&&dq.value)||0);
        if(!v || !isFinite(v) || v<min){ H.toast('校验失败：不得小于下限 '+min+' GB（客户端）'); return false; }
        H.driveUpdate(dep,'deptQuota',v);   // 共享源写入，spaces/@getStats同步
        render();
        H.toast('已更新『'+dep+' 部门盘』quota = '+v+' GB');
      }
    });
  }
  return function(){ render(); };
})();

Routes.GOV_END_FLAG = 1;
})();
