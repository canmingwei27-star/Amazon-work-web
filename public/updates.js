document.addEventListener('DOMContentLoaded',async()=>{
 const $=id=>document.getElementById(id),panel=$('updates-panel'),tab=$('tab-updates');let pending=false,reconnecting=false,active=false;
 const phases={idle:'检查完成',starting:'正在连接',downloading:'正在下载',backing_up:'正在备份',restarting:'正在安装',health_check:'正在验证',updated:'更新成功',rolling_back:'正在恢复',rolled_back:'已恢复旧版',error:'需要处理',failed:'需要人工处理',blocked:'已暂停重试',recovering:'正在恢复',not_installed:'未安装助手',cleanup_warning:'清理提醒'};
 const busy=s=>['starting','downloading','backing_up','restarting','health_check','rolling_back','recovering'].includes(s.phase);
 async function request(options){const response=await apiFetch('/api/updates',options);const data=await response.json();if(!response.ok)throw new Error(data.error||'更新服务暂不可用');return data;}
 const date=v=>v?new Date(v).toLocaleString():'—',version=v=>v&&v!=='旧版本'?'v'+String(v).replace(/^v/,''):'—';
 async function refresh(){
  if(!active)return;
  try{
   const s=await request();if(reconnecting){reconnecting=false;location.reload();return;}pending=false;
   $('update-version').textContent='v'+s.websiteVersion;$('update-phase').textContent=!s.configured?'助手未连接':s.available&&s.phase==='idle'?'发现新版本':phases[s.phase]||s.phase;
   $('update-message').textContent=s.message||'等待检查';$('update-progress').hidden=!busy(s);$('update-setup').hidden=s.configured;
   $('update-check').disabled=$('update-install').disabled=$('update-auto').disabled=!s.configured||busy(s);$('update-auto').checked=s.autoEnabled===true;
   $('update-meta').textContent='当前镜像版本：'+(s.currentVersion||'—')+' · 当前特性：'+(s.currentRelease||'—')+' · 提交：'+(s.currentRevision?.slice(0,7)||'—')+' · 上次检查：'+date(s.lastCheckAt)+' · 上次更新：'+date(s.lastUpdateAt)+(s.backupFile?' · 最近备份：'+s.backupFile:'');
   $('update-events').replaceChildren();
   for(const event of [...(s.events||[])].reverse()){const tr=document.createElement('tr');for(const value of [date(event.time),version(event.version),phases[event.phase]||event.phase,event.feature||'—',event.message]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('update-events').append(tr);}
  }catch(e){$('update-message').textContent=e.message+'；连接恢复后会继续显示状态。';reconnecting=true;}
 }
 async function command(action,extra={}){if(pending)return;pending=true;$('update-check').disabled=$('update-install').disabled=$('update-auto').disabled=true;try{await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...extra})});$('update-message').textContent='请求已提交，等待更新助手处理…';setTimeout(refresh,2500);}catch(e){$('update-message').textContent=e.message;pending=false;$('update-check').disabled=$('update-install').disabled=$('update-auto').disabled=false;}}
 try{const r=await apiFetch('/api/auth/status'),s=await r.json();tab.hidden=s.user?.role!=='admin';}catch{return;}
 document.querySelector('nav').addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;active=button===tab;panel.hidden=!active;if(active){for(const id of ['overview','ads-panel','wb-panel','settings-panel','accounts-panel','sales-panel'])$(id).hidden=true;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b===tab));refresh();}});
 $('update-check').onclick=()=>command('check');$('update-install').onclick=()=>{if(confirm('安装最新已发布镜像？下载期间可继续使用，切换时会短暂停机。失败将恢复旧版容器。'))command('install');};$('update-auto').onchange=e=>command('configure',{autoEnabled:e.target.checked});
 setInterval(()=>{if(active&&!document.hidden)refresh();},5000);
});
