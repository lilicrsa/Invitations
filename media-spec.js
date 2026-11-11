/* Règles d'envoi des photos et vidéos, par modèle. Une seule source : la page de commande et la page de dépôt Prestige
   s'en servent pour afficher les consignes et vérifier chaque fichier (le serveur refera la même vérification).
   Valeurs de travail à valider : elles dépendent de ce que chaque modèle sait réellement afficher. */
(function(){
  var PHOTO = { types:['image/jpeg','image/png','image/webp'], ext:'JPG, PNG ou WebP', maxMB:10, minSide:1200 };
  var CLIP = { types:['video/mp4','video/quicktime'], ext:'MP4 ou MOV', maxMB:15, maxSec:4, orientation:'portrait' };
  var VIDEO = { types:['video/mp4','video/quicktime'], ext:'MP4 ou MOV', maxMB:100, maxSec:30, orientation:'portrait' };
  window.MEDIA_SPEC = {
    // modèles standard : une photo facultative sur la carte
    boheme:        { prestige:false, slots:[ { id:'card_photo', kind:'photo', min:0, max:1, label:'Photo de la carte', rule:PHOTO } ] },
    'gender-reveal':{ prestige:false, slots:[ { id:'card_photo', kind:'photo', min:0, max:1, label:'Photo de la carte', rule:PHOTO } ] },
    jeux:          { prestige:false, slots:[ { id:'card_photo', kind:'photo', min:0, max:1, label:'Photo de la carte', rule:PHOTO } ] },
    noel:          { prestige:false, slots:[ { id:'card_photo', kind:'photo', min:0, max:1, label:'Photo de la carte', rule:PHOTO } ] },
    // Prestige : la galerie dorée. Le nombre de cadres de la vidéo d'entrée fixe le nombre de photos.
    galerie:       { prestige:true, slots:[
      { id:'frames',     kind:'media', min:4, max:6, label:'Cadres de la galerie : photos ou mini-vidéos', rule:PHOTO, clip:CLIP, note:'Chaque cadre accueille une photo ou une mini-vidéo de 3 à 4 secondes, qui tourne en boucle pour animer la galerie.' },
      { id:'card_photo', kind:'photo', min:1, max:1, label:'Photo de la carte', rule:PHOTO } ] }
  };
  // Lit les emplacements déclarés par le modèle lui-même (<modèle>/slots.json) : le nombre de cadres vient du modèle,
  // le client ne se voit proposer que ce nombre. Si le fichier est introuvable, on garde les valeurs ci-dessus.
  window.loadMediaSpec = function(theme){
    var base = window.MEDIA_SPEC[theme];
    if(!base || !base.prestige) return Promise.resolve(base || null);
    return fetch(theme + '/slots.json', { cache:'no-cache' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
      if(!j || !j.frames) return base;
      var fr = base.slots.filter(function(x){ return x.id === 'frames'; })[0], rest = base.slots.filter(function(x){ return x.id !== 'frames' && (x.id !== 'card_photo' || j.cardPhoto !== false); });
      var f = Object.assign({}, fr, { max:j.frames, min:Math.min(j.minFrames || j.frames, j.frames) });
      var out = { prestige:true, slots:[f].concat(rest) }; window.MEDIA_SPEC[theme] = out; return out;
    }).catch(function(){ return base; });
  };
  // Vérifie un fichier pour un emplacement ; renvoie un message d'erreur en français, ou '' si le fichier convient.
  window.checkMedia = function(file, slot){
    var r = (slot.kind === 'media' && /^video\//.test(file.type)) ? slot.clip : slot.rule;
    if(r.types.indexOf(file.type) < 0) return 'Format non accepté (' + r.ext + ' uniquement).';
    if(file.size > r.maxMB * 1048576) return 'Fichier trop lourd (' + r.maxMB + ' Mo maximum).';
    return '';
  };
})();
