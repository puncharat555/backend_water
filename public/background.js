(()=>{ 'use strict';
  const $ = (sel)=> document.querySelector(sel);

  const sky   = $('#sky');
  const sun   = $('#sun');
  const moon  = $('#moon');
  const fab   = $('#bgFab');
  const fabBtn= $('#bgFabBtn');
  const menu  = $('#bgMenu');
  const pulse = $('#bgPulse');

  const MODES = ['morning','day','evening','night'];

  function computeModeByHour(h){
    if (h>=5  && h<9)  return 'morning';
    if (h>=9  && h<17) return 'day';
    if (h>=17 && h<20) return 'evening';
    return 'night';
  }

  function setOpacity(el,val){ if(el) el.style.opacity = String(val); }

  function updateFabIcon(mode){
    const icon = $('#fabIcon');
    if (!icon) return;
    icon.textContent = ({morning:'🌅',day:'☀️',evening:'🌇',night:'🌙'})[mode] || '🌤️';
  }

  function applyMode(mode){
    if (!sky) return;
    MODES.forEach(m=> sky.classList.remove(m));
    sky.classList.add(mode);
    const showSun  = (mode==='morning'||mode==='day'||mode==='evening');
    setOpacity(sun,  showSun?1:0);
    setOpacity(moon, mode==='night'?1:0);
    updateFabIcon(mode);
  }

  function triggerPulse(mode,x,y){
    if (!pulse) return;
    pulse.className = 'bg-pulse';
    if (mode!=='auto') pulse.classList.add(mode);
    pulse.style.setProperty('--x', (typeof x==='number') ? x+'px' : '95%');
    pulse.style.setProperty('--y', (typeof y==='number') ? y+'px' : '6%');
    void pulse.offsetWidth;  // restart animation
    pulse.classList.add('show');
  }

  let autoTimer = null;
  let currentMode = localStorage.getItem('bgMode') || 'auto';

  function setAuto(on){
    clearInterval(autoTimer);
    if (on){
      const tick = ()=> applyMode(computeModeByHour(new Date().getHours()));
      tick();
      autoTimer = setInterval(tick, 5*60*1000);
    }
  }

  function closeMenu(){
    if (!fab || !fabBtn || !menu) return;
    fab.classList.remove('open');
    fabBtn.setAttribute('aria-expanded','false');
    menu.setAttribute('aria-hidden','true');
  }

  // events
  if (fabBtn && fab && menu){
    fabBtn.addEventListener('click',(e)=>{
      e.stopPropagation();
      fabBtn.classList.add('press'); setTimeout(()=>fabBtn.classList.remove('press'),420);
      fab.classList.toggle('open');
      const isOpen = fab.classList.contains('open');
      fabBtn.setAttribute('aria-expanded', String(isOpen));
      menu.setAttribute('aria-hidden', String(!isOpen));
    });
    document.addEventListener('click',(e)=>{ if (!fab.contains(e.target)) closeMenu(); });
    document.addEventListener('keydown',(e)=>{ if (e.key==='Escape') closeMenu(); });

    menu.addEventListener('click',(e)=>{
      const btn = e.target.closest('.item[data-mode]');
      if (!btn) return;
      const mode = btn.dataset.mode;
      const x = e.clientX, y = e.clientY;

      if (mode === 'auto'){
        currentMode = 'auto';
        localStorage.setItem('bgMode','auto');
        setAuto(true);
        triggerPulse(computeModeByHour(new Date().getHours()), x, y);
      } else {
        currentMode = mode;
        localStorage.setItem('bgMode', mode);
        setAuto(false);
        applyMode(mode);
        triggerPulse(mode, x, y);
      }
      closeMenu();
    });
  }

  // init
  if (currentMode === 'auto') setAuto(true);
  else { setAuto(false); applyMode(currentMode); }

})(); 
