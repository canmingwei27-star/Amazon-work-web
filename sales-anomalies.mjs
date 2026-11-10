import {readPages} from './mcp.mjs';
export function salesWindows(asOf){if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(Date.parse(asOf))||new Date(asOf).toISOString().slice(0,10)!==asOf)throw new Error('统计日期无效');return [3,7,14].map(days=>({days,start:new Date(Date.parse(asOf)-(days-1)*86400000).toISOString().slice(0,10),end:asOf}));}
export function classifyLoss(rows){const negative=[],unknown=[];for(const r of rows){const n=r.grossProfit;if(n===null||n===undefined||String(n).trim()===''||!Number.isFinite(Number(n))){unknown.push(r);continue;}if(r.currency!=='USD'){unknown.push(r);continue;}if(Number(n)<=-15)negative.push({sku:Array.isArray(r.skuList)?r.skuList.join(' / '):'',name:Array.isArray(r.commodityInfos)?r.commodityInfos.map(c=>c.skuName??'').filter(Boolean).join(' / '):'',image:typeof r.imgUrl==='string'?r.imgUrl:'',currency:r.currency??null,sales:r.productSales??null,units:r.salesNum??null,grossProfit:Number(n)});}return {negative,unknownCount:unknown.length,checkedCount:rows.length};}
export async function readSalesAnomalies(client,{asOf,shop='',caliber='settlement'}){const periods=[];for(const window of salesWindows(asOf)){try{const result=await readPages(client,'get_profit_report_by_sku',{date_type:2,start_date:window.start.replaceAll('-',''),end_date:window.end.replaceAll('-',''),currency:'USD',profit_caliber_type:caliber,...(shop?{shop_ids:[Number(shop)]}:{}),field_list:['skuList','commodityInfos','imgUrl','currency','salesNum','productSales','grossProfit']});const classified=classifyLoss(result.rows);let adWarning='';try{if(classified.negative.length){const ads=await readPages(client,'get_product_analyze_list',{start_date:window.start,end_date:window.end,dim_type:4,sub_type:0,currency:'USD',...(shop?{shop_id_list:[String(shop)]}:{}),fields:['sku','adClicks','adTotalCost','adTotalSale']});if(!ads.complete)throw Error('incomplete');attachAdvertising(classified.negative,ads.rows);}}catch{adWarning='广告数据读取失败或不完整，缺失指标不补零';}periods.push({...window,status:'success',...classified,adWarning,complete:result.complete,total:result.total,warnings:result.warnings});}catch{periods.push({...window,status:'error',negative:[],complete:false,error:'该周期利润报表查询失败，不能判断是否存在亏损'});}}
return {id:'sales-'+Date.now(),asOf,shop,caliber,source:'SKU 利润报表',currencyMode:'统一 USD；毛利润 ≤ -15 USD',lossThreshold:-15,fetchedAt:new Date().toISOString(),periods};}

const numberOrNull=v=>v===null||v===undefined||String(v).trim()===''||!Number.isFinite(Number(v))?null:Number(v);
export function attachAdvertising(losses,rows){
 for(const loss of losses){
  const matches=rows.filter(r=>Array.isArray(r.skuList)&&r.skuList.length===1&&r.skuList[0]===loss.sku&&r.currency==='USD');
  // A single unambiguous SKU row only; never split grouped amounts or guess aggregation.
  if(matches.length!==1)continue;
  const v=k=>numberOrNull(matches[0].fieldsMap?.[k]?.currValue);
  const cost=v('adTotalCost'),sales=v('adTotalSale'),clicks=v('adClicks');
  loss.adCost=cost!==null&&cost>=0?cost:null;
  loss.adClicks=clicks!==null&&Number.isInteger(clicks)&&clicks>=0?clicks:null;
  loss.acos=loss.adCost!==null&&sales>0?loss.adCost/sales*100:null;
  loss.cpc=loss.adCost!==null&&loss.adClicks>0?loss.adCost/loss.adClicks:null;
 }
}
