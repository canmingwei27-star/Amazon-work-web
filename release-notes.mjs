export const APP_VERSION='1.2.10';

export const RELEASES=Object.freeze({
 '1.2.0':'新增网页系统更新、自动检查、更新前备份和失败回滚',
 '1.2.1':'长表格增加底部悬浮横向滚动条',
 '1.2.2':'工作区表格增加吸顶表头',
 '1.2.3':'固定表头覆盖全部模块，并升级圆润毛玻璃界面',
 '1.2.4':'新增页面切换、滑动和点击反馈动画',
 '1.2.5':'金额、小数指标和百分比统一显示两位小数',
 '1.2.6':'修复店铺归属，统一币种入口并在筛选变化后自动刷新',
 '1.2.7':'更新记录增加版本号和版本特性说明',
 '1.2.8':'全局查询时间升级为赛狐风格双月日历和快捷日期范围',
 '1.2.9':'优化更新记录、版本特性展示和固定方向进度条；统一宽表底部滑条',
 '1.2.10':'新增手机端响应式布局，优化导航、表单、卡片、弹窗与宽表操作'
});

export function enrichUpdateStatus(status){
 const events=(status.events??[]).map(event=>({...event}));
 let attributed=false;
 for(let index=events.length-1;index>=0;index--){const event=events[index];if(!attributed&&event.phase==='updated'&&!event.version&&status.currentVersion){event.version=String(status.currentVersion);attributed=true;}if(event.version&&!event.feature)event.feature=RELEASES[event.version]??'该版本未登记特性说明';}
 return {...status,currentRelease:RELEASES[APP_VERSION],events};
}
