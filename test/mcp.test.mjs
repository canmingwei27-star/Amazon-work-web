import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {Mcp,readPages,normalize} from '../mcp.mjs';
test('拒绝异常和缺失容器，不把未知当作零',()=>{assert.throws(()=>normalize({status:'partial',data:{rows:[]}}));assert.throws(()=>normalize({data:null}));assert.equal(normalize({data:{rows:[],total_count:0}}).rows.length,0);});
test('Streamable HTTP 握手、SSE、会话和分页',async()=>{
 const calls=[];const server=http.createServer(async(req,res)=>{if(req.method==='DELETE'){res.end();return;}let body='';for await(const chunk of req)body+=chunk;const m=JSON.parse(body);calls.push(m);if(m.method==='notifications/initialized'){res.writeHead(202);res.end();return;}
 let result;if(m.method==='initialize'){res.setHeader('Mcp-Session-Id','test-session');result={protocolVersion:'2025-03-26'};}else{assert.equal(req.headers['mcp-session-id'],'test-session');if(m.method==='tools/list')result={tools:[{name:'get_shop_page_list',inputSchema:{properties:{page_no:{},page_size:{}}}}]};else{const page=m.params.arguments.page_no;result={content:[{type:'text',text:JSON.stringify({data:{rows:[{id:page}],totalSize:2,totalPage:2}})}]};}}
 res.writeHead(200,{'Content-Type':'text/event-stream'});res.end('data: '+JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\n\n');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const client=new Mcp(`http://127.0.0.1:${server.address().port}/mcp`,'fake-key');try{await client.connect();const r=await readPages(client,'get_shop_page_list',{});assert.equal(r.complete,true);assert.deepEqual(r.rows,[{id:1},{id:2}]);assert.equal(calls.filter(c=>c.method==='tools/call').length,2);}finally{await client.close();await new Promise(r=>server.close(r));}
});
