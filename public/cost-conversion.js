// Rate convention: CNY required to buy one unit of the target currency.
globalThis.CostConversion=Object.freeze({
 convert(row,target,rate){
  const valid=['CNY','USD','CAD','EUR','GBP','JPY','MXN','BRL'].includes(target);
  const n=rate===null||rate===undefined||String(rate).trim()===''?NaN:Number(rate);
  const ready=valid&&row.costCurrency==='CNY'&&(target==='CNY'||Number.isFinite(n)&&n>0);
  const divisor=target==='CNY'?1:n;
  const amount=v=>ready&&v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v)/divisor:null;
  const purchase=amount(row.purchaseCost),head=amount(row.headTripCost);
  return {...row,convertedCurrency:valid?target:null,conversionRate:ready?divisor:null,convertedPurchase:purchase,convertedHeadTrip:head,convertedTotal:purchase!==null&&head!==null?purchase+head:null};
 }
});
