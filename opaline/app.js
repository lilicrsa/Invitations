(function(){
'use strict';
const $ = id => document.getElementById(id);
const SUPABASE_URL = 'https://sgatagagyfizuyrinmth.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YdlXEbQn9ZqILsjT6pyAug_ijgzm5fQ';
const Q = new URLSearchParams(location.search);
const slug = Q.get('i') || 'opaline-demo', PREVIEW = Q.get('preview'), LIVE = Q.get('live');
const IS_DEMO = /-demo$/.test(slug);
const TZ = 'Europe/Paris';
let INV = null;
function el(tag, cls, text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
  function waitLive(){ return new Promise(function(res){
    window.addEventListener('message', async function h(e){
      if(e.origin !== location.origin || !e.data || e.data.type !== 'live') return;
      window.removeEventListener('message', h); const inv = e.data.inv;
      if(!(inv.music_tracks && inv.music_tracks.url)){ try{ const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/get_invitation', { method:'POST', headers:{ apikey:SUPABASE_KEY, 'Content-Type':'application/json' }, body: JSON.stringify({ p_slug: slug }) }); const j = await r.json(); if(j && j.music_tracks) inv.music_tracks = j.music_tracks; }catch(_){} }
      res(inv); });
    try{ parent.postMessage({ type:'live-ready' }, location.origin); }catch(_){}
  }); }
if(PREVIEW){ const g = document.createElement('script'); g.src = '../preview-guard.js'; g.onerror = function(){ document.body.textContent = 'Aperçu indisponible pour le moment.'; }; document.head.appendChild(g); }

/* ---------- icônes supplémentaires ---------- */
(function(){
  const defs = document.querySelector('.icon-library defs'); if(!defs) return;
  const add = (id,p)=>{ const s = document.createElementNS('http://www.w3.org/2000/svg','symbol'); s.setAttribute('id',id); s.setAttribute('viewBox','0 0 40 40'); s.innerHTML = p; defs.appendChild(s); };
  add('cocktail','<path d="M7 8h26L20 22zM20 22v12M13 34h14M28 8l5-5"/>');
  add('cake','<path d="M8 35h24V25H8zM11 25v-6h18v6M20 19v-6"/><path d="M20 6c2.500 2.400 2.500 5.400 0 7-2.500-1.600-2.500-4.600 0-7z"/>');
  add('camera','<rect x="6" y="12" width="28" height="20" rx="3"/><circle cx="20" cy="22" r="6"/><path d="m14 12 2.500-5h7L26 12"/>');
  add('heart','<path d="M20 34S6 26 6 16a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 10-14 18-14 18z"/>');
})();
function stepIcon(title){
  const t = String(title||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  if(/ceremon|mairie|echange|voeux|engagement|benediction|nikah|henne/.test(t)) return 'rings';
  if(/accueil|arrivee|bienvenue|installation/.test(t)) return 'flower';
  if(/cocktail|apero|aperitif|vin d|champagne|boisson/.test(t)) return 'cocktail';
  if(/diner|dejeuner|repas|buffet|banquet|brunch/.test(t)) return 'dinner';
  if(/gateau|piece montee|dessert|cake/.test(t)) return 'cake';
  if(/soiree|danse|bal|dansante|dj|musique|fete/.test(t)) return 'music';
  if(/photo|shooting|portrait/.test(t)) return 'camera';
  if(/retrouvaille|surprise|feu d/.test(t)) return 'leaf';
  return 'heart';
}

/* ---------- musique ---------- */
const bgm = $('bgm'), musicBtn = $('musicBtn');
let musicUrl = null, musicOn = false, userPaused = false, started = false;
function musicIcon(){ musicBtn.textContent = musicOn ? '♫' : '♪'; musicBtn.style.opacity = musicOn ? '1' : '.7'; }
function startMusic(){
  if(!musicUrl) return;
  if(bgm.dataset.src !== musicUrl){ bgm.src = musicUrl; bgm.dataset.src = musicUrl; }
  bgm.volume = .7; bgm.play().then(()=>{ musicOn = true; userPaused = false; musicIcon(); }).catch(()=>{ musicOn = false; musicIcon(); });
}
['pointerdown','touchend','click'].forEach(ev=>document.addEventListener(ev,()=>{ if(musicUrl && started && !musicOn && !userPaused) startMusic(); },{passive:true}));
musicBtn.addEventListener('click',()=>{ if(!musicUrl) return; if(bgm.paused){ startMusic(); } else { bgm.pause(); musicOn = false; userPaused = true; musicIcon(); } });
document.addEventListener('visibilitychange',()=>{ if(document.hidden){ if(musicOn) bgm.pause(); } else if(musicOn){ bgm.play().catch(()=>{}); } });

/* ---------- dates (fuseau Europe/Paris) ---------- */
function parseTime(t){ const m = String(t||'').match(/(\d{1,2})\s*[:hH]\s*(\d{2})?/); return m ? [+m[1], +(m[2]||0)] : [0,0]; }
function parisToDate(y,mo,d,h,mi){
  let guess = Date.UTC(y,mo-1,d,h,mi);
  for(let i=0;i<2;i++){
    const parts = new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(guess)).reduce((a,p)=>(a[p.type]=p.value,a),{});
    const asUTC = Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute);
    guess += Date.UTC(y,mo-1,d,h,mi) - asUTC;
  }
  return new Date(guess);
}
const cap = s => s.charAt(0).toUpperCase()+s.slice(1);

/* ---------- remplissage ---------- */
function splitNames(inv){
  const t = inv.card_text || {};
  const raw = String(t.names || inv.host_names || inv.title || '');
  const p = raw.split(/\s+(?:et|&)\s+/i).map(s=>s.trim()).filter(Boolean);
  return p.length>=2 ? [p[0], p.slice(1).join(' & ')] : [raw, ''];
}
function richText(node, text){   // *mots* en italique doré
  node.textContent = '';
  String(text).split('\n').forEach((line,i)=>{ if(i) node.appendChild(document.createElement('br'));
    line.split(/(\*[^*]+\*)/).forEach(p=>{ if(!p) return; if(/^\*[^*]+\*$/.test(p)){ node.appendChild(el('em',null,p.slice(1,-1))); } else node.appendChild(document.createTextNode(p)); }); });
}
function setMedia(imgEl, m){
  if(!m) return false;
  if(m.kind === 'video'){
    const v = document.createElement('video'); v.src = m.url; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline','');
    v.style.cssText = 'width:100%;height:100%;object-fit:cover'; imgEl.replaceWith(v); v.play().catch(()=>{});
  } else { imgEl.src = m.url; }
  return true;
}
let cdTimer = null;
function fill(inv){
  INV = inv;
  const tx = inv.card_text || {};
  const [n1, n2] = splitNames(inv), full = n2 ? n1+' & '+n2 : n1;
  document.title = full ? full+' — Notre mariage' : 'Notre mariage';
  document.querySelector('[data-first]').textContent = n1; const sec = document.querySelector('[data-second]'); const amp = sec.previousElementSibling;
  if(n2){ sec.textContent = n2; } else { sec.remove(); amp.remove(); }
  document.querySelectorAll('[data-couple]').forEach(x=>x.textContent = full);
  if(tx.intro) $('heroKicker').textContent = tx.intro.toUpperCase();
  richText($('heroMsg'), tx.message1 || 'Le plus beau de notre histoire\nse vivra *avec vous.*');
  // photos
  const media = (Array.isArray(inv.media)?inv.media:[]).filter(m=>m&&m.url);
  const heroPhoto = tx.photo || (IS_DEMO ? 'assets/couple-hero.webp' : '');
  if(heroPhoto){ $('heroImg').src = heroPhoto; } else { document.querySelector('.hero-photo-wrap').remove(); document.querySelector('.hero-layout').classList.add('nophoto'); }
  const frames = IS_DEMO && !media.length ? [null,null,null] : media;
  const slots = [['imgInterlude','interlude'],['imgJoy','rsvpPortrait'],['imgPortrait','closingPhoto']];
  slots.forEach(([imgId, boxId], i)=>{
    const m = frames[i];
    if(IS_DEMO && !media.length) return;                   // démo : photos d'exemple
    if(m){ setMedia($(imgId), m); } else { $(boxId).remove(); }
  });
  if(!$('rsvpPortrait')) $('rsvp').classList.add('solo');
  if(!$('closingPhoto')) $('closing').classList.add('solo');
  // date
  const d = inv.event_date ? new Date(inv.event_date+'T12:00:00') : null;
  if(d){
    document.querySelector('[data-weekday]').textContent = cap(d.toLocaleDateString('fr-FR',{weekday:'long'}));
    document.querySelector('[data-day]').textContent = d.getDate();
    document.querySelector('[data-month-year]').textContent = cap(d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}));
    document.querySelector('[data-date-long]').textContent = d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) + (inv.event_time ? ' · '+inv.event_time : '');
    startCountdown(inv);
  } else { $('date').hidden = true; document.querySelector('[data-date-long]').remove(); }
  $('addCalendar').addEventListener('click', ()=>downloadIcs(inv));
  // lieu
  const vn = (inv.venue_name||'').trim(), ad = (inv.address||'').trim();
  if(vn || ad){
    $('venueName').textContent = vn || ad;
    $('venueAddress').textContent = vn && ad ? (ad.toLowerCase().indexOf(vn.toLowerCase())===0 ? ad.slice(vn.length).replace(/^[\s,–-]+/,'') || ad : ad) : '';
    if(!$('venueAddress').textContent) $('venueAddress').style.display='none';
    const map = $('mapLink'); map.href = inv.maps_url || ('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(ad || vn)); map.hidden = false; $('venuePending').hidden = true;
  } else { $('lieu').hidden = true; }
  $('venueTime').textContent = inv.event_time ? 'À partir de '+inv.event_time : '';
  const ex = $('venueExtra');
  if(inv.dress_code){ const x = el('div','small-line'); x.appendChild(el('b',null,'Dress code')); x.appendChild(document.createTextNode(inv.dress_code)); ex.appendChild(x); }
  if(inv.contact_name || inv.contact_phone){ const x = el('div','small-line'); x.appendChild(el('b',null,'Contact'));
    x.appendChild(document.createTextNode(inv.contact_name ? inv.contact_name+(inv.contact_phone?' — ':'') : ''));
    if(inv.contact_phone){ const a = el('a',null,inv.contact_phone); a.href = 'tel:'+inv.contact_phone.replace(/\s/g,''); x.appendChild(a); } ex.appendChild(x); }
  // rsvp
  if(!inv.rsvp_enabled){ $('rsvp').querySelector('.rsvp-card').hidden = true; if($('rsvpPortrait')===null) $('rsvp').hidden = true; }
  if(inv.message) $('rsvpIntro').textContent = inv.message;
  // programme
  const prog = (inv.invitation_programme||[]).slice().sort((a,b)=>a.position-b.position);
  const box = $('timelineEvents');
  if(prog.length){
    $('programme').hidden = false;
    prog.forEach(p=>{
      const ev = el('div','timeline-event reveal'); const ic = el('div','event-icon');
      ic.innerHTML = '<svg aria-hidden="true"><use href="#'+stepIcon(p.title)+'"/></svg>'; ev.appendChild(ic);
      const c = el('div','event-content'); if(p.time) c.appendChild(el('time',null,p.time)); c.appendChild(el('h3',null,p.title)); if(p.description) c.appendChild(el('p',null,p.description)); ev.appendChild(c); box.appendChild(ev);
    });
  }
  if(inv.music_tracks && inv.music_tracks.url){ musicUrl = inv.music_tracks.url; if(started){ musicBtn.style.display='flex'; startMusic(); } }
  initReveal(); initTimeline();
}

/* ---------- compte à rebours ---------- */
function startCountdown(inv){
  const [y,m,d] = inv.event_date.split('-').map(Number), [h,mi] = parseTime(inv.event_time);
  const target = parisToDate(y,m,d,h,mi);
  const ids = ['days','hours','minutes','seconds'];
  function tick(){
    let s = Math.floor((target - new Date())/1000);
    if(s <= 0){
      clearInterval(cdTimer); ids.forEach(i=>$(i).textContent='0');
      $('countdownMessage').textContent = 'C’est le grand jour ✨'; return;
    }
    const dd = Math.floor(s/86400); s%=86400; const hh = Math.floor(s/3600); s%=3600; const mm = Math.floor(s/60), ss = s%60;
    [dd,hh,mm,ss].forEach((v,i)=>{ $(ids[i]).textContent = String(v).padStart(2,'0'); });
  }
  tick(); cdTimer = setInterval(tick,1000);
}
function downloadIcs(inv){
  const [y,m,d] = inv.event_date.split('-').map(Number), [h,mi] = parseTime(inv.event_time);
  const s = parisToDate(y,m,d,h,mi), e = new Date(s.getTime()+4*3600*1000);
  const f = x => x.toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
  const nm = splitNames(inv); const title = 'Mariage '+(nm[1]?nm[0]+' & '+nm[1]:nm[0]);
  const esc = t => String(t||'').replace(/([,;])/g,'\\$1').replace(/\n/g,'\\n');
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Maison Opaline//FR','BEGIN:VEVENT','UID:'+(inv.id||slug)+'@maisonopaline-invitations.fr','DTSTAMP:'+f(new Date()),'DTSTART:'+f(s),'DTEND:'+f(e),'SUMMARY:'+esc(title),'LOCATION:'+esc([inv.venue_name,inv.address].filter(Boolean).join(', ')),'END:VEVENT','END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics],{type:'text/calendar'})); a.download = 'mariage.ics'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500);
}

/* ---------- apparitions au scroll ---------- */
function initReveal(){
  document.body.classList.add('motion-ready');
  const els = document.querySelectorAll('.reveal, .countdown');
  if(!('IntersectionObserver' in window)){ els.forEach(e=>e.classList.add('in-view')); return; }
  const io = new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in-view'); io.unobserve(e.target); } }),{threshold:.15,rootMargin:'0px 0px -6% 0px'});
  els.forEach(e=>io.observe(e));
}
function initTimeline(){
  const tl = $('timeline'), fill = $('timelineFill'); if(!tl || !fill) return;
  function upd(){ const r = tl.getBoundingClientRect(), vh = innerHeight; const p = Math.max(0, Math.min(1, (vh*.6 - r.top)/r.height)); fill.style.height = (p*100)+'%'; }
  addEventListener('scroll',upd,{passive:true}); addEventListener('resize',upd); upd();
}

/* ---------- RSVP ---------- */
function normName(n){ return String(n||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(Boolean).sort().join(' '); }
function initRsvp(){
  const f = $('rsvpForm'); if(!f) return;
  const err = $('formError'), okBox = $('rsvpSuccess');
  const storeKey = () => 'rsvp_'+(INV && INV.id);
  const getSaved = () => { try{ return JSON.parse(localStorage.getItem(storeKey())||'null'); }catch(_){ return null; } };
  const yes = () => f.attendance.value === 'yes';
  const syncCounts = () => { $('guestCounts').hidden = !yes(); };
  f.addEventListener('change', syncCounts); syncCounts();
  f.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{
    const i = $(b.dataset.target), min = +i.min, max = +i.max; i.value = Math.max(min, Math.min(max, (+i.value||0) + (+b.dataset.step))); }));
  async function call(mode, matchId, data){
    if(PREVIEW) return { status:'created', id:'apercu' };
    const res = await fetch(SUPABASE_URL+'/rest/v1/rpc/submit_rsvp',{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({p_invitation_id:INV.id,p_name:data.name,p_attending:data.attending,p_count:data.count,p_allergies:data.allergies,p_message:data.message,p_mode:mode,p_match_id:matchId||null})});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const r = await res.json(); if(r.status==='error') throw new Error('refused: '+r.reason); return r;
  }
  function success(updated, data, id){
    try{ localStorage.setItem(storeKey(), JSON.stringify({id, name:data.name, attending:data.attending, adults:data.adults, children:data.children, message:data.message})); }catch(_){}
    f.hidden = true; $('rsvpModeNotice').hidden = true;
    $('successMessage').textContent = data.attending
      ? data.name+', nous avons bien noté votre présence'+(data.count>1 ? ' ('+data.count+' personnes)' : '')+'. À très vite !'
      : data.name+', merci de nous avoir prévenus. Vous allez nous manquer.';
    okBox.hidden = false; okBox.scrollIntoView({behavior:'smooth',block:'center'});
  }
  $('editResponse').addEventListener('click',()=>{ okBox.hidden = true; f.hidden = false; const b = f.querySelector('button[type=submit]'); b.disabled = false; b.firstElementChild.textContent = 'Mettre à jour ma réponse'; });
  const saved = getSaved && null;
  f.addEventListener('submit', async e=>{
    e.preventDefault(); err.textContent = ''; f.querySelectorAll('.dupe').forEach(x=>x.remove());
    const name = f.name.value.trim().replace(/\s+/g,' ');
    const adults = +f.adults.value||0, children = +f.children.value||0, attending = yes();
    if(name.split(' ').filter(Boolean).length < 2){ err.textContent = 'Merci d’indiquer votre nom et votre prénom.'; f.name.focus(); return; }
    if(attending && adults+children < 1){ err.textContent = 'Merci d’indiquer le nombre de personnes.'; return; }
    const data = { name, attending, adults, children, count: attending ? adults+children : 0,
      allergies: attending && children>0 ? 'Dont '+children+' enfant'+(children>1?'s':'') : null, message: f.message.value.trim() || null };
    const btn = f.querySelector('button[type=submit]'); const lbl = btn.firstElementChild, old = lbl.textContent;
    btn.disabled = true; lbl.textContent = 'Envoi en cours…';
    const restore = () => { btn.disabled = false; lbl.textContent = old; };
    try{
      const sv = getSaved(); let r;
      if(sv && sv.id && normName(sv.name) === normName(name)) r = await call('update', sv.id, data); else r = await call('check', null, data);
      if(r.status === 'exists'){
        restore(); btn.hidden = true;
        const box = el('div','dupe'); box.appendChild(el('div','dupe-title','Vous avez déjà répondu'));
        box.appendChild(el('p',null,'Une réponse existe déjà au nom de « '+r.match_name+' ». Voulez-vous la modifier ? Ce que vous venez de saisir la remplacera.'));
        const y = el('button','dark-button','Oui, modifier ma réponse'); y.type='button';
        const n = el('button','outline-button','Non, c’est une autre personne'); n.type='button';
        const fail = () => { box.remove(); btn.hidden = false; err.textContent = 'L’envoi a échoué. Réessayez dans un instant.'; };
        y.addEventListener('click', async()=>{ y.disabled = n.disabled = true; try{ const x = await call('update', r.match_id, data); success(true,data,x.id); }catch(_){ fail(); } });
        n.addEventListener('click', async()=>{ y.disabled = n.disabled = true; try{ const x = await call('new', null, data); success(false,data,x.id); }catch(_){ fail(); } });
        box.appendChild(y); box.appendChild(n); f.insertBefore(box, btn); box.scrollIntoView({behavior:'smooth',block:'center'}); return;
      }
      success(r.status === 'updated', data, r.id);
    }catch(_){ restore(); err.textContent = 'L’envoi a échoué : votre saisie est conservée, réessayez dans un instant.'; }
  });
}

/* ---------- ouverture : enveloppe puis lumière ---------- */
const opening = $('opening'), video = $('envelopeVideo'), veil = $('lightVeil'), invitation = $('invitation');
let finishing = false;
function reveal(){
  if(finishing) return; finishing = true;
  veil.classList.remove('clearing'); veil.classList.add('full');
  setTimeout(()=>{
    opening.hidden = true; document.body.classList.remove('sealed'); invitation.removeAttribute('inert'); window.scrollTo(0,0);
    const hero = document.querySelector('.hero'); hero.classList.remove('entering'); void hero.offsetWidth; hero.classList.add('entering');
    veil.classList.remove('full'); veil.classList.add('clearing');
    setTimeout(()=>veil.classList.remove('clearing'), 1600);
  }, 1000);
}
function playOpening(){
  if(started) return; started = true;
  bgm.play().catch(()=>{}); if(musicUrl){ musicBtn.style.display = 'flex'; startMusic(); }
  opening.classList.add('playing');
  const bar = opening.querySelector('.opening-progress span');
  video.addEventListener('timeupdate',()=>{ if(video.duration){ bar.style.width = (video.currentTime/video.duration*100)+'%'; if(video.currentTime >= video.duration-.12) reveal(); } });
  video.addEventListener('ended', reveal); video.addEventListener('error', reveal);
  const p = video.play(); if(p && p.catch) p.catch(()=>setTimeout(reveal,200));
  setTimeout(reveal, 12000);   // sécurité
}
$('openInvitation').addEventListener('click', playOpening);
$('skipOpening').addEventListener('click', ()=>{ if(!started){ started = true; bgm.play().catch(()=>{}); if(musicUrl){ musicBtn.style.display='flex'; startMusic(); } } reveal(); });
$('replayOpening').addEventListener('click', ()=>{
  finishing = false; started = true; window.scrollTo(0,0); document.body.classList.add('sealed'); invitation.setAttribute('inert','');
  opening.hidden = false; opening.classList.remove('playing'); video.currentTime = 0;
  opening.querySelector('.opening-progress span').style.width = '0';
  video.pause(); setTimeout(()=>{ const p = video.play(); opening.classList.add('playing'); if(p&&p.catch) p.catch(()=>reveal()); },50);
});

/* ---------- chargement ---------- */
async function load(){
  try{
    let inv;
    if(LIVE){ inv = await waitLive(); }
    else if(PREVIEW){
      const r = await fetch(SUPABASE_URL+'/rest/v1/rpc/get_preview',{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_code:PREVIEW})});
      if(!r.ok) throw 0; inv = await r.json();
    } else {
      const r = await fetch(SUPABASE_URL+'/rest/v1/rpc/get_invitation',{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_slug:slug})});
      if(!r.ok) throw 0; inv = await r.json();
    }
    if(!inv) throw 0;
    fill(inv); initRsvp();
  }catch(e){
    opening.querySelector('.opening-caption').innerHTML = '<p style="font-size:14px">Invitation introuvable ou indisponible pour le moment.</p>';
  }
}
load();
})();
