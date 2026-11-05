// Keep the horizontal control available while a long table extends below the viewport.
document.addEventListener('DOMContentLoaded',()=>{
 const bar=document.createElement('div'),track=document.createElement('div');bar.id='table-scroll-dock';bar.hidden=true;bar.tabIndex=0;bar.setAttribute('role','region');bar.setAttribute('aria-label','当前表格横向滚动，按左右方向键查看');bar.append(track);document.body.append(bar);
 let active=null,frame=0;const resize=new ResizeObserver(schedule);
 function schedule(){if(!frame)frame=requestAnimationFrame(update);}
 function update(){frame=0;let best=null,score=0;
  for(const wrap of document.querySelectorAll('main .tablewrap')){if(!wrap.getClientRects().length||wrap.scrollWidth<=wrap.clientWidth+1)continue;const r=wrap.getBoundingClientRect(),visible=Math.min(r.bottom,innerHeight-26)-Math.max(r.top,0);if(visible>score&&r.right>0&&r.left<innerWidth){best=wrap;score=visible;}}
  if(active!==best){if(active)resize.unobserve(active);active=best;if(active)resize.observe(active);}
  if(!active){bar.hidden=true;return;}const r=active.getBoundingClientRect(),left=Math.max(8,r.left),right=Math.min(document.documentElement.clientWidth-8,r.right);bar.hidden=false;bar.style.left=left+'px';bar.style.width=Math.max(0,right-left)+'px';track.style.width=bar.clientWidth+active.scrollWidth-active.clientWidth+'px';if(Math.abs(bar.scrollLeft-active.scrollLeft)>1)bar.scrollLeft=active.scrollLeft;
 }
 bar.addEventListener('scroll',()=>{if(active&&Math.abs(active.scrollLeft-bar.scrollLeft)>1)active.scrollLeft=bar.scrollLeft;},{passive:true});
 document.addEventListener('scroll',schedule,{capture:true,passive:true});window.addEventListener('resize',schedule,{passive:true});
 new MutationObserver(schedule).observe(document.querySelector('main'),{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});schedule();
});
