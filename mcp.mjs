import {createHash} from 'node:crypto';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function unpack(result){
  if(result?.isError) throw new Error('赛狐工具调用失败，请检查密钥、权限或日期范围');
  if(result?.structuredContent) return result.structuredContent;
  for(const c of result?.content??[]) if(c.type==='text'){try{return JSON.parse(c.text)}catch{}}
  throw new Error('赛狐返回格式无法解析');
}
export class Mcp {
  constructor(url,key){this.url=url;this.key=key;this.seq=0;this.version='2025-03-26';this.lastCall=0;}
  async rpc(method,params,notification=false){
    const id=++this.seq;
    const headers={'Content-Type':'application/json',Accept:'application/json, text/event-stream','X-MCP-Key':this.key};
    if(this.session) headers['Mcp-Session-Id']=this.session;
    if(method!=='initialize') headers['MCP-Protocol-Version']=this.version;
    const response=await fetch(this.url,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',...(notification?{}:{id}),method,params}),signal:AbortSignal.timeout(45000)});
    if(!response.ok) throw new Error(`赛狐 MCP HTTP ${response.status}，请检查连接、授权或稍后重试`);
    if(response.headers.get('mcp-session-id')) this.session=response.headers.get('mcp-session-id');
    if(notification){await response.body?.cancel();return;}
    let message;
    if(response.headers.get('content-type')?.includes('text/event-stream')){
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
      try{while(!message){const {done,value}=await reader.read();buffer+=decoder.decode(value??new Uint8Array(),{stream:!done}).replace(/\r\n/g,'\n');let split;
        while((split=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,split);buffer=buffer.slice(split+2);const data=event.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(data){const parsed=JSON.parse(data);if(parsed.id===id)message=parsed;}}
        if(done)break;
      }}finally{await reader.cancel();}
    }else message=await response.json();
    if(!message||message.id!==id)throw new Error('MCP 未返回对应请求结果');
    if(message.error)throw new Error(`MCP 协议错误 ${message.error.code}`);
    return message.result;
  }
  async connect(){const init=await this.rpc('initialize',{protocolVersion:this.version,capabilities:{},clientInfo:{name:'sellfox-operations-dashboard',version:'1.0.0'}});this.version=init.protocolVersion;await this.rpc('notifications/initialized',{},true);this.tools=[];let cursor;do{const page=await this.rpc('tools/list',cursor?{cursor}:{});this.tools.push(...page.tools);cursor=page.nextCursor;}while(cursor);}
  async call(name,args){await sleep(Math.max(0,550-(Date.now()-this.lastCall)));this.lastCall=Date.now();return unpack(await this.rpc('tools/call',{name,arguments:args}));}
  async contract(toolId){
    if(!this.tools.some(t=>t.name==='sf_describe'))return null;
    let cursor,parts=[],contract;
    do{const result=await this.call('sf_describe',{tool_ids:[toolId],detail:true,...(cursor?{cursor}:{})});contract=result.tools?.find(t=>t.tool_id===toolId)??contract;parts.push(...result.contract_parts??[]);cursor=result.next_cursor;}while(cursor);
    if(!contract&&parts.length){parts.sort((a,b)=>a.part_index-b.part_index);if(parts.length!==parts[0].part_count||parts.some((p,i)=>p.part_index!==i))throw new Error('接口契约分片不完整');const raw=parts.map(p=>p.json_fragment).join('');if(createHash('sha256').update(raw).digest('hex')!==parts[0].sha256)throw new Error('接口契约校验失败');contract=JSON.parse(raw);}
    if(!contract)throw new Error('无法读取接口契约');return contract;
  }
  async execute(toolId,params,contract){
    if(contract)return this.call('sf_execute',{tool_id:toolId,contract_version:contract.contract_version,params});
    const tool=this.tools.find(t=>t.name===toolId);if(!tool)throw new Error(`服务未提供 ${toolId}`);
    const props=tool.inputSchema?.properties??{};
    if(Object.keys(params).some(k=>!(k in props)))throw new Error(`${toolId} 参数契约与当前实现不兼容`);
    return this.call(toolId,params);
  }
  async close(){if(this.session){try{await fetch(this.url,{method:'DELETE',headers:{'X-MCP-Key':this.key,'Mcp-Session-Id':this.session,'MCP-Protocol-Version':this.version},signal:AbortSignal.timeout(3000)});}catch{}}}
}
export function normalize(result){
  if(result.status&&result.status!=='complete')throw new Error('赛狐未完整完成查询，请稍后重试');
  if(result.code!==undefined&&![0,200,'0','200'].includes(result.code))throw new Error('赛狐业务查询失败');
  const data=result.data??result;
  const rows=data.rows??data.reportList;
  if(!Array.isArray(rows))throw new Error('接口未返回有效数据行，不能视为零数据');
  return {rows,total:data.total_count??data.totalSize??null,pages:data.total_pages??data.totalPage??null,coverage:result.coverage,warnings:result.warnings??[],validation:result.output_validation??null};
}
export async function readPages(client,id,params){
  const contract=await client.contract(id);let rows=[],warnings=[],validation=[],complete=false,total=null;
  for(let page=1;page<=30;page++){
    const r=normalize(await client.execute(id,{...params,page_no:page,page_size:20},contract));rows.push(...r.rows);warnings.push(...r.warnings);if(r.validation)validation.push(r.validation);total=r.total;
    if(r.coverage?.truncated)warnings.push('上游返回截断数据');
    if((total!==null&&rows.length>=Number(total))||(r.pages!==null&&page>=Number(r.pages))){complete=!r.coverage?.truncated;break;}
    if(!r.rows.length)break;
  }
  return {rows,total,complete,warnings:[...new Set(warnings)],validation};
}
