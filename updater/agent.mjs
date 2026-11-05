import {readdir,unlink} from 'node:fs/promises';import {join} from 'node:path';import {DockerEngine} from './engine.mjs';import {UpdateAgent,readJson,sleep} from './core.mjs';
const agent=new UpdateAgent(new DockerEngine(process.env.DOCKER_SOCKET||'/var/run/docker.sock'),{target:process.env.TARGET_CONTAINER||'amazon-work-web-dashboard-1',stateDir:process.env.UPDATE_STATE_DIR||'/updates',backupDir:process.env.UPDATE_BACKUP_DIR||'/backups',stateVolume:process.env.UPDATE_STATE_VOLUME||'amazon-work-web_update-state'});
let stopping=false;process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
try{await agent.init();const heartbeat=setInterval(()=>agent.save().catch(()=>console.error('更新状态保存失败')),5000);let nextAuto=0;
 while(!stopping){const files=(await readdir(agent.stateDir)).filter(f=>/^request-\d{13}-[a-f0-9-]{36}\.json$/.test(f)).sort();let handled=false;
  if(files.length){const file=join(agent.stateDir,files[0]);try{const request=await readJson(file);if(request?.id!==agent.state.lastRequestId)await agent.process(request);await unlink(file);handled=true;}catch{await agent.event('error','更新请求处理失败，请刷新状态后重试');}}
  if(!handled&&Date.now()>=nextAuto){nextAuto=Date.now()+agent.config.intervalSeconds*1000;try{if(await readJson(join(agent.stateDir,'transaction.json')))throw new Error('存在待恢复的更新，请先检查日志');agent.busy=true;const info=await agent.check();if(info.needsSetup||(agent.config.autoEnabled&&info.available))await agent.install();}catch(e){await agent.event('error',e.message,{lastError:e.message});}finally{agent.busy=false;}}
  if(!stopping)await sleep(2000);
 }
 clearInterval(heartbeat);await agent.writes;
}catch{console.error('更新助手启动失败，请检查 Docker socket、目标容器身份与数据卷权限');process.exitCode=1;}
