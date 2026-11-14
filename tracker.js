/* Mesure d'audience anonyme (sans cookie, sans identifiant personnel).
   - un identifiant aléatoire par visite (sessionStorage), effacé à la fermeture de l'onglet ;
   - aucune adresse IP ni donnée personnelle enregistrée ;
   - désactivée si le navigateur envoie « Do Not Track ».
   Mode test utilisateur : ouvrir le site avec ?test=1 (voir testeur.js). */
(function(){
  var URL_ = 'https://sgatagagyfizuyrinmth.supabase.co/rest/v1/rpc/track', KEY = 'sb_publishable_YdlXEbQn9ZqILsjT6pyAug_ijgzm5fQ';
  var host = location.hostname;
  var live = window.MO_TRACK_FORCE === true || /(^|\.)maisonopaline-invitations\.fr$/.test(host) || /github\.io$/.test(host);   // pas de mesure en local ni en test
  function rnd(){ return Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4); }

  // ---- mode test : actif si ?test=… (nouvelle session) ou si une session de test est en cours ----
  var TKEY = 'mo_test', ts = null;
  try{
    var raw = localStorage.getItem(TKEY); ts = raw ? JSON.parse(raw) : null;
    if(/[?&]test(=|&|$)/.test(location.search) && (!ts || ts.done)){ ts = { sid:'t' + rnd(), i:-1, started:Date.now() }; localStorage.setItem(TKEY, JSON.stringify(ts)); }
    if(ts && (ts.done || Date.now() - (ts.started || 0) > 3 * 3600 * 1000)){ ts = null; localStorage.removeItem(TKEY); }
  }catch(_){ ts = null; }
  var testOn = !!ts;
  if(testOn){ window.MO_TEST_ACTIVE = true; live = live || window.MO_TRACK_FORCE === true; }
  // Do Not Track respecté sauf pour un testeur volontaire
  var dnt = !testOn && (navigator.doNotTrack === '1' || window.doNotTrack === '1');

  function sid(){
    if(testOn) return ts.sid;
    try{ var s = sessionStorage.getItem('mo_sid'); if(!s){ s = rnd(); sessionStorage.setItem('mo_sid', s); } return s; }
    catch(_){ return window.__mo_sid || (window.__mo_sid = rnd()); }
  }
  function page(){ var p = location.pathname.replace(/\/index\.html$/, '/').replace(/^\/+|\.html$/g, '').replace(/\/$/, ''); return p || 'index'; }
  function ref(){ try{ if(!document.referrer) return ''; var h = new URL(document.referrer).hostname.replace(/^www\./, ''); return h === host ? '' : h; }catch(_){ return ''; } }

  window.__moBuf = [];
  window.moTrack = function(type, o){
    o = o || {};
    var ev = { type:type, page:o.page || page(), theme:o.theme || null, univers:o.univers || null, meta:o.meta || null, ts:Date.now() };
    window.__moBuf.push(ev);
    try{ if(window.moOnEvent) window.moOnEvent(ev); }catch(_){}
    if(dnt || !live) return;
    var body = { type:type, sid:sid(), page:ev.page, theme:ev.theme, univers:ev.univers, meta:ev.meta };
    try{ fetch(URL_, { method:'POST', keepalive:true, headers:{ apikey:KEY, 'Content-Type':'application/json' }, body:JSON.stringify({ p:body }) }).catch(function(){}); }catch(_){}
  };
  window.moTrack('pageview', { meta:{ ref: testOn ? 'test' : ref() } });

  if(testOn){
    // pour l'analyse du parcours : chaque toucher est noté (libellé court, jamais le contenu des champs)
    document.addEventListener('click', function(e){
      var t = e.target && e.target.closest ? e.target.closest('a,button,summary,[role=button],input[type=checkbox],label') : null;
      if(t && t.closest('#mo-test')) return;
      var lab = t ? String(t.getAttribute('aria-label') || t.innerText || t.id || t.tagName).replace(/\s+/g, ' ').trim().slice(0, 40) : '(zone sans lien)';
      window.moTrack('tclick', { meta:{ t:lab } });
    }, true);
    [ 'test-missions.js?v=4', 'testeur.js?v=4' ].forEach(function(src){ var s = document.createElement('script'); s.src = src; s.async = false; document.head.appendChild(s); });
  }
})();
