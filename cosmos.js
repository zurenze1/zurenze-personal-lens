(()=>{
  const hero=document.querySelector('.library-intro');
  const scene=hero?.querySelector('.planet-scene');
  const gallery=document.getElementById('gallery');
  const viewButton=document.getElementById('planet-view');
  const hint=document.getElementById('planet-hint');
  if(!hero||!scene)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const small=matchMedia('(max-width: 680px)');
  const stars=document.createElement('div');
  stars.className='planet-stars';
  for(let i=0;i<38;i++){
    const star=document.createElement('span');
    star.className='planet-star';
    star.style.cssText=`left:${(i*37+11)%100}%;top:${(i*23+7)%90}%;animation-delay:-${i*1.7}s;animation-duration:${6+i%5}s`;
    stars.append(star);
  }
  scene.append(stars);
  let visible=true,blocked=false,frame=0,drag=null,viewIndex=0;
  const target={x:0,y:0,scroll:0};
  const current={x:0,y:0,scroll:0};
  const clamp=(n,min=-1,max=1)=>Math.min(max,Math.max(min,n));
  const interfaceAllowed=()=>document.body.dataset.motion!=='off'&&!reduced.matches&&!document.hidden&&!document.querySelector('dialog[open]');
  const allowed=()=>!blocked;
  const apply=()=>{
    const distance=small.matches?22:42;
    hero.style.setProperty('--scene-x',`${(current.x*distance).toFixed(2)}px`);
    hero.style.setProperty('--scene-y',`${(current.y*distance*.55+current.scroll).toFixed(2)}px`);
    hero.style.setProperty('--scene-r',`${(current.x*.9).toFixed(3)}deg`);
  };
  const tick=()=>{
    frame=0;
    if(!allowed())return;
    for(const key of ['x','y','scroll'])current[key]+=(target[key]-current[key])*.1;
    apply();
    if(Object.keys(target).some(key=>Math.abs(target[key]-current[key])>.002))frame=requestAnimationFrame(tick);
  };
  const schedule=()=>{if(allowed()&&!frame)frame=requestAnimationFrame(tick);};
  const reset=()=>{
    target.x=target.y=0;
    hero.classList.remove('is-pointing');
    schedule();
  };
  const position=(x,y)=>{
    const rect=hero.getBoundingClientRect();
    const px=clamp((x-rect.left)/rect.width,0,1),py=clamp((y-rect.top)/rect.height,0,1);
    hero.style.setProperty('--pointer-x',`${(px*100).toFixed(2)}%`);
    hero.style.setProperty('--pointer-y',`${(py*100).toFixed(2)}%`);
    return {x:px*2-1,y:py*2-1,px,py};
  };
  const ripple=(px=.75,py=.5)=>{
    if(!allowed())return;
    const wave=document.createElement('span');wave.className='planet-wave';
    wave.style.left=`${px*100}%`;wave.style.top=`${py*100}%`;
    scene.append(wave);wave.addEventListener('animationend',()=>wave.remove(),{once:true});
  };
  hero.addEventListener('pointermove',event=>{
    if(!allowed())return;
    const p=position(event.clientX,event.clientY);
    if(event.pointerType==='touch'&&!drag)return;
    if(drag){
      target.x=clamp(drag.x+(event.clientX-drag.clientX)/(small.matches?130:260));
      target.y=event.pointerType==='touch'?drag.y:clamp(drag.y+(event.clientY-drag.clientY)/200);
      drag.moved||=Math.abs(event.clientX-drag.clientX)>6||Math.abs(event.clientY-drag.clientY)>6;
    }else{target.x=p.x;target.y=p.y;}
    hero.classList.add('is-pointing');schedule();
  },{passive:true});
  hero.addEventListener('pointerdown',event=>{
    if(!allowed()||event.target.closest('button,a,input,select,textarea'))return;
    drag={clientX:event.clientX,clientY:event.clientY,x:target.x,y:target.y,moved:false};
    hero.classList.add('is-pointing');
    if(event.pointerType==='mouse')hero.setPointerCapture(event.pointerId);
  });
  hero.addEventListener('pointerup',event=>{
    if(!drag)return;
    const moved=drag.moved;drag=null;
    if(hero.hasPointerCapture(event.pointerId))hero.releasePointerCapture(event.pointerId);
    if(!moved){const p=position(event.clientX,event.clientY);ripple(p.px,p.py);}
  });
  hero.addEventListener('pointercancel',()=>{drag=null;reset();});
  hero.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'&&!drag)reset();});
  const views=[[.8,-.35],[-.8,.35],[.2,.65],[0,0]];
  viewButton?.addEventListener('click',()=>{
    if(!allowed())return;
    [target.x,target.y]=views[viewIndex++%views.length];
    hero.style.setProperty('--pointer-x',`${50+target.x*36}%`);
    hero.style.setProperty('--pointer-y',`${50+target.y*30}%`);
    hero.classList.add('is-pointing');ripple();schedule();
  });
  document.addEventListener('scroll',()=>{
    if(!allowed())return;
    target.scroll=clamp(-hero.getBoundingClientRect().top/28,-14,14);schedule();
  },{passive:true});
  let hoveredCard=null;
  const resetCard=()=>{if(hoveredCard){hoveredCard.classList.remove('is-pointing');hoveredCard.style.removeProperty('--card-rx');hoveredCard.style.removeProperty('--card-ry');hoveredCard=null;}};
  gallery?.addEventListener('pointermove',event=>{
    if(!interfaceAllowed()||small.matches||event.pointerType==='touch')return;
    const card=event.target.closest('.shot');
    if(!card){resetCard();return;}
    if(hoveredCard!==card){resetCard();hoveredCard=card;}
    const r=card.getBoundingClientRect();const x=clamp((event.clientX-r.left)/r.width,0,1),y=clamp((event.clientY-r.top)/r.height,0,1);
    card.style.setProperty('--card-rx',`${((.5-y)*4).toFixed(2)}deg`);
    card.style.setProperty('--card-ry',`${((x-.5)*5).toFixed(2)}deg`);
    card.style.setProperty('--card-x',`${x*100}%`);card.style.setProperty('--card-y',`${y*100}%`);
    card.classList.add('is-pointing');
  },{passive:true});
  gallery?.addEventListener('pointerleave',resetCard);
  const revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    if(interfaceAllowed()){
      entry.target.classList.add('card-enter');
      entry.target.addEventListener('animationend',()=>entry.target.classList.remove('card-enter'),{once:true});
    }
    revealObserver.unobserve(entry.target);
  }),{rootMargin:'0px 0px 30px 0px',threshold:.08});
  const watchCards=()=>gallery?.querySelectorAll('.shot').forEach((card,index)=>{
    if(card.dataset.motionObserved)return;
    card.dataset.motionObserved='true';card.style.setProperty('--entry-delay',`${index%3*65}ms`);revealObserver.observe(card);
  });
  if(gallery)new MutationObserver(watchCards).observe(gallery,{childList:true});
  const sync=()=>{
    const disabled=document.body.dataset.motion==='off'||reduced.matches;
    blocked=disabled||!visible||document.hidden||Boolean(document.querySelector('dialog[open]'));
    hero.classList.toggle('scene-paused',blocked);
    if(viewButton)viewButton.disabled=disabled;
    if(hint)hint.textContent=disabled?(reduced.matches?'系统已减少动态':'动态已关闭'):(small.matches?'横向轻拖 · 或换个视角':'移动鼠标 · 点击星空');
    if(blocked){cancelAnimationFrame(frame);frame=0;scene.querySelectorAll('.planet-wave').forEach(w=>w.remove());drag=null;}
    if(!interfaceAllowed())resetCard();
    if(disabled){target.x=target.y=target.scroll=current.x=current.y=current.scroll=0;hero.classList.remove('is-pointing');apply();}
    else schedule();
  };
  const heroObserver=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:0});heroObserver.observe(hero);
  const stateObserver=new MutationObserver(sync);stateObserver.observe(document.body,{attributes:true,attributeFilter:['data-motion']});
  document.querySelectorAll('dialog').forEach(dialog=>stateObserver.observe(dialog,{attributes:true,attributeFilter:['open']}));
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);small.addEventListener('change',sync);
  watchCards();sync();
})();
