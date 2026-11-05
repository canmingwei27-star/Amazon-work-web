document.addEventListener('DOMContentLoaded',()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let animation=null,frame=0;
 function playPanelMotion(){
  frame=0;
  if(reduced.matches)return;
  const panel=[...document.querySelectorAll('main > div')].find(el=>!el.hidden&&el.getClientRects().length);
  if(!panel?.animate)return;
  animation?.cancel();
  panel.style.willChange='opacity, transform';
  animation=panel.animate([{opacity:.5,transform:'translate3d(0,8px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:180,easing:'cubic-bezier(.2,.7,.2,1)',fill:'both'});
  animation.addEventListener('finish',()=>{panel.style.willChange='';},{once:true});
  animation.addEventListener('cancel',()=>{panel.style.willChange='';},{once:true});
 }
 document.querySelector('nav')?.addEventListener('click',event=>{
  if(!event.target.closest('button:not(:disabled)')||reduced.matches)return;
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(playPanelMotion);
 });
 reduced.addEventListener('change',()=>{if(reduced.matches){cancelAnimationFrame(frame);animation?.cancel();}});
});
