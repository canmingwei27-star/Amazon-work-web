import {test} from 'node:test';
import assert from 'node:assert/strict';
import {joinProducts,numeric} from '../integration.mjs';
test('成本只匹配本地SKU，缺失和零保留，重复指标不猜测',()=>{
 const p={id:'1',shopId:'2',sku:'platform',commoditySku:'local',purchaseCost:'0',headTripCost:null,currency:'USD'};
 const a={shopIdList:['2'],mskuList:['platform'],fieldsMap:{saleNum:{currValue:'3'},adTotalCost:{currValue:'5'},adTotalSale:{currValue:'0'}}};
 const r=joinProducts([p],[a])[0];assert.equal(r.sku,'local');assert.equal(r.purchaseCost,0);assert.equal(r.headTripCost,null);assert.equal(r.costCurrency,'CNY');assert.equal(r.costStatus,'成本缺失');assert.equal(r.adAlert,'有花费无销售');assert.equal(r.acos,null);
 assert.equal(joinProducts([p],[a,a])[0].units,null);assert.equal(joinProducts([{...p,commoditySku:null}],[a])[0].purchaseCost,null);assert.equal(numeric(''),null);
});
test('不同店铺不能误配，ACOS严格大于25%',()=>{
 const p={shopId:'2',sku:'x',commoditySku:'y',purchaseCost:5,headTripCost:2};
 const a={shopIdList:['2'],mskuList:['x'],fieldsMap:{adTotalCost:{currValue:25},adTotalSale:{currValue:100}}};
 assert.equal(joinProducts([p],[a])[0].adAlert,'');a.fieldsMap.adTotalCost.currValue=26;assert.equal(joinProducts([p],[a])[0].adAlert,'ACOS >25%');a.shopIdList=['3'];assert.equal(joinProducts([p],[a])[0].adCost,null);
});
