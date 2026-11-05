import http from 'node:http';
import {pipeline} from 'node:stream/promises';
export class DockerEngine{
 constructor(socketPath='/var/run/docker.sock'){this.socketPath=socketPath;this.prefix='';}
 async negotiate(){const info=await this.json('GET','/version');const [major,minor]=String(info.ApiVersion).split('.').map(Number);if(major!==1||minor<41)throw new Error('需要 Docker Engine API 1.41 或更新版本');this.prefix='/v1.'+Math.min(minor,47);}
 async request(method,path,body,timeout=60000){return new Promise((resolve,reject)=>{const raw=body===undefined?undefined:JSON.stringify(body);const req=http.request({socketPath:this.socketPath,path:this.prefix+path,method,headers:raw?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(raw)}:{}},res=>{if(res.statusCode>=200&&res.statusCode<300)resolve(res);else{res.resume();const e=new Error(`Docker 请求失败：${method} ${path.split('?')[0]}，HTTP ${res.statusCode}`);e.status=res.statusCode;reject(e);}});req.setTimeout(timeout,()=>req.destroy(new Error('Docker 请求超时')));req.on('error',reject);if(raw)req.write(raw);req.end();});}
 async json(method,path,body){const res=await this.request(method,path,body);let content='';for await(const c of res){content+=c;if(content.length>8*1024*1024)throw new Error('Docker 响应过大');}return content?JSON.parse(content):{};}
 inspect(name){return this.json('GET','/containers/'+encodeURIComponent(name)+'/json');}
 image(name){return this.json('GET','/images/'+encodeURIComponent(name)+'/json');}
 distribution(name){return this.json('GET','/distribution/'+encodeURIComponent(name)+'/json');}
 async pull(image,onProgress=()=>{}){const [repo,tag]=[image.slice(0,image.lastIndexOf(':')),image.slice(image.lastIndexOf(':')+1)];const res=await this.request('POST','/images/create?fromImage='+encodeURIComponent(repo)+'&tag='+encodeURIComponent(tag),undefined,15*60*1000);let buffer='';for await(const c of res){buffer+=c;if(buffer.length>2*1024*1024)throw new Error('镜像下载响应异常');let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);if(!line.trim())continue;const entry=JSON.parse(line);if(entry.error||entry.errorDetail)throw new Error('镜像下载失败，请检查 NAS 网络或镜像仓库权限');onProgress(entry.status??'下载中');}}if(buffer.trim()){const entry=JSON.parse(buffer);if(entry.error||entry.errorDetail)throw new Error('镜像下载失败');}}
 stop(id){return this.json('POST','/containers/'+encodeURIComponent(id)+'/stop?t=30');}
 start(id){return this.json('POST','/containers/'+encodeURIComponent(id)+'/start');}
 rename(id,name){return this.json('POST','/containers/'+encodeURIComponent(id)+'/rename?name='+encodeURIComponent(name));}
 remove(id){return this.json('DELETE','/containers/'+encodeURIComponent(id)+'?v=false&force=false');}
 create(name,body){return this.json('POST','/containers/create?name='+encodeURIComponent(name),body);}
 async archive(id,destination){const res=await this.request('GET','/containers/'+encodeURIComponent(id)+'/archive?path=%2Fapp%2Fdata',undefined,10*60*1000);await pipeline(res,destination);}
}
