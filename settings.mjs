import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
export class Settings{
 constructor(dir){this.dir=dir;this.queue=Promise.resolve();}
 async master(){await mkdir(this.dir,{recursive:true});const path=join(this.dir,'master.key');try{return await readFile(path);}catch(e){if(e.code!=='ENOENT')throw e;const key=randomBytes(32);try{await writeFile(path,key,{mode:0o600,flag:'wx'});return key;}catch(e){if(e.code==='EEXIST')return readFile(path);throw e;}}}
 async get(){try{const doc=JSON.parse(await readFile(join(this.dir,'settings.enc'),'utf8'));const decipher=createDecipheriv('aes-256-gcm',await this.master(),Buffer.from(doc.iv,'base64'));decipher.setAuthTag(Buffer.from(doc.tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(doc.data,'base64')),decipher.final()]).toString());}catch(e){if(e.code==='ENOENT')return null;throw new Error('密钥配置读取失败，请重新保存密钥');}}
 async key(){const saved=await this.get();return saved?.key??process.env.SELLFOX_MCP_KEY??'';}
 async save(key){const pending=this.queue.then(async()=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',await this.master(),iv);const data=Buffer.concat([cipher.update(JSON.stringify({key,updatedAt:new Date().toISOString()})),cipher.final()]);const path=join(this.dir,'settings.enc');await writeFile(path+'.tmp',JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}),{mode:0o600});await rename(path+'.tmp',path);});this.queue=pending.catch(()=>{});await pending;}
 async status(){const saved=await this.get();return {configured:!!(saved?.key??process.env.SELLFOX_MCP_KEY),source:saved?'网页配置':process.env.SELLFOX_MCP_KEY?'环境变量':'未配置',updatedAt:saved?.updatedAt??null,endpoint:process.env.SELLFOX_MCP_URL||'https://api-mcp.sellfox.com/mcp'};}
}
