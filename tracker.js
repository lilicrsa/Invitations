/* Mesure d'audience anonyme (sans cookie, sans identifiant personnel).
   - un identifiant aléatoire par visite (sessionStorage), effacé à la fermeture de l'onglet ;
   - aucune adresse IP ni donnée personnelle enregistrée ;
   - désactivée si le navigateur envoie « Do Not Track ». */
(function(){
  var URL_ = 'https://sgatagagyfizuyrinmth.supabase.co/rest/v1/rpc/track', KEY = 'sb_publishable_YdlXEbQn9ZqILsjT6pyAug_ijgzm5fQ';
  var dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1';
  var host = location.hostname;
  var live = window.MO_TRACK_FORCE === true || /(^|\.)maisonopaline-invitations\.fr$/.test(host) || /github\.io$/.test(host);   // pas de mesure en local ni en test
  function sid(){
    try{ var s = sessionStorage.getItem('mo_sid'); if(!s){ s = Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4); sessionStorage.setItem('mo_sid', s); } return s; }
    catch(_){ return window.__mo_sid || (window.__mo_sid = Math.random().toString(36).slice(2, 14)); }
  }
  function page(){ var p = location.pathname.replace(/\/index\.html$/, '/').replace(/^\/+|\.html$/g, '').replace(/\/$/, ''); return p || 'index'; }
  function ref(){ try{ if(!document.referrer) return ''; var h = new URL(document.referrer).hostname.replace(/^www\./, ''); return h === host ? '' : h; }catch(_){ return ''; } }
  window.moTrack = function(type, o){
    if(dnt || !live) return;
    o = o || {};
    var body = { type:type, sid:sid(), page:o.page || page(), theme:o.theme || null, univers:o.univers || null, meta:o.meta || null };
    try{ fetch(URL_, { method:'POST', keepalive:true, headers:{ apikey:KEY, 'Content-Type':'application/json' }, body:JSON.stringify({ p:body }) }).catch(function(){}); }catch(_){}
  };
  window.moTrack('pageview', { meta:{ ref:ref() } });
})();
