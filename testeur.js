/* Panneau du test utilisateur : affiché seulement en mode test (?test=1), sur le vrai site.
   Les missions sont dans test-missions.js. Les résultats partent dans la base via moTrack (événements test_*). */
(function(){
  var M = window.MO_MISSIONS || [];
  if(!M.length || !window.MO_TEST_ACTIVE) return;
  var KEY = 'mo_test';
  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)) || null; }catch(_){ return null; } }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(st)); }catch(_){} }
  var st = load(); if(!st) return;
  var N = M.length;
  var busy = false, min = false, cur = null;   // cur : { done, k, ms, auto } pour la mission en cours

  // ---- style ----
  var css = document.createElement('style');
  css.textContent = [
    '#mo-test{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;justify-content:center;pointer-events:none;font:15px/1.45 Manrope,system-ui,sans-serif;}',
    '#mo-test .box{pointer-events:auto;width:min(560px,100%);background:#10152b;color:#F2ECDD;border:1px solid #E7D5A8;border-bottom:0;border-radius:18px 18px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.55);padding:.8rem 1rem calc(.9rem + env(safe-area-inset-bottom,0px));max-height:78vh;overflow:auto;}',
    '#mo-test .hd{display:flex;align-items:center;gap:.6rem;font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;color:#E7D5A8;}',
    '#mo-test .bar{flex:1;height:4px;border-radius:2px;background:rgba(231,213,168,.2);overflow:hidden;} #mo-test .bar i{display:block;height:100%;background:#E7D5A8;}',
    '#mo-test .mn{background:none;border:1px solid rgba(231,213,168,.5);color:#E7D5A8;border-radius:999px;width:30px;height:30px;cursor:pointer;font-size:1rem;line-height:1;padding:0;}',
    '#mo-test h4{margin:.55rem 0 .2rem;font:400 1.15rem/1.35 Georgia,serif;color:#fff;} #mo-test p{margin:.3rem 0;color:#cfd3e3;font-size:.88rem;}',
    '#mo-test .row{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.7rem;}',
    '#mo-test button.b,#mo-test .opt{font:inherit;cursor:pointer;border-radius:999px;border:1px solid #E7D5A8;background:transparent;color:#E7D5A8;padding:.55rem 1rem;}',
    '#mo-test button.p{background:#E7D5A8;color:#10152b;font-weight:700;} #mo-test button:disabled{opacity:.4;cursor:default;}',
    '#mo-test .opt{display:block;width:100%;text-align:left;border-radius:12px;margin-top:.4rem;} #mo-test .opt.on{background:rgba(231,213,168,.18);border-width:2px;}',
    '#mo-test textarea,#mo-test input[type=text]{width:100%;box-sizing:border-box;margin-top:.5rem;padding:.6rem .7rem;border-radius:10px;border:1px solid rgba(231,213,168,.5);background:#0a0e1d;color:#fff;font:inherit;}',
    '#mo-test .sc{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.6rem;} #mo-test .sc button{min-width:38px;padding:.5rem .4rem;border-radius:10px;}',
    '#mo-test .ok{color:#8FD3A3;font-weight:700;} #mo-test .lh{display:flex;justify-content:space-between;font-size:.72rem;color:#9aa1bd;margin-top:.3rem;}',
    '#mo-test .pill{pointer-events:auto;margin:0 0 .6rem;background:#10152b;color:#E7D5A8;border:1px solid #E7D5A8;border-radius:999px;padding:.55rem 1rem;font:inherit;font-size:.86rem;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.5);}',
    '#mo-test.pillmode{align-items:flex-end;}'
  ].join('');
  document.head.appendChild(css);
  var root = document.createElement('div'); root.id = 'mo-test'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Test utilisateur');
  document.body.appendChild(root);

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]; }); }
  function track(type, meta){ if(window.moTrack) moTrack(type, { meta:meta || null }); }
  function pad(){ var h = root.firstChild ? root.firstChild.getBoundingClientRect().height : 0; document.body.style.paddingBottom = Math.ceil(h) + 'px'; }

  // ---- détection automatique de la réussite ----
  function match(ev, a){
    if(ev.type !== a.ev) return false;
    var w = a.w || {};
    for(var k in w){
      var v = (ev[k] != null) ? ev[k] : (ev.meta ? ev.meta[k] : null), want = w[k];
      if(Array.isArray(want)){ if(want.indexOf(v) < 0) return false; } else if(String(v) !== String(want)) return false;
    }
    return true;
  }
  function target(){ var m = M[st.i]; return (m && m.type === 'task' && m.auto) ? (m.auto.n || 1) : 0; }
  // un événement vu après le début de la mission compte ; le total est gardé d'une page à l'autre
  function tally(ev){
    var m = M[st.i]; if(!target() || ev.ts < (st.mt || 0) || !match(ev, m.auto)) return;
    st.cnt = (st.cnt || 0) + 1; save();
  }
  window.moOnEvent = function(ev){
    if(cur && cur.done) return;
    tally(ev);
    if(target() && (st.cnt || 0) >= target()) finishTask('auto');
  };

  // ---- mission ----
  function startMission(){
    st.mt = Date.now(); st.cnt = 0; save(); cur = null; min = false;
    render();
  }
  function send(meta){ meta.m = M[st.i].id; meta.ms = Date.now() - (st.mt || Date.now()); track('test_task', meta); }
  function next(){
    st.i++; save();
    if(st.i >= N){ endTest(); return; }
    startMission();
  }
  function finishTask(kind){
    if(cur && cur.done) return;
    var m = M[st.i]; cur = { done:true, k:kind, ms:Date.now() - (st.mt || Date.now()) };
    if(m.rate && kind !== 'skip'){ min = false; render(); } else { send({ k:kind }); next(); }
  }
  function endTest(){
    track('test_end', {}); st.done = true; save(); st.i = N;
    root.innerHTML = box('<h4>Merci beaucoup ! 🙏</h4><p>Vos réponses nous aident à rendre le site plus simple. Vous pouvez fermer cette page.</p>', 100);
    document.body.style.paddingBottom = '';
    window.moOnEvent = null;
    setTimeout(function(){ try{ localStorage.removeItem(KEY); }catch(_){} }, 0);
    pad();
  }
  function box(inner, pct){
    return '<div class="box"><div class="hd"><span>Test</span><div class="bar"><i style="width:' + pct + '%"></i></div><span>' + (st.i < N && st.i >= 0 ? (st.i + 1) + '/' + N : '') + '</span>' + (st.i >= 0 && st.i < N ? '<button class="mn" type="button" data-a="min" aria-label="Réduire">–</button>' : '') + '</div>' + inner + '<p style="text-align:center;margin:.8rem 0 0"><button type="button" data-a="quit" style="background:none;border:0;color:#9aa1bd;text-decoration:underline;font:inherit;font-size:.75rem;cursor:pointer">Quitter le test</button></p></div>';
  }

  function render(){
    if(st.i < 0){ return renderIntro(); }
    if(st.i >= N){ return endTest(); }
    var m = M[st.i], pct = Math.round(100 * st.i / N);
    if(min){ root.className = 'pillmode'; root.innerHTML = '<button class="pill" type="button" data-a="max">Mission ' + (st.i + 1) + '/' + N + ' · afficher ▲</button>'; pad(); return; }
    root.className = '';
    var h = '', picked = (cur && cur.pick != null) ? cur.pick : null;
    if(m.type === 'task'){
      if(cur && cur.done){
        h = '<h4><span class="ok">' + (cur.k === 'auto' ? '✓ ' : '') + '</span>' + esc(m.q) + '</h4>' + (cur.k === 'auto' ? '<p class="ok">Bien vu, c’est noté.</p>' : '')
          + '<p>Cette étape était-elle facile ?</p><div class="sc">' + [1, 2, 3, 4, 5].map(function(n){ return '<button class="b" type="button" data-a="rate" data-v="' + n + '">' + n + '</button>'; }).join('') + '</div><div class="lh"><span>Très difficile</span><span>Très facile</span></div>';
      } else {
        h = '<h4>' + esc(m.q) + '</h4>' + (m.hint ? '<p>' + esc(m.hint) + '</p>' : '')
          + '<div class="row">' + (m.action ? '<button class="b p" type="button" data-a="act">' + esc(m.action.label) + '</button>' : '')
          + '<button class="b" type="button" data-a="done">J’ai terminé</button><button class="b" type="button" data-a="giveup">Je n’y arrive pas</button></div>'
          + '<p style="font-size:.75rem">Touchez « – » pour réduire ce panneau et utiliser le site.</p>';
      }
    } else if(m.type === 'choice'){
      h = '<h4>' + esc(m.q) + '</h4>' + (m.hint ? '<p>' + esc(m.hint) + '</p>' : '') + m.opts.map(function(o, i){ return '<button class="opt' + (picked === i ? ' on' : '') + '" type="button" data-a="pick" data-v="' + i + '">' + esc(o) + '</button>'; }).join('')
        + '<div class="row"><button class="b p" type="button" data-a="ok"' + (picked == null ? ' disabled' : '') + '>Valider</button></div>';
    } else if(m.type === 'text'){
      h = '<h4>' + esc(m.q) + '</h4>' + (m.hint ? '<p>' + esc(m.hint) + '</p>' : '') + '<textarea rows="3" id="mo-ta" placeholder="Votre réponse…" aria-label="Votre réponse"></textarea>'
        + '<div class="row"><button class="b p" type="button" data-a="ok">Valider</button><button class="b" type="button" data-a="skip">Je ne sais pas</button></div>';
    } else if(m.type === 'scale'){
      var b = '';
      for(var n = m.min; n <= m.max; n++) b += '<button class="b" type="button" data-a="scale" data-v="' + n + '">' + n + '</button>';
      h = '<h4>' + esc(m.q) + '</h4><div class="sc">' + b + '</div><div class="lh"><span>' + esc(m.lo || '') + '</span><span>' + esc(m.hi || '') + '</span></div>';
    }
    root.innerHTML = box(h, pct); pad();
    var ta = document.getElementById('mo-ta'); if(ta) ta.focus({ preventScroll:true });
  }

  function renderIntro(){
    var ua = navigator.userAgent, dev = /Mobi|Android|iPhone/i.test(ua) ? 'téléphone' : 'ordinateur';
    root.className = '';
    root.innerHTML = '<div class="box"><div class="hd"><span>Test du site</span></div><h4>Merci de nous aider ! 🙏</h4>'
      + '<p>On teste le site, pas vous : il n’y a ni bonne ni mauvaise réponse. Si quelque chose vous semble confus, c’est une information précieuse. Faites comme si vous étiez seul(e) : vous allez parcourir le site, de l’accueil jusqu’à la commande.</p>'
      + '<p>Vos touchers et vos réponses sont enregistrés de façon anonyme. <b>Rien n’est réellement envoyé ni payé</b> pendant ce test (durée : environ 10 minutes).</p>'
      + '<input type="text" id="mo-nm" maxlength="40" placeholder="Votre prénom ou pseudo (facultatif)" aria-label="Votre prénom ou pseudo">'
      + '<div class="row"><button class="b p" type="button" data-a="start">Commencer</button></div><p style="text-align:center;margin:.8rem 0 0"><button type="button" data-a="quit" style="background:none;border:0;color:#9aa1bd;text-decoration:underline;font:inherit;font-size:.75rem;cursor:pointer">Quitter le test</button></p></div>';
    document.body.style.paddingBottom = '';
    pad();
    window.__moDev = dev;
  }

  // ---- actions ----
  root.addEventListener('click', function(e){
    var el = e.target.closest('[data-a]'); if(!el) return;
    var a = el.getAttribute('data-a'), v = el.getAttribute('data-v'), m = M[st.i];
    if(a === 'quit'){ if(!confirm('Quitter le test ? Vos réponses déjà données sont conservées.')) return; try{ localStorage.removeItem(KEY); }catch(_){} location.href = location.pathname; return; }
    if(a === 'start'){
      var nm = (document.getElementById('mo-nm') || {}).value || '';
      track('test_start', { name:nm.slice(0, 40), dev:window.__moDev, w:innerWidth, h:innerHeight, ua:navigator.userAgent.slice(0, 120) });
      st.i = 0; save(); startMission(); return;
    }
    if(a === 'min'){ min = true; render(); return; }
    if(a === 'max'){ min = false; render(); return; }
    if(a === 'act'){ var f = window[m.action.fn]; if(typeof f === 'function'){ f(); min = true; render(); } else { alert('Cette action n’est disponible que sur la page de commande.'); } return; }
    if(a === 'done'){ finishTask('manual'); return; }
    if(a === 'giveup'){ cur = { done:true, k:'giveup', ms:Date.now() - (st.mt || Date.now()) }; send({ k:'giveup' }); next(); return; }
    if(a === 'rate'){ var k = cur ? cur.k : 'manual'; send({ k:k, r:Number(v) }); next(); return; }
    if(a === 'pick'){ cur = cur || {}; cur.pick = Number(v); render(); return; }
    if(a === 'ok'){
      if(m.type === 'choice'){ if(!cur || cur.pick == null) return; var ans = m.opts[cur.pick]; send({ k:'answer', a:ans, c:m.correct ? (ans === m.correct ? 1 : 0) : null }); next(); }
      else { var t = (document.getElementById('mo-ta') || {}).value || ''; send({ k:'answer', a:t.trim().slice(0, 600) }); next(); }
      return;
    }
    if(a === 'skip'){ send({ k:'skip' }); next(); return; }
    if(a === 'scale'){ send({ k:'answer', a:Number(v) }); next(); return; }
  });

  // reprise après changement de page : on rejoue les événements déjà émis par cette page (dont la vue de page)
  if(st.i < 0){ render(); }
  else if(st.i >= N){ endTest(); }
  else {
    min = false; cur = null;
    (window.__moBuf || []).forEach(tally);
    render();
    if(target() && (st.cnt || 0) >= target()) finishTask('auto');
  }
})();
