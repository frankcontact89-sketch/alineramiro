(()=>{const mobile=document.getElementById('mobile');const menu=document.getElementById('menu');if(!mobile||!menu)return;

// Add a clear back/close control at the top of the mobile menu.
if(!document.getElementById('mobileBack')){const back=document.createElement('button');back.id='mobileBack';back.type='button';back.setAttribute('aria-label','Close menu');back.innerHTML='← <span>Back</span>';back.style.cssText='display:flex;align-items:center;gap:10px;width:100%;padding:6px 0 20px;border:0;border-bottom:1px solid #d7e2ed;background:#fff;color:#0b1b2d;font:900 18px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;text-align:left;cursor:pointer';back.addEventListener('click',()=>{mobile.classList.remove('open');menu.setAttribute('aria-expanded','false');});mobile.prepend(back);}

// Add Student Portal to mobile navigation.
if(!mobile.querySelector('a[href="/academy.html"]')){const portal=document.createElement('a');portal.href='/academy.html';portal.textContent='Student Portal';portal.style.color='#1765d1';mobile.appendChild(portal);}

// Add Student Portal to desktop navigation.
const desktop=document.querySelector('.desktop');if(desktop&&!desktop.querySelector('a[href="/academy.html"]')){const portal=document.createElement('a');portal.href='/academy.html';portal.textContent='Student Portal';portal.style.color='#1765d1';desktop.appendChild(portal);}

// Ensure the menu button always toggles the menu and every in-page item actually navigates and closes it.
menu.setAttribute('aria-controls','mobile');menu.setAttribute('aria-expanded',mobile.classList.contains('open')?'true':'false');
menu.addEventListener('click',()=>{setTimeout(()=>menu.setAttribute('aria-expanded',mobile.classList.contains('open')?'true':'false'),0);});
mobile.querySelectorAll('a').forEach(a=>{a.addEventListener('click',e=>{const href=a.getAttribute('href')||'';if(href.startsWith('#')){e.preventDefault();mobile.classList.remove('open');menu.setAttribute('aria-expanded','false');const target=document.querySelector(href);if(target){target.scrollIntoView({behavior:'smooth',block:'start'});history.replaceState(null,'',href);}}else{mobile.classList.remove('open');menu.setAttribute('aria-expanded','false');}});});
})();