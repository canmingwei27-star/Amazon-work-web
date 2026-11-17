import {test} from 'node:test';import assert from 'node:assert/strict';
import {queryWorldFirst} from '../worldfirst.mjs';
import '../public/cost-conversion.js';
test('人民币换算方向、缺失、零、无效汇率',()=>{
 const p={costCurrency:'CNY',purchaseCost:14,headTripCost:7};
 assert.equal(CostConversion.convert(p,'USD',7).convertedTotal,3);
 assert.equal(CostConversion.convert(p,'USD',0).convertedTotal,null);
 assert.equal(CostConversion.convert({...p,headTripCost:null},'USD',7).convertedTotal,null);
 assert.equal(CostConversion.convert({...p,purchaseCost:0},'USD',7).convertedPurchase,0);
 assert.equal(CostConversion.convert(p,'CNY','').convertedTotal,21);
});
test('万里汇仅查询汇率，验证币对、认证、报价时间',async()=>{
 const options={key:'fictional-key',base:'https://api.worldfirst.com',request:async(url,init)=>{
  assert.equal(url.pathname,'/api/open/v1/fx/rates/query');assert.equal(init.headers.Authorization,'Bearer fictional-key');assert.equal(JSON.parse(init.body).rateConditions[0].sellAmount.currency,'USD');
  return {ok:true,json:async()=>({result:{resultStatus:'S',resultCode:'SUCCESS'},rateDetails:[{sellAmount:{currency:'USD'},buyAmount:{currency:'CNY'},clientRate:7,createdAt:'2026-11-16T00:00:00Z'}]})};
 }};
 assert.equal((await queryWorldFirst('USD',options)).rate,7);
 await assert.rejects(queryWorldFirst('USD',{...options,key:''}),/尚未配置/);
 await assert.rejects(queryWorldFirst('USD',{...options,base:'https://example.com'}),/域名/);
 await assert.rejects(queryWorldFirst('USD',{...options,request:async()=>({ok:true,json:async()=>({result:{resultStatus:'S',resultCode:'SUCCESS'},rateDetails:[]})})}),/不匹配/);
});
