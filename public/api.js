// Same-origin writes use an anti-CSRF token. Do not compare proxy-rewritten Host values.
let requestToken;
async function apiFetch(input,options={}){
 const url=new URL(input,location.href),method=(options.method||'GET').toUpperCase();
 if(url.origin!==location.origin)throw new Error('仅允许请求本站接口');
 if(!['GET','HEAD','OPTIONS'].includes(method)){
  if(!requestToken){const status=await fetch('/api/auth/status',{cache:'no-store',credentials:'same-origin'});const data=await status.json();if(!status.ok||!data.csrfToken)throw new Error('无法取得请求校验令牌，请刷新页面');requestToken=data.csrfToken;}
  const headers=new Headers(options.headers);headers.set('X-CSRF-Token',requestToken);options={...options,headers};
 }
 const response=await fetch(url.href,{...options,credentials:'same-origin'});
 if(response.status===401&&!url.pathname.startsWith('/api/auth/'))location.assign('/login');
 if(response.status===403)requestToken=undefined; // Never replay a write automatically.
 return response;
}
