// Keep the horizontal control available while a long table extends below the viewport.
document.addEventListener('DOMContentLoaded',()=>{
 const bar=document.createElement('div'),track=document.createElement('div');bar.id='table-scroll-dock';bar.hidden=true;bar.tabIndex=0;bar.setAttribute('role','region');bar.setAttribute('aria-label','当前表格横向滚动，按左右方向键查看');bar.append(track);document.body.append(bar);
 const header=document.createElement('div');header.id='table-header-dock';header.hidden=true;header.setAttribute('aria-hidden','true');header.inert=true;document.body.append(header);let sourceHead=null,headerTable=null;
 function updateHeader(){
  const table=[...document.querySelectorAll('main .tablewrap table')].filter(t=>t.tHead&&t.getClientRects().length&&t.tHead.getBoundingClientRect().top<0&&t.getBoundingClientRect().bottom>0).sort((a,b)=>b.getBoundingClientRect().top-a.getBoundingClientRect().top)[0],head=table?.tHead;
  if(!head||!table.getClientRects().length){header.hidden=true;sourceHead=null;return;}
  const rect=table.getBoundingClientRect(),hr=head.getBoundingClientRect(),wrap=table.parentElement.getBoundingClientRect(),left=Math.max(0,wrap.left),right=Math.min(document.documentElement.clientWidth,wrap.right);
  if(hr.top>=0||rect.bottom<=0||right<=left){header.hidden=true;return;}
  if(sourceHead!==head){sourceHead=head;headerTable=table.cloneNode(false);headerTable.removeAttribute('id');const clone=head.cloneNode(true);for(const element of clone.querySelectorAll('[id]'))element.removeAttribute('id');headerTable.append(clone);const viewport=document.createElement('div');viewport.className='table-header-viewport';viewport.append(headerTable);header.replaceChildren(viewport);}
  const cells=[...head.rows[0].cells],copies=[...headerTable.tHead.rows[0].cells];headerTable.style.tableLayout='fixed';headerTable.style.width=rect.width+'px';cells.forEach((cell,i)=>{copies[i].style.width=cell.getBoundingClientRect().width+'px';});headerTable.style.transform='translateX('+(rect.left-left)+'px)';const card=(table.closest('section')||table.parentElement).getBoundingClientRect(),cardLeft=Math.max(0,card.left),cardRight=Math.min(document.documentElement.clientWidth,card.right);header.style.left=cardLeft+'px';header.style.width=cardRight-cardLeft+'px';header.style.paddingLeft=left-cardLeft+'px';header.style.paddingRight=cardRight-right+'px';header.firstElementChild.style.width=right-left+'px';header.style.top=Math.min(0,rect.bottom-hr.height)+'px';header.hidden=false;
 }
 let active=null,frame=0;const resize=new ResizeObserver(schedule);
 function schedule(){if(!frame)frame=requestAnimationFrame(update);}
 function update(){frame=0;updateHeader();let best=null,score=0;
  for(const wrap of document.querySelectorAll('main .tablewrap')){if(!wrap.getClientRects().length||wrap.scrollWidth<=wrap.clientWidth+1)continue;const r=wrap.getBoundingClientRect(),visible=Math.min(r.bottom,innerHeight-26)-Math.max(r.top,0);if(visible>score&&r.right>0&&r.left<innerWidth){best=wrap;score=visible;}}
  if(active!==best){if(active)resize.unobserve(active);active=best;if(active)resize.observe(active);}
  if(!active){bar.hidden=true;return;}const r=active.getBoundingClientRect(),left=Math.max(8,r.left),right=Math.min(document.documentElement.clientWidth-8,r.right);bar.hidden=false;bar.style.left=left+'px';bar.style.width=Math.max(0,right-left)+'px';track.style.width=bar.clientWidth+active.scrollWidth-active.clientWidth+'px';if(Math.abs(bar.scrollLeft-active.scrollLeft)>1)bar.scrollLeft=active.scrollLeft;
 }
 bar.addEventListener('scroll',()=>{if(active&&Math.abs(active.scrollLeft-bar.scrollLeft)>1)active.scrollLeft=bar.scrollLeft;},{passive:true});
 document.addEventListener('scroll',schedule,{capture:true,passive:true});document.addEventListener('click',event=>{if(event.target.closest('#tab-sales'))schedule();},{passive:true});window.addEventListener('resize',schedule,{passive:true});
 new MutationObserver(schedule).observe(document.querySelector('main'),{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});schedule();
});
