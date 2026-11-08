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
  document.addEventListener('DOMContentLoaded', function(){
    lock();
    new MutationObserver(function(){ lock(); }).observe(document.documentElement, { childList:true, subtree:true });
  });
})();
