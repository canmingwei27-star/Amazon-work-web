import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {Mcp,readPages} from './mcp.mjs';
import {readAds} from './ads.mjs';
import {Workspace,collections,validateWorkspace} from './workspace.mjs';
import {randomUUID,randomBytes} from 'node:crypto';
const csrfToken=randomBytes(32).toString('hex');
import {fileURLToPath} from 'node:url';
import {Settings} from './settings.mjs';
import {Accounts} from './auth.mjs';
import {readSalesAnomalies} from './sales-anomalies.mjs';
import {downloadCampaignReport} from './campaign-report.mjs';
import {syncProducts} from './sync.mjs';
const workspace=new Workspace(process.env.DATA_DIR||fileURLToPath(new URL('./data/',import.meta.url)));
const settings=new Settings(workspace.directory);
const accounts=new Accounts(workspace.directory);const authReady=accounts.init();const loginAttempts=new Map();
async function body(req){let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>24*1024*1024)throw new Error('请求超过 24MB');}return JSON.parse(raw);}
const port=Number(process.env.PORT||3000);let running=false;
function same(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s??'')&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
async function handle(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; img-src 'self' data: https:");
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/healthz')return send(res,200,{status:'ok'});

 await authReady;
 const publicFiles={'/login':'login.html','/login.css':'login.css','/login.js':'login.js','/api.js':'api.js'};
 if(req.method==='GET'&&publicFiles[url.pathname]){const file=publicFiles[url.pathname];res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(await readFile(new URL('./public/'+file,import.meta.url)));}
 const user=accounts.current(req);
 if(url.pathname==='/api/auth/status'&&req.method==='GET')return send(res,200,{user,bootstrapRequired:accounts.users.length===0,csrfToken});
 if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!same(req.headers['x-csrf-token']??'',csrfToken))return send(res,403,{error:'请求校验失败，请刷新网页后重试'});
 if(url.pathname==='/api/auth/login'||url.pathname==='/api/auth/bootstrap'){
  if(req.method!=='POST')return send(res,405,{error:'请使用 POST'});
  const now=Date.now(),ip=req.socket.remoteAddress;for(const [k,v]of loginAttempts)if(v.until<now)loginAttempts.delete(k);const attempt=loginAttempts.get(ip)||{count:0,until:now+300000};if(attempt.count>=20)return send(res,429,{error:'尝试过于频繁，请5分钟后再试'});attempt.count++;loginAttempts.set(ip,attempt);
  try{const input=await body(req);if(url.pathname.endsWith('bootstrap'))await accounts.add(input.username,input.password,'admin',true);const session=await accounts.login(input.username,input.password);if(!session)return send(res,401,{error:'账号或密码错误，或账号已停用'});loginAttempts.delete(ip);res.setHeader('Set-Cookie',accounts.cookie(session.token));return send(res,200,{user:session.user});}catch(e){return send(res,400,{error:url.pathname.endsWith('bootstrap')?e.message:'登录失败，请稍后重试'});}
 }
 if(!user){if(url.pathname==='/'){res.writeHead(302,{Location:'/login','Cache-Control':'no-store'});return res.end();}return send(res,401,{error:'请先登录',loginRequired:true});}
 if(url.pathname==='/api/auth/logout'&&req.method==='POST'){accounts.logout(req);res.setHeader('Set-Cookie',accounts.cookie('',true));return send(res,200,{ok:true});}
 if(url.pathname==='/api/accounts'){
  if(user.role!=='admin')return send(res,403,{error:'仅管理员可管理账号'});
  try{if(req.method==='GET')return send(res,200,{users:accounts.users.map(u=>accounts.safe(u)),currentUser:user});const input=await body(req);if(req.method==='POST')return send(res,201,await accounts.add(input.username,input.password,input.role||'member'));if(req.method==='PATCH'){if(typeof input.disabled!=='boolean')return send(res,400,{error:'状态无效'});return send(res,200,await accounts.disable(input.id,input.disabled,user));}return send(res,405,{error:'不支持的方法'});}catch(e){return send(res,400,{error:e.message});}
 }
 if(url.pathname==='/api/settings'&&req.method!=='GET'&&user.role!=='admin')return send(res,403,{error:'仅管理员可更改或测试密钥'});
 if(url.pathname==='/api/settings'){
  try{
   if(req.method==='GET')return send(res,200,await settings.status());
   
   if(req.method==='PUT'){const input=await body(req);if(typeof input.key!=='string'||input.key.length>4096||/[\r\n]/.test(input.key))return send(res,400,{error:'密钥格式无效'});await settings.save(input.key.trim());return send(res,200,await settings.status());}
   if(req.method==='POST'){const key=await settings.key();if(!key)return send(res,400,{error:'请先保存密钥'});const client=new Mcp(process.env.SELLFOX_MCP_URL||'https://api-mcp.sellfox.com/mcp',key);try{await client.connect();return send(res,200,{ok:true,message:'MCP 握手成功，已读取工具目录',tools:client.tools.length});}catch(e){return send(res,502,{error:e.message});}finally{await client.close();}}
   return send(res,405,{error:'不支持的方法'});
  }catch{return send(res,500,{error:'接口设置操作失败，请检查数据卷权限'});}
 }


 if(url.pathname==='/api/reports'||url.pathname==='/api/sync/shipments'){
  if(req.method!=='POST')return send(res,405,{error:'请使用 POST'});
  
  if(running)return send(res,429,{error:'已有查询正在执行'});
  let input;try{input=await body(req);}catch{return send(res,400,{error:'参数格式错误'});}
  const {shop,start,end,action}=input;if(!/^\d+$/.test(shop??'')||!validDate(start)||!validDate(end)||start>end||(Date.parse(end)-Date.parse(start))/86400000>31)return send(res,400,{error:'请选择店铺和最多32天日期范围'});
  const key=await settings.key();if(!key)return send(res,503,{error:'请先保存密钥'});running=true;const client=new Mcp(process.env.SELLFOX_MCP_URL||'https://api-mcp.sellfox.com/mcp',key);
  try{await client.connect();const shops=await readPages(client,'get_shop_page_list',{});if(!shops.rows.some(s=>String(s.id)===shop))return send(res,400,{error:'店铺不在授权列表'});
   if(url.pathname==='/api/sync/shipments'){const result=await readPages(client,'get_fba_shipment_page_list',{shop_ids:[Number(shop)],update_time_start:start+' 00:00:00',update_time_end:end+' 23:59:59'});await workspace.mutate(data=>{for(const r of result.rows){const id='sf-ship-'+(r.id??r.amazonShipmentId),old=data.shipments.find(x=>x.id===id);const row={...old,id,shipment:r.amazonShipmentId??r.shipmentId,node:r.transitStatus??r.status,status:r.status,source:'赛狐货件列表',raw:r,updatedAt:new Date().toISOString()};if(old)Object.assign(old,row);else data.shipments.push(row);}});return send(res,200,{count:result.rows.length,complete:result.complete});}
   if(input.report&&!['campaign','searchterm'].includes(input.report))return send(res,400,{error:'无效报告类型'});const reportCode=input.report==='campaign'?'adCampaignReport':'adSearchTermReport';
   if(action==='load'){if(input.report!=='campaign'||typeof input.taskId!=='string'||!/^\d+$/.test(input.taskId))return send(res,400,{error:'请选择有效的活动汇总报告'});return send(res,200,await downloadCampaignReport(client,{shop,start,end,taskId:input.taskId}));}
   if(action==='create'){const id='create_ad_download_task',contract=await client.contract(id);const result=await client.execute(id,{shop_ids:[shop],ad_type_code:'sp',report_type_code:reportCode,time_unit:'summary',report_start_date:start,report_end_date:end},contract);return send(res,200,{result,message:'请求已返回。请查询报告列表确认状态；不自动重试创建。'});}
   if(action==='list')return send(res,200,await readPages(client,'get_ad_download_task_page_list',{shop_ids:[shop],ad_type_code_list:['sp'],report_type_code_list:[reportCode]}));
   return send(res,400,{error:'无效操作'});
  }catch(e){return send(res,502,{error:e.message+'；如果创建报告时失败，请先查列表确认，避免重复创建。'});}finally{await client.close();running=false;}
 }
 if(url.pathname==='/api/sync/products'){
  if(req.method!=='POST')return send(res,405,{error:'请使用 POST'});
  
  if(running)return send(res,429,{error:'已有查询正在执行'});
  let input;try{input=await body(req);}catch{return send(res,400,{error:'参数格式错误'});}
  const {shop,start,end}=input;if(!/^\d+$/.test(shop??'')||!validDate(start)||!validDate(end)||start>end||(Date.parse(end)-Date.parse(start))/86400000>31)return send(res,400,{error:'请选择店铺和最多32天日期范围'});
  const key=await settings.key();if(!key)return send(res,503,{error:'请先保存密钥'});running=true;const client=new Mcp(process.env.SELLFOX_MCP_URL||'https://api-mcp.sellfox.com/mcp',key);
  try{await client.connect();const shops=await readPages(client,'get_shop_page_list',{});if(!shops.rows.some(s=>String(s.id)===shop))return send(res,400,{error:'店铺不在授权列表'});const result=await syncProducts(client,shop,start,end);await workspace.mutate(data=>{for(const row of result.rows){const index=data.products.findIndex(r=>r.id===row.id);if(index<0)data.products.push(row);else{const {history,...old}=data.products[index];data.products[index]={...old,...row,history:[...(history??[]),old].slice(-60)};}if(row.sku){const id='inv-'+row.id,existing=data.inventory.find(r=>r.id===id);const days=(Date.parse(end)-Date.parse(start))/86400000+1;const inv={...existing,id,sku:row.sku,name:row.name,available:row.available,reserved:row.reserved,inTransit:row.inTransit,dailySales:row.units===null?null:Number(row.units)/days,source:row.source,syncedAt:row.syncedAt};if(existing)Object.assign(existing,inv);else data.inventory.push(inv);}}});return send(res,200,{count:result.rows.length,complete:result.complete,warnings:result.warnings});}catch(e){return send(res,502,{error:e.message});}finally{await client.close();running=false;}
 }

 if(url.pathname==='/api/sales-anomalies'){
  if(req.method==='GET'){const data=await workspace.read();return send(res,200,{snapshot:data.salesSnapshots?.at(-1)??null});}
  if(req.method!=='POST')return send(res,405,{error:'请使用 POST'});
  if(running)return send(res,429,{error:'已有数据查询正在执行，请稍后再试'});
  let input;try{input=await body(req);}catch{return send(res,400,{error:'参数格式错误'});}
  const {asOf,shop='',caliber='settlement'}=input;if(!validDate(asOf)||!['settlement','shipment'].includes(caliber)||(shop&&!/^\d+$/.test(shop)))return send(res,400,{error:'日期、店铺或利润口径无效'});
  const key=await settings.key();if(!key)return send(res,503,{error:'请先在接口设置保存赛狐密钥'});running=true;const client=new Mcp(process.env.SELLFOX_MCP_URL||'https://api-mcp.sellfox.com/mcp',key);
  try{await client.connect();const shops=await readPages(client,'get_shop_page_list',{});if(shop&&!shops.rows.some(s=>String(s.id)===shop))return send(res,400,{error:'店铺不在授权列表内'});const snapshot=await readSalesAnomalies(client,{asOf,shop,caliber});await workspace.mutate(data=>{data.salesSnapshots??=[];data.salesSnapshots.push(snapshot);data.salesSnapshots=data.salesSnapshots.slice(-10);});return send(res,200,{snapshot});}catch(e){return send(res,502,{error:e.message});}finally{await client.close();running=false;}
 }
 if(url.pathname==='/api/workspace'){
  if(req.method==='GET'){try{return send(res,200,await workspace.read());}catch{return send(res,500,{error:'工作区读取失败，请检查数据文件与磁盘权限'});}}
  
  try{const input=await body(req);
   if(req.method==='PUT'){validateWorkspace(input);await workspace.mutate(data=>{for(const k of collections)data[k]=input[k];});return send(res,200,{ok:true});}
   if(!collections.includes(input.collection))return send(res,400,{error:'无效模块'});
   if(req.method==='POST'){if(!input.record||typeof input.record!=='object'||Array.isArray(input.record))throw new Error('记录格式错误');const record={...input.record,id:input.record.id||randomUUID(),updatedAt:new Date().toISOString()};await workspace.mutate(data=>{const list=data[input.collection],i=list.findIndex(r=>r.id===record.id);if(i<0){if(list.length>=5000)throw new Error('记录已达上限');list.push(record);}else list[i]=record;});return send(res,200,record);}
   if(req.method==='DELETE'){await workspace.mutate(data=>{data[input.collection]=data[input.collection].filter(r=>r.id!==input.id);});return send(res,200,{ok:true});}
   return send(res,405,{error:'不支持的方法'});
  }catch{return send(res,400,{error:'保存失败，请检查数据格式、磁盘权限与剩余空间'});}
 }
 if(req.method!=='GET')return send(res,405,{error:'仅支持读取'});
 if(url.pathname==='/api/status'){try{return send(res,200,{...await settings.status(),version:'1.1.0',authentication:true,user,csrfToken});}catch{return send(res,500,{error:'配置读取失败'});}}
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
   await client.connect();const requestedCurrency=url.searchParams.get('currency')||'',caliber=url.searchParams.get('caliber')||'settlement',shop=url.searchParams.get('shop')||'';if(!['','USD','CAD','CNY','EUR','GBP','MXN','BRL','JPY'].includes(requestedCurrency)||!['settlement','shipment'].includes(caliber))return send(res,400,{error:'无效的币种或利润口径'});const output={fetchedAt:new Date().toISOString(),period:{start,end},query:{currency:requestedCurrency,caliber,shop,source:'利润报表（不等同于经营看板）',timezone:'上游未声明'},sources:{}};
   try{output.sources.shops={status:'success',...await readPages(client,'get_shop_page_list',{})};}catch{output.sources.shops={status:'error',error:'店铺查询失败，请检查连接和权限'};}
   if(shop&&!output.sources.shops?.rows?.some(s=>String(s.id)===shop))return send(res,400,{error:'店铺不在当前授权列表'});
   try{output.sources.profit={status:'success',...await readPages(client,'get_profit_report_by_shop',{date_type:2,start_date:start.replaceAll('-',''),end_date:end.replaceAll('-',''),currency:requestedCurrency,profit_caliber_type:caliber,...(shop?{shop_ids:[Number(shop)]}:{}),field_list:['shopId','currency','salesNum','productSales','grossProfit','cpcCost','refundNum']})};}catch(e){output.sources.profit={status:'error',error:e.message};}
   return send(res,200,output);
  }catch(e){return send(res,502,{error:e.message});}finally{await client.close();running=false;}
 }
 const files={'/':'index.html','/app.js':'app.js','/api.js':'api.js','/style.css':'style.css','/ads.js':'ads.js','/workbench.js':'workbench.js','/settings.js':'settings.js','/advanced.js':'advanced.js','/workflows.js':'workflows.js','/accounts.js':'accounts.js','/sales.js':'sales.js','/official-ads.js':'official-ads.js'};
 if(!files[url.pathname])return send(res,404,{error:'Not found'});
 try{const file=files[url.pathname];res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(await readFile(new URL('./public/'+file,import.meta.url)));}catch{send(res,500,{error:'页面加载失败'});}
}
const server=http.createServer((req,res)=>{handle(req,res).catch(()=>{if(!res.headersSent)send(res,500,{error:'服务器处理失败，请检查配置与磁盘权限'});else res.end();});});
authReady.then(()=>server.listen(port,'0.0.0.0',()=>console.log(`Sellfox dashboard listening on ${server.address().port}`))).catch(()=>{console.error('账号数据初始化失败，请检查数据卷权限');process.exitCode=1;});
