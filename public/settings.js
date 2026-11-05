document.addEventListener('DOMContentLoaded',()=>{
 const $=s=>document.querySelector(s),status=$('#settings-status');
 const update=async()=>{try{const r=await apiFetch('/api/settings'),s=await r.json();if(!r.ok)throw new Error(s.error);status.textContent=`${s.configured?'已配置密钥（不回显）':'未配置密钥'} · 来源：${s.source}${s.updatedAt?' · 保存时间：'+new Date(s.updatedAt).toLocaleString('zh-CN'):''}`;}catch(e){status.textContent=e.message;}};
 $('#tab-settings').onclick=()=>{for(const id of ['overview','ads-panel','wb-panel'])$('#'+id).hidden=true;$('#accounts-panel').hidden=true;$('#sales-panel').hidden=true;$('#settings-panel').hidden=false;update();};
 const save=async key=>{const r=await apiFetch('/api/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})}),s=await r.json();if(!r.ok)throw new Error(s.error);$('#settings-key').value='';await update();$('#connection').textContent=s.configured?'MCP 已配置':'等待配置密钥';};
 $('#settings-form').onsubmit=async e=>{e.preventDefault();if(!$('#settings-key').value.trim()){status.textContent='请输入密钥，或使用清除按钮';return;}$('#settings-save').disabled=true;try{await save($('#settings-key').value);}catch(e){status.textContent=e.message;}finally{$('#settings-save').disabled=false;}};
 $('#settings-clear').onclick=async()=>{if(!confirm('清除网站使用的赛狐密钥？'))return;try{await save('');}catch(e){status.textContent=e.message;}};
 $('#settings-test').onclick=async()=>{$('#settings-test').disabled=true;status.textContent='正在测试 MCP 连接…';try{const r=await apiFetch('/api/settings',{method:'POST'}),s=await r.json();if(!r.ok)throw new Error(s.error);status.textContent=s.message+' · '+s.tools+' 个工具';}catch(e){status.textContent=e.message;}finally{$('#settings-test').disabled=false;}};
});

