/* 霍桐PDS · 管理后台页面二次精修（不改业务数据与事件逻辑）
   本文件只包装现有 Routes，渲染完成后做文案与结构轻量清理。 */
(function(){
'use strict';
if(typeof window==='undefined'||!window.Routes)return;

function text(sel,txt){var n=document.querySelector(sel);if(n)n.textContent=txt;}
function removeQuoteNodes(root){
  if(!root)return;
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null,false),nodes=[],n;
  while((n=w.nextNode())){if(n.nodeValue&&n.nodeValue.trim()==='"')nodes.push(n);}
  nodes.forEach(function(x){x.nodeValue='';});
}

function refinePerms(){
  var page=document.querySelector('.admin-app[data-key="perms"] .a-page');
  if(!page)return;
  text('.admin-page-head__desc','按空间设置成员的浏览、预览、下载、上传、编辑和删除权限。');
  var meta=page.querySelector('.admin-page-head__meta');if(meta)meta.remove();
  var scopeLabel=page.querySelector('.admin-toolbar .fl');if(scopeLabel)scopeLabel.textContent='当前空间';
  var batch=page.querySelector('[data-p="batch"]');if(batch)batch.textContent='批量设置';
  var sideTitle=page.querySelector('.dtree-panel>.panel__head .t');if(sideTitle)sideTitle.textContent='空间成员';
  var group=page.querySelector('.perm-group__t');if(group)group.textContent='成员权限';
  var save=page.querySelector('[data-p="save"]');if(save)save.textContent='保存';
  var cancel=page.querySelector('[data-p="cancel"]');if(cancel)cancel.textContent='恢复默认';
  var saveNote=page.querySelector('.pe-save-note');if(saveNote)saveNote.textContent='修改后点击保存生效。';
  var presetLabel=page.querySelector('.pe-presets .lbl');if(presetLabel)presetLabel.textContent='权限预设';
  [].forEach.call(page.querySelectorAll('.preset'),function(b){
    b.textContent=b.textContent.replace('（读写）','').replace('（可删）','').replace('浏览+预览+下载','预览下载');
  });
  [].forEach.call(page.querySelectorAll('.cap-title .u-faint'),function(n){
    n.textContent=n.textContent.replace('依赖：','需：');
  });
  removeQuoteNodes(page);
}

function refineSyscfg(){
  var page=document.querySelector('.admin-app[data-key="syscfg"] .a-page');
  if(!page)return;
  text('.admin-page-head__desc','配置存储、上传、回收站与预览服务的基础参数。');
  var meta=page.querySelector('.admin-page-head__meta');if(meta)meta.remove();
  var toolbarNote=page.querySelector('.admin-toolbar .toolbar-left .u-faint');
  if(toolbarNote)toolbarNote.textContent='修改后统一保存；敏感信息不在前端展示明文。';
  var save=page.querySelector('#saveAll');if(save)save.textContent='保存配置';
  var recent=page.querySelector('.cfg-aside .panel__head .t');if(recent)recent.textContent='最近修改';
  var env=page.querySelector('#envBtn');if(env)env.textContent='导出配置样例';
  var json=page.querySelector('#jsonBtn');if(json)json.textContent='查看配置快照';
  var test=page.querySelector('#testConn');if(test)test.textContent='检测连接';
  [].forEach.call(page.querySelectorAll('.form-sec__t small'),function(n){
    var t=n.textContent;
    t=t.replace('对象存储声明配置','对象存储连接参数')
       .replace('边界配置','上传策略')
       .replace('保留与告警','保留周期与容量提醒')
       .replace('worker 心跳与资源','预览转换服务');
    n.textContent=t;
  });
  [].forEach.call(page.querySelectorAll('.field-label'),function(n){
    n.textContent=n.textContent.replace('Endpoint 域名','服务地址')
      .replace('分片阈值','分片大小')
      .replace('分片并发','并发数')
      .replace('占用告警阈值(GB)','容量告警阈值')
      .replace('心跳超时(秒)','心跳超时')
      .replace('转换并发档','转换并发')
      .replace('产物目录','输出目录')
      .replace('水印密钥','水印密钥');
  });
}

function wrap(name,fn){
  var old=window.Routes[name];
  if(typeof old!=='function')return;
  window.Routes[name]=function(){var r=old.apply(this,arguments);fn();return r;};
}
wrap('perms',refinePerms);
wrap('syscfg',refineSyscfg);
})();
