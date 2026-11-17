const currencies=new Set(['USD','CAD','EUR','GBP','JPY','MXN','BRL']);
export async function queryWorldFirst(target,{key=process.env.WORLDFIRST_API_KEY,base=process.env.WORLDFIRST_API_BASE,request=fetch}={}){
 if(!currencies.has(target))throw new Error('不支持的目标币种');
 if(!key||!base)throw new Error('尚未配置万里汇API授权：请在服务器配置WORLDFIRST_API_KEY和WORLDFIRST_API_BASE');
 const url=new URL(base);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||!/(^|\.)worldfirst\.com(?:\.cn)?$/i.test(url.hostname))throw new Error('请配置开发者中心分配的万里汇HTTPS接口域名');
 const response=await request(new URL('/api/open/v1/fx/rates/query',url),{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({rateConditions:[{sellAmount:{currency:target,value:10000},buyAmount:{currency:'CNY'}}]}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('万里汇汇率查询失败，HTTP '+response.status);
 const d=await response.json();if(d.result?.resultStatus!=='S'||d.result?.resultCode!=='SUCCESS')throw new Error('万里汇未成功返回汇率，请检查授权、币种和报价金额');
 const rows=(d.rateDetails??[]).filter(r=>r.sellAmount?.currency===target&&r.buyAmount?.currency==='CNY');
 if(rows.length!==1)throw new Error('万里汇返回币种或结果数量不匹配');
 const r=rows[0],rate=Number(r.clientRate);if(!Number.isFinite(rate)||rate<=0||!r.createdAt||!Number.isFinite(Date.parse(r.createdAt)))throw new Error('万里汇汇率或报价时间无效');
 return {source:'WorldFirst',target,base:'CNY',rate,quotedAt:r.createdAt,fetchedAt:new Date().toISOString(),quoteAmount:10000,direction:'1 '+target+' = '+rate+' CNY'};
}
