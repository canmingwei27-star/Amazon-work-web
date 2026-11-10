import {test} from 'node:test';import assert from 'node:assert/strict';import {salesWindows,classifyLoss,readSalesAnomalies,attachAdvertising,returnRate} from '../sales-anomalies.mjs';
test('3/7/14日包含截止当天并跨月跨年',()=>{const w=salesWindows('2026-01-02');assert.deepEqual(w.map(p=>p.days),[1,3,7,14]);assert.equal(w[0].start,'2026-01-02');assert.equal(w[3].start,'2025-12-20');assert.throws(()=>salesWindows('2026-02-30'));});
test('读取全部美元负毛利供分类筛选，缺失与零不混淆',()=>{const r=classifyLoss([{grossProfit:-15,currency:'USD',skuList:['A']},{grossProfit:'-20',currency:'USD',skuList:['B']},{grossProfit:0,currency:'USD'},{grossProfit:2,currency:'USD'},{grossProfit:null},{grossProfit:''}]);assert.equal(r.negative.length,2);assert.equal(r.negative[1].currency,'USD');assert.equal(r.unknownCount,2);});
test('独立读取三个期间，不累加重叠周期',async()=>{const calls=[];const client={contract:async()=>({}),execute:async(id,p)=>{calls.push(p);return {status:'complete',data:{rows:[{grossProfit:-15,currency:'USD',skuList:['A']}],total_count:1,total_pages:1}};}};const r=await readSalesAnomalies(client,{asOf:'2026-11-04'});assert.equal(calls.filter(p=>p.date_type===2).length,4);assert.equal(r.periods[1].start,'2026-11-02');assert(r.periods.every(p=>p.negative.length===1));});

test('阈值边界及未知币种',()=>{
 const r=classifyLoss([-14.99,-15,-15.01,0,null,'',Infinity].map(grossProfit=>({grossProfit,currency:'USD'})).concat([{grossProfit:-100,currency:'CAD'}]));
 assert.deepEqual(r.negative.map(r=>r.grossProfit),[-14.99,-15,-15.01]);assert.equal(r.unknownCount,4);
});
test('广告计算、缺失、零分母及重复匹配',()=>{
 const losses=['A','B','C','D'].map(sku=>({sku}));
 const row=(sku,cost,sales,clicks)=>({skuList:[sku],currency:'USD',fieldsMap:Object.fromEntries(Object.entries({adTotalCost:cost,adTotalSale:sales,adClicks:clicks}).map(([k,v])=>[k,{currValue:v}]))});
 attachAdvertising(losses,[row('A',10,40,5),row('B',0,0,0),row('C',null,10,null),row('D',1,2,3),row('D',2,3,4)]);
 assert.equal(losses[0].acos,25);assert.equal(losses[0].cpc,2);assert.equal(losses[0].adClicks,5);
 assert.equal(losses[1].acos,null);assert.equal(losses[1].cpc,null);assert.equal(losses[1].adCost,0);
 assert.equal(losses[2].adCost,null);assert.equal(losses[3].adCost,undefined);
});

test('退货率以退货量除销量，缺失和零分母不补零',()=>{assert.equal(returnRate({returnNum:2,salesNum:20}),10);assert.equal(returnRate({returnNum:0,salesNum:20}),0);for(const row of [{returnNum:null,salesNum:20},{returnNum:2,salesNum:0},{returnNum:-1,salesNum:20}])assert.equal(returnRate(row),null);});
