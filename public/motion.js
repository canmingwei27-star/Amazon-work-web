document.addEventListener('DOMContentLoaded',()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let animation=null,frame=0;
 document.querySelector('nav')?.addEventListener('click',event=>{if(!event.target.closest('button:not(:disabled)')||reduced.matches)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const panel=[...document.querySelectorAll('main > div')].find(el=>!el.hidden&&el.getClientRects().length);if(!panel?.animate)return;animation?.cancel();animation=panel.animate([{opacity:.5,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'cubic-bezier(.2,.7,.2,1)'});});});
 reduced.addEventListener('change',()=>{if(reduced.matches){cancelAnimationFrame(frame);animation?.cancel();}});
});
