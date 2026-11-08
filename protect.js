/* Protection légère des médias : pas de menu « enregistrer / télécharger » (appui long, clic droit), pas de glisser-déposer.
   Limite connue : un navigateur ne peut pas empêcher un utilisateur averti de récupérer un fichier affiché. */
(function(){
  'use strict';
  var st = document.createElement('style');
  st.textContent = 'img,video,canvas{pointer-events:none!important;-webkit-touch-callout:none!important;-webkit-user-select:none!important;user-select:none!important;-webkit-user-drag:none!important}';
  (document.head || document.documentElement).appendChild(st);
  function lock(root){
    try{
      (root || document).querySelectorAll('video,audio').forEach(function(m){
        m.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback'); m.setAttribute('disablePictureInPicture', ''); m.disableRemotePlayback = true; });
      (root || document).querySelectorAll('img').forEach(function(i){ i.setAttribute('draggable', 'false'); });
    }catch(_){}
  }
  function ok(e){ var t = e.target; return t && t.closest && t.closest('input,textarea,[contenteditable="true"]'); }
  ['contextmenu', 'dragstart'].forEach(function(ev){ document.addEventListener(ev, function(e){ if(!ok(e)) e.preventDefault(); }, true); });
  // filigrane discret sur les invitations de démonstration (jamais sur les vraies invitations)
  try{
    var slug = new URLSearchParams(location.search).get('i') || '';
    if((slug === '' || /-demo$/.test(slug)) && /\/(boheme|noel|jeux|galerie|gender-reveal)\//.test(location.pathname) && !new URLSearchParams(location.search).get('preview')){
      var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='150'><g transform='rotate(-24 150 75)'><text x='150' y='80' text-anchor='middle' font-family='system-ui,sans-serif' font-size='17' font-weight='800' letter-spacing='2' fill='rgba(0,0,0,0.22)' transform='translate(1.5 1.5)'>MAISON OPALINE</text><text x='150' y='80' text-anchor='middle' font-family='system-ui,sans-serif' font-size='17' font-weight='800' letter-spacing='2' fill='rgba(255,255,255,0.34)'>MAISON OPALINE</text></g></svg>";
      var w = document.createElement('div');
      w.style.cssText = 'position:fixed;inset:0;z-index:2147482000;pointer-events:none;background-image:url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
      document.addEventListener('DOMContentLoaded', function(){ document.body.appendChild(w); });
      setInterval(function(){ if(!w.isConnected && document.body) document.body.appendChild(w); }, 1500);
    }
  }catch(_){}
  document.addEventListener('DOMContentLoaded', function(){
    lock();
    new MutationObserver(function(){ lock(); }).observe(document.documentElement, { childList:true, subtree:true });
  });
})();
