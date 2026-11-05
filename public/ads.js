let adsSnapshot=null,adsBusy=false,adsStale=false;
const adEl=s=>document.querySelector(s);
const adEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const adFmt=n=>n==null?'—':Number(n).toLocaleString('zh-CN',{maximumFractionDigits:2});
function renderAds(){
 const rows=adsSnapshot?.rows??[],high=rows.filter(r=>r.status==='high'),zero=rows.filter(r=>r.status==='no-sales'),unknown=rows.filter(r=>r.status==='unknown'),empty=rows.filter(r=>r.status==='no-data');
 adEl('#ad-summary').textContent=adsSnapshot?`ACOS > 25%：${high.length} 个；有花费无销售：${zero.length} 个；无小时记录：${empty.length} 个；待核对：${unknown.length} 个；未查询：${adsSnapshot.unqueried} 个${adsStale?' · 上次结果已过期':''}`:'尚未读取广告报告';
 adEl('#ad-alert').textContent=high.length||zero.length?`需要注意 ${high.length+zero.length} 个活动。优先检查下方红色活动的搜索词、竞价和商品转化。`:'当前已查询数据未发现阈值异常；未读取或数据不全的活动仍需核对。';
 adEl('#ad-alert').classList.toggle('danger',!!(high.length||zero.length));
 const shown=rows.filter(r=>!adEl('#ad-only').checked||['high','no-sales'].includes(r.status)).slice().sort((a,b)=>{const rank={high:0,'no-sales':0,unknown:1,normal:2};return rank[a.status]-rank[b.status]||(b.cost??0)-(a.cost??0);});
 adEl('#ad-rows').innerHTML=shown.map(r=>`<tr class="${['high','no-sales'].includes(r.status)?'ad-danger':''}">${[r.name,r.campaignId,adFmt(r.cost),adFmt(r.sales),r.acos==null?'—':(r.acos*100).toFixed(2)+'%',({high:'异常',normal:'未超阈值','no-sales':'有花费无销售',unknown:'待核对','no-data':'无小时数据'})[r.status],r.reason].map(v=>'<td>'+adEscape(v)+'</td>').join('')}</tr>`).join('');
 adEl('#ad-coverage').textContent=adsSnapshot?`${adsSnapshot.date} · 活动列表${adsSnapshot.listComplete?'已读完':'覆盖未确认'} · 已查询 ${adsSnapshot.queried}/${adsSnapshot.campaignsFetched} · 获取时间 ${new Date(adsSnapshot.fetchedAt).toLocaleString('zh-CN')}。${(adsSnapshot.warnings??[]).join(' ')}`:'SP 7 天归因；花费 ÷ 归因销售额 × 100%。25% 本身不标异常。金额为对应店铺原币种，接口未提供币种名称。';
}
async function loadAds(){if(adsBusy)return;adsBusy=true;adEl('#ad-refresh').disabled=true;adEl('#ad-status').textContent='读取活动列表与小时报告中，请稍候…';
 try{const response=await apiFetch('/api/ads?'+new URLSearchParams({shop:adEl('#ad-shop').value,date:adEl('#ad-date').value}));const data=await response.json();if(!response.ok)throw new Error(data.error||'广告查询失败');adsSnapshot=data;adsStale=false;adEl('#ad-status').textContent='查询完成，提醒仅覆盖本次返回的数据。';renderAds();}catch(e){adsStale=!!adsSnapshot;adEl('#ad-status').textContent=e.message+(adsStale?'；保留上次结果，已过期。':'');renderAds();}finally{adsBusy=false;adEl('#ad-refresh').disabled=false;}}
document.addEventListener('DOMContentLoaded',()=>{
 adEl('#ads-form').onsubmit=e=>{e.preventDefault();loadAds();};adEl('#ad-only').onchange=renderAds;
 adEl('#ad-date').value=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const populate=()=>{let rows;try{rows=JSON.parse(adEl('#shops').dataset.rows??'[]');}catch{return;}const previous=adEl('#ad-shop').value;adEl('#ad-shop').replaceChildren(...rows.map(r=>new Option(r.name,String(r.id))));if(rows.some(r=>String(r.id)===previous))adEl('#ad-shop').value=previous;};const observer=new MutationObserver(populate);observer.observe(adEl('#shops'),{attributes:true,attributeFilter:['data-rows']});populate();
 adEl('#tab-overview').onclick=()=>{adEl('#overview').hidden=false;adEl('#ads-panel').hidden=true;};adEl('#tab-ads').onclick=()=>{adEl('#overview').hidden=true;adEl('#ads-panel').hidden=false;};renderAds();
 setInterval(()=>{if(adEl('#ad-auto').checked&&!document.hidden&&!adEl('#ads-panel').hidden)loadAds();},300000);
});
