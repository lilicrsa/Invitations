/* Protection de l'aperçu client (activée uniquement avec ?preview=<code>).
   Dissuasion : filigrane répété et mobile, écran noir quand la page perd le focus / sur les raccourcis de capture /
   à l'impression, clic droit, sélection et copie bloqués, filigrane surveillé (retiré = écran noir).
   Limite connue : un navigateur ne peut PAS empêcher une capture ou un enregistrement d'écran du système. */
(function(){
  'use strict';
  var code = new URLSearchParams(location.search).get('preview');
  if(!code) return;
  var tag = String(code).slice(-6).toUpperCase();
  var ID = 'pg-' + Math.random().toString(36).slice(2, 8);

  /* ---------- styles ---------- */
  var css = document.createElement('style');
  css.textContent =
    'html,body{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}' +
    'img,video,canvas{-webkit-user-drag:none!important;user-drag:none!important}' +
    '@media print{html{display:none!important}}' +
    '#'+ID+'-wm{position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:hidden}' +
    '#'+ID+'-tile{position:absolute;inset:-50%;transform:rotate(-24deg)}' +
    '#'+ID+'-big{position:absolute;left:0;top:0;width:100%;text-align:center;font:800 11vw/1 system-ui,sans-serif;letter-spacing:.08em;' +
      'color:rgba(255,255,255,.30);-webkit-text-stroke:1px rgba(0,0,0,.28);transition:top 1.2s ease,left 1.2s ease;transform:rotate(-24deg);white-space:nowrap}' +
    '.'+ID+'-dot{position:absolute;font:700 11px/1 system-ui,sans-serif;color:rgba(255,255,255,.55);text-shadow:0 0 2px rgba(0,0,0,.8);transition:all .8s ease}' +
    '#'+ID+'-tag{position:fixed;left:0;top:0;z-index:2147483001;pointer-events:none;background:rgba(0,0,0,.55);color:#fff;font:700 11px/1 system-ui,sans-serif;' +
      'letter-spacing:.12em;padding:5px 9px;border-bottom-right-radius:8px}' +
    '#'+ID+'-bo{position:fixed;inset:0;z-index:2147483647;background:#000;color:#fff;display:none;align-items:center;justify-content:center;text-align:center;' +
      'font:600 15px/1.5 system-ui,sans-serif;padding:2rem}';
  document.head.appendChild(css);

  /* ---------- filigrane ---------- */
  var label = 'APERÇU · ' + tag;
  var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='260' height='120'><text x='130' y='64' text-anchor='middle' font-family='system-ui,sans-serif' font-size='19' font-weight='800' letter-spacing='2' " +
            "fill='rgba(255,255,255,0.34)' stroke='rgba(0,0,0,0.30)' stroke-width='0.8'>" + label + "</text></svg>";
  var wm = document.createElement('div'); wm.id = ID + '-wm';
  var tile = document.createElement('div'); tile.id = ID + '-tile';
  tile.style.backgroundImage = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
  wm.appendChild(tile);
  var big = document.createElement('div'); big.id = ID + '-big'; big.textContent = 'APERÇU'; wm.appendChild(big);
  var dots = [];
  for(var i = 0; i < 6; i++){ var d = document.createElement('span'); d.className = ID + '-dot'; d.textContent = tag; wm.appendChild(d); dots.push(d); }
  function shuffle(){
    big.style.top = (15 + Math.random() * 55) + '%'; big.style.left = (-8 + Math.random() * 16) + '%';
    dots.forEach(function(d){ d.style.left = (3 + Math.random() * 90) + '%'; d.style.top = (3 + Math.random() * 92) + '%'; });
  }
  shuffle(); setInterval(shuffle, 2500);

  var tagEl = document.createElement('div'); tagEl.id = ID + '-tag'; tagEl.textContent = 'APERÇU';

  /* ---------- écran noir ---------- */
  var bo = document.createElement('div'); bo.id = ID + '-bo';
  var boMsg = document.createElement('div'); bo.appendChild(boMsg);
  var blocked = false, holdUntil = 0;
  function hide(msg, holdMs){
    blocked = true; holdUntil = Date.now() + (holdMs || 0);
    boMsg.textContent = msg || 'Aperçu protégé. Touchez l’écran pour reprendre.';
    bo.style.display = 'flex';
    try{ document.querySelectorAll('video,audio').forEach(function(m){ m.pause(); }); }catch(_){}
  }
  function show(){
    if(Date.now() < holdUntil) return;
    blocked = false; bo.style.display = 'none';
    try{ var v = document.getElementById('intro-video'); if(v && !v.ended && document.getElementById('intro') && !document.getElementById('intro').classList.contains('hidden') && v.currentTime > 0) v.play().catch(function(){}); }catch(_){}
    try{ var a = document.getElementById('bg-music'); if(a && a.dataset && a.dataset.src && a.dataset.src !== 'silent' && !a.dataset.userpaused) a.play().catch(function(){}); }catch(_){}
  }
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function(ev){
    bo.addEventListener(ev, function(e){ e.preventDefault(); e.stopPropagation(); show(); }, true);
  });

  /* ---------- déclencheurs ---------- */
  var everActive = false;
  function activate(){ everActive = true; }
  window.addEventListener('pointerdown', activate, true); window.addEventListener('touchstart', activate, true); window.addEventListener('keydown', activate, true);
  document.addEventListener('visibilitychange', function(){ if(document.hidden) hide(); });
  window.addEventListener('pagehide', function(){ hide(); });
  var embedded = false; try{ embedded = window.top !== window; }catch(_){ embedded = true; }
  window.addEventListener('blur', function(){ if(everActive && !embedded) hide(); });
  window.addEventListener('beforeprint', function(){ hide('Impression désactivée.', 2000); });
  setInterval(function(){
    if(everActive && !embedded && !blocked && !document.hasFocus()) hide();
    // surveillance : si le filigrane ou l'écran noir a été retiré / masqué, on bloque
    var ok = document.getElementById(ID + '-wm') && document.getElementById(ID + '-bo');
    if(!ok){ document.body.appendChild(wm); document.body.appendChild(bo); document.body.appendChild(tagEl); hide('Aperçu protégé.', 1500); return; }
    var cs = getComputedStyle(wm);
    if(cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.9 || wm.getBoundingClientRect().width < innerWidth - 2){
      wm.style.cssText = ''; hide('Aperçu protégé.', 1500);
    }
  }, 700);
  new MutationObserver(function(){
    if(!document.getElementById(ID + '-wm') || !document.getElementById(ID + '-bo')){
      document.body.appendChild(wm); document.body.appendChild(bo); document.body.appendChild(tagEl); hide('Aperçu protégé.', 1500);
    }
  }).observe(document.body, { childList: true });

  var captureKeys = function(e){
    var k = (e.key || '').toLowerCase();
    var meta = e.metaKey, ctrl = e.ctrlKey, shift = e.shiftKey;
    var hit = k === 'printscreen' || k === 'snapshot' ||
      (meta && shift && /^[3-5]$/.test(k)) || (meta && shift && ['3', '4', '5', '#', '$', '%'].indexOf(e.key) > -1) ||
      (meta && shift && k === 's') || (ctrl && shift && k === 's') ||
      (ctrl && (k === 'p' || k === 's' || k === 'u')) || k === 'f12';
    if(hit){
      e.preventDefault(); e.stopPropagation();
      hide('Capture d’écran désactivée.', 2500);
      try{ navigator.clipboard.writeText(' ').catch(function(){}); }catch(_){}
    }
  };
  window.addEventListener('keydown', captureKeys, true); window.addEventListener('keyup', captureKeys, true);

  ['contextmenu', 'dragstart', 'selectstart', 'copy', 'cut'].forEach(function(ev){
    document.addEventListener(ev, function(e){ e.preventDefault(); }, true);
  });

  document.body.appendChild(wm); document.body.appendChild(tagEl); document.body.appendChild(bo);
})();
