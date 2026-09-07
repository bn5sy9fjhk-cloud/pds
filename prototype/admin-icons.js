/* =====================================================================
   霍桐PDS · 管理端统一线性图标 Registry  admin-icons.js
   —— 唯一图标来源（管理端全部页：nav / toolbar / row actions / dialog / drawer）。
   使用规范（见管理端 UI 规范）：
     · viewBox=0 0 20 20
     · 默认渲染 16×16；工具栏 16；小型单元格/表格操作 14
     · stroke=currentColor，基本 fill=none，stroke-width=1.5
     · linecap=round / linejoin=round
     · 方向展开态：父元素挂 CSS .ai-open (=rotate 90deg)，禁止用字符 ▾▸…
   除状态圆点 / more 三圆点外不填充。
   所有管理页面经 admin-core 导出 H.i 使用，禁止页面各自重绘 SVG。
   依赖：无。
   ===================================================================== */
(function (global) {
  'use strict';

  /* 每个 key：同源“片段”只能定义一次；均由统一根 <g> 提供描边/端/角 */
  var P = {
    /* ---- 导航 / 模块 ---- */
    overview: '<path d="M3.2 10.4 10 3.6l6.8 6.8M4.6 8.9v7.6h10.8V8.9" /><rect x="7.2" y="12.4" width="5.6" height="4.1" />',
    home:     '<path d="M2.9 9.7 10 3.5l7.1 6.2M4.4 8v9.1h11.2V8" /><path d="M10 17.1v-3.1" />',
    org:      '<rect x="2.2" y="4.4" width="6.2" height="4.2" rx="1" /><rect x="11.6" y="4.4" width="6.2" height="4.2" rx="1" /><path d="M2.2 13.6h15.6M4.2 8.6v4.8h4M14 8.6v4.8h4M8.8 12.2v0M5 12.9H5" />',
    user:     '<circle cx="10" cy="6.4" r="2.7" /><path d="M4 17.2c.4-2.9 2.7-4.3 6-4.3 3.4 0 5.6 1.4 6 4.3" />',
    users:    '<circle cx="7.6" cy="6.6" r="2.6" /><path d="M2.6 16.8c.6-2.7 2.6-4 5-4 1.2 0 2.3.3 3.2.9M13.5 4.5a2.6 2.6 0 1 1-.7 5.1M12.6 13.6c1-.7 2.1-1 3.3-1 1.3 0 2.5.4 3.3 1.2" />',
    department:'<rect x="3.2" y="5.4" width="13.6" height="11" rx="1.2" /><path d="M3.2 8H7V5.4M6.4 13.4v-1.8h3.1v3h6.5" /><rect x="7.7" y="9.2" width="2" height="2.4" />',
    folder:   '<path d="M2.2 6.6a1.4 1.4 0 0 1 1.4-1.4h4.3l1.7 2.1h7a1.4 1.4 0 0 1 1.4 1.4v7.8a1.4 1.4 0 0 1-1.4 1.4H3.6a1.4 1.4 0 0 1-1.4-1.4Z" />',
    drive:    '<path d="M3.2 6.6a1.4 1.4 0 0 1 1.4-1.4h4.3l1.7 2.1h6.2a1.4 1.4 0 0 1 1.4 1.4v7.6a1.4 1.4 0 0 1-1.4 1.4H4.6a1.4 1.4 0 0 1-1.4-1.4Z" /><circle cx="14.7" cy="11.4" r="1.2" />',
    permission:'<path d="M10 2.9 16.5 5v4.9c0 3.7-2.4 6.2-6.5 7.2-4.1-1-6.5-3.5-6.5-7.2V5Z" /><path d="M7.6 10.1l1.7 1.7 3.1-3.6" />',
    shield:   '<path d="M10 2.8 16 5v5c0 3.8-2.4 6.3-6 7.2-3.6-.9-6-3.4-6-7.2V5Z" /><path d="M7.8 10l1.6 1.7 2.9-3.3" />',
    quota:    '<path d="M10 3v14M10 3 6 6.4M10 3l4 3.4M10 17l-3.4-3.2M10 17l3.4-3.2" transform="rotate(0 10 10)" /><path d="M3.6 14.4 14.7 5.6" />',
    storage:  '<rect x="2.6" y="6.6" width="14.8" height="7" rx="1.6" /><path d="M5.7 6.6 8.4 4h3.2l2.7 2.6M2.6 10.2h3M7.5 13.6v-1.4h5v1.4M14.4 13.6v-4M2.6 12.5v-1.2" />',
    audit:    '<rect x="3.2" y="3.6" width="13.6" height="12.8" rx="1.2" /><path d="M6.4 7.6h7.2M6.4 10.6h7.2M6.4 13.6h4.6" />',
    settings: '<path d="M8.7 2.7h2.6l.6 2.3a6.2 6.2 0 0 1 1.6.8l2.3-.7 1.3 1.3-.8 2.3c.3.5.6 1 .7 1.6l2.2.5v2.6l-2.2.6c-.2.6-.5 1.1-.8 1.6l.8 2.3-1.3 1.3-2.3-.8c-.5.3-1.1.6-1.7.7l-.5 2.2H8.7l-.5-2.2a6.5 6.5 0 0 1-1.7-.7l-2.3.9L2.8 19l.9-2.4a6 6 0 0 1-.8-1.6l-2.2-.7v-2.6l2.2-.5c.3-.5.5-1.1.7-1.6l-.7-2.3 1.3-1.3 2.3.7c.5-.3 1-.6 1.6-.8Z" />',
    role:     '<circle cx="7" cy="8" r="2.4" /><path d="M2.4 17c.6-2.5 2.2-4 4.6-4 2.2 0 3.8 1.3 4.5 3.6M16 8.4v5.2M13.4 11h5.2" />',
    space:    '<rect x="3" y="3.6" width="14" height="9.6" rx="1.2" /><path d="M3.6 15.6h12.8M5.6 13.2v2.4M9 13.2v4.4" />',
    calendar: '<rect x="2.9" y="3.6" width="14.2" height="13.4" rx="1.4" /><path d="M2.9 7.2h14.2M6.6 2.6V5M13.4 2.6V5M6.2 11.4h2.2" />',
    clock:    '<circle cx="10" cy="10" r="6.6" /><path d="M10 6.4V10l2.5 1.8" />',

    /* ---- 动作 / 操作 ---- */
    add:      '<path d="M10 4v12M4 10h12" />',
    userAdd:  '<circle cx="8.6" cy="6.8" r="2.6" /><path d="M2.4 17c.5-2.8 2.8-4.3 6.2-4.3 1.5 0 2.8.4 3.8 1.1M15.4 10.4v5.2M12.8 13h5.2" />',
    sync:     '<path d="M16.8 6.6a6.4 6.4 0 1 0 .5 7.3M16.8 2.8v3.8H13M16.9 10H3.1" />',
    refresh:  '<path d="M17 10a7 7 0 1 1-2-4.9M17 3.2v4H13M14.6 6.9l2.8 2.7" />',
    search:   '<circle cx="9.2" cy="9.2" r="5.2" /><path d="M13.4 13.4 17 17" />',
    filter:   '<path d="M2.6 4.6h14.8M5.2 10h9.6M7.7 15.4h4.6" />',
    more:     '<circle cx="5" cy="10" r="1.15" fill="currentColor" stroke="none" /><circle cx="10" cy="10" r="1.15" fill="currentColor" stroke="none" /><circle cx="15" cy="10" r="1.15" fill="currentColor" stroke="none" />',
    edit:     '<path d="M12 4.6 15.4 8 8 15.4 4.6 16l-.6-3.4Z" /><path d="M10.8 5.8 14.2 9.2" />',
    trash:    '<path d="M3.8 5.6h12.4M8 3.2h4l1.6 2.4H6.4ZM5.5 5.6l.7 10.6a1.4 1.4 0 0 0 1.4 1.3h4.8a1.4 1.4 0 0 0 1.4-1.3l.7-10.6M8.3 8.4v6M11.7 8.4v6" />',
    restore:  '<path d="M3.8 12.4H1.8M3.8 12.4V8M3.8 12.4 8.2 8M9.2 11.2h.8a2.1 2.1 0 0 0 0-4.2H7.6" />',
    disable:  '<circle cx="10" cy="10" r="6.8" /><path d="M6.2 6.2l7.6 7.6M5.5 10h9" />',
    enable:   '<circle cx="10" cy="10" r="6.8" /><path d="M7.4 10l1.8 1.8 3.4-3.8" />',
    detail:   '<circle cx="10" cy="10" r="6.6" /><path d="M10 9v4.6M10 6.3v.1" />',
    download: '<path d="M10 3v9M6.4 8.6 10 12.2l3.6-3.6M3.4 16.6h13.2" />',
    upload:   '<path d="M10 13V4M6.4 7.4 10 3.8l3.6 3.6M3.4 16.2h13.2" />',
    move:     '<path d="M2.2 6.1V3.6h9.6M3.6 1.4 7.4 5l-3.8 3.2M15 7.8v2.2a1.6 1.6 0 0 1-1.6 1.6H7.6" />',
    copy:     '<rect x="6.4" y="2.6" width="11" height="11.4" rx="1.3" /><path d="M2.6 6.4v10.4a1.4 1.4 0 0 0 1.4 1.4h10.4M13.6 12.8h-6" />',

    /* ---- 箭头 ---- */
    chevronRight:'<path d="M7.5 4.6 13 10l-5.5 5.4" />',
    chevronDown: '<path d="M4.6 7.5 10 13l5.4-5.5" />',
    chevronLeft: '<path d="M12.5 4.6 7 10l5.5 5.4" />',

    /* ---- 反馈 ---- */
    check:  '<path d="M4.2 10.6 8 14.4 15.8 5.8" />',
    close:  '<path d="M5.4 5.4l9.2 9.2M14.6 5.4l-9.2 9.2" />',
    warning:'<path d="M10 3 17.5 16h-15Z" /><path d="M10 8.4v3.8M10 14.4v.1" />',
    success:'<circle cx="10" cy="10" r="6.8" /><path d="M7 10.2 9.2 12.4 13.2 7.8" />',
    info:   '<circle cx="10" cy="10" r="6.6" /><path d="M10 8.9v4.4M10 6.6v.1" />',

    /* ---- 安全 ---- */
    lock:   '<rect x="4" y="8.6" width="12" height="8" rx="1.4" /><path d="M7 8.6V6.4a3 3 0 0 1 6 0v2.2" /><circle cx="10" cy="12.6" r="1.1" fill="currentColor" stroke="none" />',
    key:    '<circle cx="8" cy="8.6" r="3" /><path d="M14.4 10.2h.1M17 10c.2 3.4-2.4 6.2-6.2 5.9M11 8.8l4.2 4.2M15.3 9.7l1.3 1.3" />'
  };

  /* 业务语义直接引用（不改画布、不复制第二份片段的 <path> 引用，见 head 注释） */

  var tag = function (frag, size) {
    return '<svg viewBox="0 0 20 20" width="' + (size || 16) + '" height="' + (size || 16) +
      '" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + frag + '</g></svg>';
  };

  var api = {
    names: function () { return Object.keys(P); },
    get: function (name) { return P[name] || P.info; },
    /* 供 nav / CSS 直接输出经 root svg */
    mark: function (name, size) { return tag(api.get(name), size); },
    /* 供外层已有 svg（旧式 H.i 内联小图标）继续用：输出统一内联图标完整串 */
    icon: function (name, size) { return tag(api.get(name), size); }
  };

  global.AdminIcon = api;
})(typeof window !== 'undefined' ? window : this);
