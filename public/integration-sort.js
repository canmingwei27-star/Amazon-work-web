globalThis.IntegrationSort=Object.freeze({
 sort(rows,key,direction='desc'){
  const empty=v=>v===null||v===undefined||v==='';
  return rows.map((row,i)=>({row,i})).sort((a,b)=>{
   const x=a.row[key],y=b.row[key];if(empty(x)||empty(y))return empty(x)&&empty(y)?a.i-b.i:empty(x)?1:-1;
   const n=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'zh-CN',{numeric:true});
   return (direction==='asc'?n:-n)||a.i-b.i;
  }).map(x=>x.row);
 }
});
