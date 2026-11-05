import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {Mcp,readPages} from './mcp.mjs';
import {readAds} from './ads.mjs';
import {Workspace,collections,validateWorkspace} from './workspace.mjs';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Settings} from './settings.mjs';
import {syncProducts} from './sync.mjs';
const workspace=new Workspace(process.env.DATA_DIR||fileURLToPath(new URL('./data/',import.meta.url)));
const settings=new Settings(workspace.directory);
async function body(req){let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>24*1024*1024)throw new Error('请求超过 24MB');}return JSON.parse(raw);}
const port=Number(process.env.PORT||3000);let running=false;
function same(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s??'')&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
async function handle(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; img-src 'self' data:");
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/healthz')return send(res,200,{status:'ok'});
 const user=process.env.DASHBOARD_USER,password=process.env.DASHBOARD_PASSWORD;
 if(user&&password){const expected='Basic '+Buffer.from(user+':'+password).toString('base64');if(!same(req.headers.authorization??'',expected)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Sellfox"'});return res.end('Authentication required');}}

 if(url.pathname==='/api/settings'){
  try{
   if(req.method==='GET')return send(res,200,await settings.status());
   if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host))return send(res,403,{error:'跨站请求被拒绝'});
   if(req.method==='PUT'){const input=await body(req);if(typeof input.key!=='string'||input.key.length>4096||/[\r\n]/.test(input.key))return send(res,400,{error:'密钥格式无效'});await settings.save(input.key.trim());return send(res,200,await settings.status());}
   if(req.method==='POST'){const key=await settings.key();if(!key)return send(res,400,{error:'请先保存密钥'});const client=new Mcp(process.env.SELLFOX_MCP_URL||'https://api-mcp.sellfox.com/mcp',key);try{await client.connect();return send(res,200,{ok:true,message:'MCP 握手成功，已读取工具目录',tools:client.tools.length});}catch(e){return send(res,502,{error:e.message});}finally{await client.close();}}
   return send(res,405,{error:'不支持的方法'});
  }catch{return send(res,500,{error:'接口设置操作失败，请检查数据卷权限'});}
 }


 if(url.pathname==='/api/reports'||url.pathname==='/api/sync/shipments'){
  if(req.method!=='POST')return send(res,405,{error:'请使用 POST'});
  if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host))return send(res,403,{error:'跨站请求被拒绝'});
  if(running)return send(res,429,{error:'已有查询正在执行'});
  let input;try{input=await body(req);}catch{return send(res,400,{error:'参数格式错误'});}
  const {shop,start,end,action}=input;if(!/^\d+$/.test(shop??'')||!validDate(start)||!validDate(end)||start>end||(Date.parse(end)-Date.parse(start))/86400000>31)return send(res,400,{error:'请选择店铺和最多32天日期范围'});
  const key=await settings.key();if(!key)return send(res,503,{error:'请先保存密钥'});running=true;const client=new Mcp(process.env.SELLFOX_MCP_URL||'https://api-mcp.sellfox.com/mcp',key);
  try{await client.connect();const shops=await readPages(client,'get_shop_page_list',{});if(!shops.rows.some(s=>String(s.id)===shop))return send(res,400,{error:'店铺不在授权列表'});
   if(url.pathname==='/api/sync/shipments'){const result=await readPages(client,'get_fba_shipment_page_list',{shop_ids:[Number(shop)],update_time_start:start+' 00:00:00',update_time_end:end+' 23:59:59'});await workspace.mutate(data=>{for(const r of result.rows){const id='sf-ship-'+(r.id??r.amazonShipmentId),old=data.shipments.find(x=>x.id===id);const row={...old,id,shipment:r.amazonShipmentId??r.shipmentId,node:r.transitStatus??r.status,status:r.status,source:'赛狐货件列表',raw:r,updatedAt:new Date().toISOString()};if(old)Object.assign(old,row);else data.shipments.push(row);}});return send(res,200,{count:result.rows.length,complete:result.complete});}
   if(action==='create'){const id='create_ad_download_task',contract=await client.contract(id);const result=await client.execute(id,{shop_ids:[shop],ad_type_code:'sp',report_type_code:'adSearchTermReport',time_unit:'summary',report_start_date:start,report_end_date:end},contract);return send(res,200,{result,message:'请求已返回。请查询报告列表确认状态；不自动重试创建。'});}
   if(action==='list')return send(res,200,await readPages(client,'get_ad_download_task_page_list',{shop_ids:[shop],ad_type_code_list:['sp'],report_type_code_list:['adSearchTermReport']}));
   return send(res,400,{error:'无效操作'});
  }catch(e){return send(res,502,{error:e.message+'；如果创建报告时失败，请先查列表确认，避免重复创建。'});}finally{await client.close();running=false;}
 }
 if(url.pathname==='/api/sync/products'){
  if(req.method!=='POST')return send(res,405,{error:'请使用 POST'});
  if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host))return send(res,403,{error:'跨站请求被拒绝'});
  if(running)return send(res,429,{error:'已有查询正在执行'});
  let input;try{input=await body(req);}catch{return send(res,400,{error:'参数格式错误'});}
  const {shop,start,end}=input;if(!/^\d+$/.test(shop??'')||!validDate(start)||!validDate(end)||start>end||(Date.parse(end)-Date.parse(start))/86400000>31)return send(res,400,{error:'请选择店铺和最多32天日期范围'});
  const key=await settings.key();if(!key)return send(res,503,{error:'请先保存密钥'});running=true;const client=new Mcp(process.env.SELLFOX_MCP_URL||'https://api-mcp.sellfox.com/mcp',key);
  try{await client.connect();const shops=await readPages(client,'get_shop_page_list',{});if(!shops.rows.some(s=>String(s.id)===shop))return send(res,400,{error:'店铺不在授权列表'});const result=await syncProducts(client,shop,start,end);await workspace.mutate(data=>{for(const row of result.rows){const index=data.products.findIndex(r=>r.id===row.id);if(index<0)data.products.push(row);else{const {history,...old}=data.products[index];data.products[index]={...old,...row,history:[...(history??[]),old].slice(-60)};}if(row.sku){const id='inv-'+row.id,existing=data.inventory.find(r=>r.id===id);const days=(Date.parse(end)-Date.parse(start))/86400000+1;const inv={...existing,id,sku:row.sku,name:row.name,available:row.available,reserved:row.reserved,inTransit:row.inTransit,dailySales:row.units===null?null:Number(row.units)/days,source:row.source,syncedAt:row.syncedAt};if(existing)Object.assign(existing,inv);else data.inventory.push(inv);}}});return send(res,200,{count:result.rows.length,complete:result.complete,warnings:result.warnings});}catch(e){return send(res,502,{error:e.message});}finally{await client.close();running=false;}
 }
 if(url.pathname==='/api/workspace'){
  if(req.method==='GET'){try{return send(res,200,await workspace.read());}catch{return send(res,500,{error:'工作区读取失败，请检查数据文件与磁盘权限'});}}
  if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host))return send(res,403,{error:'跨站请求被拒绝'});
  try{const input=await body(req);
   if(req.method==='PUT'){validateWorkspace(input);await workspace.mutate(data=>{for(const k of collections)data[k]=input[k];});return send(res,200,{ok:true});}
   if(!collections.includes(input.collection))return send(res,400,{error:'无效模块'});
   if(req.method==='POST'){if(!input.record||typeof input.record!=='object'||Array.isArray(input.record))throw new Error('记录格式错误');const record={...input.record,id:input.record.id||randomUUID(),updatedAt:new Date().toISOString()};await workspace.mutate(data=>{const list=data[input.collection],i=list.findIndex(r=>r.id===record.id);if(i<0){if(list.length>=5000)throw new Error('记录已达上限');list.push(record);}else list[i]=record;});return send(res,200,record);}
   if(req.method==='DELETE'){await workspace.mutate(data=>{data[input.collection]=data[input.collection].filter(r=>r.id!==input.id);});return send(res,200,{ok:true});}
   return send(res,405,{error:'不支持的方法'});
  }catch{return send(res,400,{error:'保存失败，请检查数据格式、磁盘权限与剩余空间'});}
 }
 if(req.method!=='GET')return send(res,405,{error:'仅支持读取'});
 if(url.pathname==='/api/status'){try{return send(res,200,{...await settings.status(),authentication:!!(user&&password)});}catch{return send(res,500,{error:'配置读取失败'});}}
 if(url.pathname==='/api/ads'){
  if(!await settings.key())return send(res,503,{error:'请先到接口设置保存密钥'});
  const shop=url.searchParams.get('shop'),date=url.searchParams.get('date');
  if(!/^\d+$/.test(shop??'')||!validDate(date))return send(res,400,{error:'请选择店铺与有效日期'});
  if(running)return send(res,429,{error:'已有查询正在执行，请稍后再试'});
  running=true;const client=new Mcp(process.env.SELLFOX_MCP_URL||'https://api-mcp.sellfox.com/mcp',await settings.key());
  try{await client.connect();const shops=await readPages(client,'get_shop_page_list',{});if(!shops.rows.some(s=>String(s.id)===shop))return send(res,400,{error:'店铺不在当前授权列表内'});return send(res,200,await readAds(client,shop,date));}catch(e){return send(res,502,{error:e.message});}finally{await client.close();running=false;}
 }
 if(url.pathname==='/api/dashboard'){
  if(!await settings.key())return send(res,503,{error:'请到左侧接口设置填写并保存赛狐密钥。'});
  const start=url.searchParams.get('start'),end=url.searchParams.get('end');
  if(!validDate(start)||!validDate(end)||start>end||(Date.parse(end)-Date.parse(start))/86400000>31)return send(res,400,{error:'请选择有效日期，查询范围最多 32 天'});
  if(running)return send(res,429,{error:'已有查询正在执行，请稍后再试'});
  running=true;const client=new Mcp(process.env.SELLFOX_MCP_URL||'https://api-mcp.sellfox.com/mcp',await settings.key());
  try{
   await client.connect();const output={fetchedAt:new Date().toISOString(),period:{start,end},sources:{}};
   try{output.sources.shops={status:'success',...await readPages(client,'get_shop_page_list',{})};}catch{output.sources.shops={status:'error',error:'店铺查询失败，请检查连接和权限'};}
   try{output.sources.profit={status:'success',...await readPages(client,'get_profit_report_by_shop',{date_type:2,start_date:start.replaceAll('-',''),end_date:end.replaceAll('-',''),field_list:['shopId','currency','salesNum','productSales','grossProfit','cpcCost','refundNum']})};}catch(e){output.sources.profit={status:'error',error:e.message};}
   return send(res,200,output);
  }catch(e){return send(res,502,{error:e.message});}finally{await client.close();running=false;}
 }
 const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/ads.js':'ads.js','/workbench.js':'workbench.js','/settings.js':'settings.js','/advanced.js':'advanced.js','/workflows.js':'workflows.js'};
 if(!files[url.pathname])return send(res,404,{error:'Not found'});
 try{const file=files[url.pathname];res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(await readFile(new URL('./public/'+file,import.meta.url)));}catch{send(res,500,{error:'页面加载失败'});}
}
const server=http.createServer((req,res)=>{handle(req,res).catch(()=>{if(!res.headersSent)send(res,500,{error:'服务器处理失败，请检查配置与磁盘权限'});else res.end();});});
server.listen(port,'0.0.0.0',()=>console.log(`Sellfox dashboard listening on ${server.address().port}`));
