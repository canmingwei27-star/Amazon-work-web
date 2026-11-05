export function evaluate(cost,sales){
 const num=v=>v===null||v===undefined||String(v).trim()===''?null:Number(v);
 const c=num(cost),s=num(sales);
 if(c===null||s===null||!Number.isFinite(c)||!Number.isFinite(s)||c<0||s<0)return {acos:null,status:'unknown',reason:'数据缺失或无效，需核对报告'};
 if(s===0)return c>0?{acos:null,status:'no-sales',reason:'有花费无归因销售，检查搜索词、点击与转化'}:{acos:null,status:'unknown',reason:'无有效归因销售，暂不判断'};
 const acos=c/s;return {acos,status:c>s*.25?'high':'normal',reason:c>s*.25?'ACOS 超过 25%，检查高花费搜索词、竞价与商品转化':'未超过 25%'};
}
function valid(result){if(result.status&&result.status!=='complete')throw new Error('广告查询未完整执行');if(result.code!==undefined&&![0,200,'0','200'].includes(result.code))throw new Error('广告业务查询失败');return result.data??result;}
export async function campaigns(client,shop){
 const id='get_sp_campaign_list',contract=await client.contract(id);let token,rows=[],complete=false;
 for(let i=0;i<10;i++){const r=await client.execute(id,{shop_id:shop,page_size:20,...(token?{next_token:token}:{})},contract),data=valid(r);const list=data.rows??data.itemList;if(!Array.isArray(list))throw new Error('广告活动返回结构异常');rows.push(...list);const next=data.next_token??data.nextToken;if(next===undefined||next===null)break;if(!next){complete=true;break;}if(next===token)break;token=next;}
 return {rows,complete};
}
export async function readAds(client,shop,date){
 const list=await campaigns(client,shop),contract=await client.contract('get_sp_hour_campaign_report');const rows=[];
 // Bound calls to keep refresh time predictable. Surface unqueried campaigns explicitly.
 for(const campaign of list.rows.slice(0,20)){
  const row={campaignId:campaign.campaignId,name:campaign.name??String(campaign.campaignId),shopId:shop};
  if(campaign.campaignId==null){rows.push({...row,status:'unknown',reason:'缺失活动 ID'});continue;}
  try{const r=await client.execute('get_sp_hour_campaign_report',{shop_id:shop,date,campaign_id:String(campaign.campaignId),aggregation_type:'campaign'},contract),data=valid(r);const hours=data.itemList;if(!Array.isArray(hours))throw new Error('小时报告结构异常');
   const seen=new Set();let duplicate=false;for(const h of hours){const k=[h.shopId,h.campaignId,h.date,h.hour].join('|');if(seen.has(k))duplicate=true;seen.add(k);}
   const sum=key=>hours.length&&hours.every(h=>h[key]!=null&&String(h[key]).trim()!==''&&Number.isFinite(Number(h[key])))?hours.reduce((a,h)=>a+Number(h[key]),0):null;
   const cost=sum('costs'),sales=sum('sales');rows.push({...row,cost,sales,hours:hours.length,...(duplicate?{status:'unknown',acos:null,reason:'报告包含重复小时，需核对'}:evaluate(cost,sales)),warnings:r.warnings??[]});
  }catch{rows.push({...row,status:'unknown',acos:null,reason:'活动报告查询失败，请检查权限与日期范围'});}
 }
 return {rows,date,shopId:shop,campaignsFetched:list.rows.length,queried:rows.length,listComplete:list.complete,complete:false,unqueried:Math.max(0,list.rows.length-rows.length),warnings:['SP 7 天归因；按本次返回小时汇总。报告完整性及小时所在时区未知，不能据此认定全店广告正常。','每次最多查询前 20 个活动；未查询与查询失败不计为正常。'],fetchedAt:new Date().toISOString()};
}
