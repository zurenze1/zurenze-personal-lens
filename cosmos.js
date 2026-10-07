(()=>{
  const hero=document.querySelector('.library-intro');
  const scene=hero?.querySelector('.planet-scene');
  if(!hero||!scene)return;
  const stars=[[10,16],[22,8],[35,24],[43,14],[57,7],[64,27],[72,12],[81,23],[90,8],[94,37],[61,42],[85,53]];
  const fragment=document.createDocumentFragment();
  stars.forEach(([left,top],index)=>{
    const star=document.createElement('span');
    star.className='planet-star';
    star.style.cssText=`left:${left}%;top:${top}%;animation-delay:-${index*1.7}s;animation-duration:${6+index%5}s`;
    fragment.append(star);
  });
  scene.append(fragment);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let visible=true;
  const sync=()=>hero.classList.toggle('scene-paused',!visible||document.hidden||document.body.dataset.motion==='off'||reduced.matches||Boolean(document.querySelector('dialog[open]')));
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:0});
  observer.observe(hero);
  const stateObserver=new MutationObserver(sync);
  stateObserver.observe(document.body,{attributes:true,attributeFilter:['data-motion']});
  document.querySelectorAll('dialog').forEach(dialog=>stateObserver.observe(dialog,{attributes:true,attributeFilter:['open']}));
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  sync();
})();
