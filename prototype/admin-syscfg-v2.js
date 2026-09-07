/* 霍桐PDS · 系统配置 V2 页面增强
   不改现有配置数据与保存逻辑，只调整展示文案与信息层级。 */
(function(){
'use strict';
if(typeof window==='undefined')return;
var Routes=window.Routes=window.Routes||{};
var raw=Routes.syscfg;
if(typeof raw!=='function')return;
function refine(){
  var page=document.querySelector('.admin-app[data-key="syscfg"] .a-page');
  if(!page)return;
  var desc=page.querySelector('.admin-page-head__desc');
  if(desc)desc.textContent='集中配置存储、上传、回收站和预览服务参数。';
  var meta=page.querySelector('.admin-page-head__meta');
  if(meta)meta.remove();
  var note=page.querySelector('.admin-toolbar .toolbar-left .u-faint');
  if(note)note.textContent='修改后统一保存；敏感参数只由服务端读取。';
  var last=page.querySelector('#lastSave');
  if(last)last.textContent=last.textContent.replace('上次保存：','最近保存：');
  var save=page.querySelector('#saveAll');
  if(save)save.textContent='保存配置';
  var asideTitle=page.querySelector('.cfg-aside .panel__head .t');
  if(asideTitle)asideTitle.textContent='最近修改';
  var env=page.querySelector('#envBtn');
  if(env)env.textContent='导出配置样例';
  var json=page.querySelector('#jsonBtn');
  if(json)json.textContent='查看配置快照';
  var test=page.querySelector('#testConn');
  if(test)test.textContent='检测连接';
  var map={
    'OSS / 存储':'对象存储',
    '上传 / 分片':'上传设置',
    '回收站':'回收站',
    '预览 / 转换':'预览与转换'
  };
  [].forEach.call(page.querySelectorAll('.form-sec__t'),function(t){
    var main=t.querySelector('span');
    if(main&&map[main.textContent])main.textContent=map[main.textContent];
    var sub=t.querySelector('small');
    if(sub){
      sub.textContent=sub.textContent
        .replace('对象存储连接参数','连接与存储位置')
        .replace('上传策略','分片与直传参数')
        .replace('保留周期与容量提醒','保留周期与容量提醒')
        .replace('预览转换服务','转换服务与输出设置');
    }
  });
  [].forEach.call(page.querySelectorAll('.field-label'),function(n){
    n.textContent=n.textContent
      .replace('地域','存储地域')
      .replace('服务地址','服务地址')
      .replace('分片大小','分片大小')
      .replace('并发数','上传并发')
      .replace('分片保留天数','分片保留时间')
      .replace('直传域名','直传地址')
      .replace('保留天数','文件保留时间')
      .replace('容量告警阈值','容量提醒阈值')
      .replace('心跳超时','服务心跳超时')
      .replace('转换并发','转换并发档')
      .replace('输出目录','输出目录');
  });
}
Routes.syscfg=function(){
  var r=raw.apply(this,arguments);
  refine();
  return r;
};
})();