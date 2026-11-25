/* Démos sur ordinateur : l'invitation s'ouvre dans une fenêtre au format téléphone, au lieu d'un nouvel onglet.
   Sur téléphone ou petit écran, le lien garde son comportement habituel (nouvel onglet). */
(function(){
  var mq = window.matchMedia('(hover:hover) and (min-width:820px) and (min-height:560px)');
  var box = null, prevFocus = null;
  function close(){
    if(!box) return; var b = box; box = null; document.documentElement.style.overflow = '';
    b.style.opacity = '0'; setTimeout(function(){ if(b.parentNode) b.parentNode.removeChild(b); }, 220);
    document.removeEventListener('keydown', onKey, true);
    try{ prevFocus && prevFocus.focus(); }catch(_){}
  }
  function onKey(e){ if(e.key === 'Escape'){ e.preventDefault(); close(); } }
  function open(url){
    if(box) close();
    prevFocus = document.activeElement;
    var h = 'min(92vh, 940px)';
    box = document.createElement('div'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Démonstration de l’invitation');
    box.style.cssText = 'position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;background:rgba(5,7,16,.82);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);opacity:0;transition:opacity .25s ease';
    var frame = document.createElement('div');
    frame.style.cssText = 'position:relative;height:' + h + ';aspect-ratio:9/16;max-width:94vw;border-radius:30px;overflow:hidden;background:#000;box-shadow:0 0 0 1px rgba(230,213,171,.55),0 0 0 8px rgba(14,18,38,.9),0 0 0 9px rgba(230,213,171,.35),0 30px 80px rgba(0,0,0,.7)';
    var f = document.createElement('iframe'); f.src = url + (url.indexOf('?') > -1 ? '&' : '?') + 'popup=1&_=' + Date.now(); f.title = 'Démonstration'; f.setAttribute('allow', 'autoplay; fullscreen');
    f.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#000';
    frame.appendChild(f);
    var x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Fermer la démonstration'); x.textContent = '✕';
    x.style.cssText = 'position:absolute;top:18px;right:22px;width:44px;height:44px;border-radius:50%;border:1px solid rgba(230,213,171,.6);background:rgba(10,14,29,.85);color:#E6D5AB;font:500 18px/1 system-ui,sans-serif;cursor:pointer';
    x.addEventListener('click', close);
    box.appendChild(frame); box.appendChild(x);
    box.addEventListener('click', function(e){ if(e.target === box) close(); });
    document.body.appendChild(box); document.documentElement.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey, true);
    requestAnimationFrame(function(){ box.style.opacity = '1'; });
    x.focus();
  }
  document.addEventListener('click', function(e){
    if(e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || !mq.matches) return;
    var a = e.target.closest && e.target.closest('a[href]'); if(!a) return;
    var href = a.getAttribute('href') || '';
    if(!/(^|\/)(boheme|palais|ornoir|funone|noel|jeux|galerie|gender-reveal)\/\?i=[a-z-]+-demo/.test(href)) return;
    e.preventDefault(); open(a.href);
  });
  window.addEventListener('message', function(e){ if(e.origin === location.origin && e.data && e.data.moDemo === 'close') close(); });
})();
