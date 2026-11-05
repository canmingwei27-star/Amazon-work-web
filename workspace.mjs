import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
export const collections=['products','keywords','competitors','listings','inventory','tasks','searchterms','adjustments','shipments','assets','feedback','reviews'];
export class Workspace{
 constructor(directory){this.directory=directory;this.queue=Promise.resolve();}
 async read(){try{const data=JSON.parse(await readFile(join(this.directory,'workspace.json'),'utf8'));for(const key of collections)data[key]??=[];return data;}catch(e){if(e.code!=='ENOENT')throw e;return {version:1,...Object.fromEntries(collections.map(k=>[k,[]]))};}}
 async save(value){await mkdir(this.directory,{recursive:true});const path=join(this.directory,'workspace.json');await writeFile(path+'.tmp',JSON.stringify(value,null,2),{mode:0o600});await rename(path+'.tmp',path);}
 mutate(fn){const pending=this.queue.then(async()=>{const data=await this.read();const result=fn(data);await this.save(data);return result;});this.queue=pending.catch(()=>{});return pending;}
}
export function validateWorkspace(value){if(!value||value.version!==1)throw new Error('备份版本不支持');for(const key of collections){if(['products','keywords','competitors','listings','inventory','tasks'].includes(key)&&!Array.isArray(value[key]))throw new Error('备份缺少核心模块');value[key]??=[];if(!Array.isArray(value[key])||value[key].length>5000)throw new Error('备份数据结构或数量不合法');for(const r of value[key])if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.id!=='string')throw new Error('备份记录缺少 ID');}return value;}
