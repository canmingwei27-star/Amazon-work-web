import {readPages} from './mcp.mjs';
export const numeric=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
export function joinProducts(online,analysis){
 return online.map(p=>{
  const matches=analysis.filter(a=>a.shopIdList?.map(String).includes(String(p.shopId))&&a.mskuList?.includes(p.sku));
  const a=matches.length===1?matches[0]:null,v=k=>numeric(a?.fieldsMap?.[k]?.currValue);
  const cost=p.commoditySku?numeric(p.purchaseCost):null,head=p.commoditySku?numeric(p.headTripCost):null;
  const spend=v('adTotalCost'),adSales=v('adTotalSale'),units=v('saleNum');
  return {id:p.id,shop:String(p.shopId),asin:p.asin,msku:p.sku,sku:p.commoditySku??'',name:p.commodityName||p.title,status:p.onlineStatus,category:p.fullCid,brand:p.brand||p.amazonBrand,labels:(p.productLabelList??[]).flatMap(g=>(g.labelDetailList??[]).map(l=>l.labelName)),currency:p.currency,costCurrency:'CNY',purchaseCost:cost,headTripCost:head,price:numeric(p.listingPrice),fbaFee:numeric(p.fbaFees),commission:numeric(p.referralFee),feeCurrency:p.feeCurrency,sales:v('salePrice'),units,profit:v('profitPrice'),adCost:spend,adSales,clicks:v('adClicks'),adOrders:v('adOrderNum'),refunds:v('refundNum'),refundAmount:v('refundPrice'),sessions:v('sessions'),available:numeric(p.inventoryManage?.available),inTransit:numeric(p.inventoryManage?.inboundShipped),rating:numeric(p.rating),ratingCount:numeric(p.ratingCount),acos:spend!==null&&adSales>0?spend/adSales*100:null,costStatus:!p.commoditySku?'未配对':cost===null||head===null?'成本缺失':cost===0||head===0?'零成本待核实':'已匹配',metricStatus:matches.length===1?'唯一匹配':matches.length?'多条匹配，未合并':'无期间数据',adAlert:spend>0&&adSales===0?'有花费无销售':spend!==null&&adSales>0&&spend/adSales>.25?'ACOS >25%':''};
 });
}
export async function readIntegration(client,{shop,start,end,scope=5}){
 const online=await readPages(client,'get_online_product_page_list',{shop_id_list:[shop]},{pageSize:5,maxPages:1000});
 const analysis=await readPages(client,'get_product_analyze_list',{shop_id_list:[shop],start_date:start,end_date:end,dim_type:3,sub_type:0,is_new_or_moving_or_in_stock:scope,field_modules:['PRODUCT_INFO','PROFIT_INFO','SALE_INFO','AD_INFO','PERFORMANCE_INFO']},{pageSize:5,maxPages:1000});
 return {rows:joinProducts(online.rows,analysis.rows),fetchedAt:new Date().toISOString(),period:{start,end},complete:online.complete&&analysis.complete,coverage:{online:online.rows.length,analysis:analysis.rows.length},warnings:[...online.warnings,...analysis.warnings,'采购及默认头程来源：在线商品 purchaseCost/headTripCost；成本币种按店主提供的默认口径设为CNY，不直接与销售币种混算。','利润为产品分析历史口径，并非按当前成本重算；无期间数据不等于零。'],sources:{online:'get_online_product_page_list',analysis:'get_product_analyze_list'}};
}
