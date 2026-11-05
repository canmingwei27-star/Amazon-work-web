import {test} from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {mkdtemp,rm,writeFile,readdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {DockerEngine} from '../updater/engine.mjs';import {UpdateAgent,WEBSITE_IMAGE} from '../updater/core.mjs';
test('Docker integration: preserve volume/ports/environment, replace healthy and roll back unhealthy image',{skip:process.env.DOCKER_INTEGRATION!=='1',timeout:180000},async()=>{
 const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8'}).trim(),suffix=process.pid,target='amazon-work-web-ci-'+suffix,data='update-data-'+suffix,state='update-state-'+suffix,dir=await mkdtemp(join(tmpdir(),'docker-update-'));let originalId;
 const engine=new DockerEngine();await engine.negotiate();
 try{
  docker('tag','workbench:test',WEBSITE_IMAGE);docker('volume','create',data);docker('volume','create',state);
  originalId=docker('run','-d','--name',target,'--label','com.docker.compose.project=amazon-work-web','--label','com.docker.compose.service=dashboard','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--health-interval','1s','--health-retries','3','-p','127.0.0.1::3000','-e','PRESERVE_TEST=value','-v',data+':/app/data',WEBSITE_IMAGE);
  const agent=new UpdateAgent(engine,{target,stateDir:join(dir,'state'),backupDir:join(dir,'backup'),stateVolume:state,pollMs:300,healthTimeout:15000});await agent.init();await agent.healthy(originalId);
  docker('exec',target,'node','-e',"require('fs').writeFileSync('/app/data/marker','preserved')");const before=await engine.inspect(target);
  docker('commit','--change','LABEL org.opencontainers.image.version=ci-new',target,'updater-candidate:ci');
  engine.pull=async()=>{docker('tag','updater-candidate:ci',WEBSITE_IMAGE);};await agent.install({manual:true});assert.equal(agent.state.phase,'updated');const next=await engine.inspect(target);assert.notEqual(next.Id,originalId);assert.deepEqual(next.HostConfig.PortBindings,before.HostConfig.PortBindings);assert(next.Config.Env.includes('PRESERVE_TEST=value'));assert(next.Mounts.some(m=>m.Name===data&&m.Destination==='/app/data'));assert(next.Mounts.some(m=>m.Name===state&&m.Destination==='/updates'));assert.equal(docker('exec',target,'cat','/app/data/marker'),'preserved');assert((await readdir(agent.backupDir)).some(f=>f.endsWith('.tar')));
  // Verify shared status directory permissions from both the website UID and helper UID.
  docker('exec',target,'node','-e',"require('fs').writeFileSync('/updates/from-website','ok')");docker('run','--rm','--read-only','--no-healthcheck','--cap-drop','ALL','--user','0:0','-v',state+':/updates','--entrypoint','node','workbench:test','-e',"require('fs').writeFileSync('/updates/from-helper','ok')");assert.equal(docker('exec',target,'cat','/updates/from-helper'),'ok');
  docker('commit','--change','LABEL org.opencontainers.image.version=ci-bad',target,'updater-bad:ci');
  // updatePayload deliberately preserves original health configuration; simulate app failure with a failing command.
  const create=engine.create.bind(engine);engine.create=(name,payload)=>create(name,{...payload,Cmd:['node','-e','process.exit(1)']});engine.pull=async()=>{docker('tag','updater-bad:ci',WEBSITE_IMAGE);};await agent.install({manual:true});assert.equal(agent.state.phase,'rolled_back');assert.equal((await engine.inspect(target)).Id,next.Id);assert.equal(docker('exec',target,'cat','/app/data/marker'),'preserved');
 }finally{
  for(const name of docker('ps','-a','--format','{{.Names}}').split('\n').filter(n=>n===target||n.startsWith(target+'-rollback-')))try{docker('rm','-f',name);}catch{}
  for(const volume of [data,state])try{docker('volume','rm',volume);}catch{}
  await rm(dir,{recursive:true,force:true});
 }
});
