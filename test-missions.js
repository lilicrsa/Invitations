/* Parcours du test utilisateur (mode test : ouvrir le site avec ?test=1).
   Utilisé par le panneau de test (testeur.js) et par l'onglet « Tests » de l'admin.
   type : task (action à réaliser, détectée automatiquement) · choice (choix) · text (texte libre) · scale (note)
   auto : { ev, w:{clé:valeur ou [valeurs]}, n } → la mission est réussie quand cet événement est vu n fois */
window.MO_MISSIONS = [
  /* ---- Première impression et découverte ---- */
  { id:'t01', ph:'Accueil', type:'text', q:'Sans faire défiler la page : que propose ce site, selon vous ?', hint:'Répondez avec vos mots, c’est votre première impression qui compte.' },
  { id:'t02', ph:'Accueil', type:'choice', q:'À votre avis, combien de modèles d’invitation propose-t-on pour un mariage ?', opts:['Un seul','Deux','Entre 3 et 5','Plus de 5','Je ne sais pas'] },
  { id:'t03', ph:'Découverte', type:'task', q:'Entrez dans l’univers « Mariage ».', auto:{ ev:'univers_open', w:{ univers:'mariage' } }, rate:true },
  { id:'t04', ph:'Découverte', type:'choice', q:'Combien de modèles voyez-vous dans cet univers ?', opts:['Un','Deux','Trois ou plus','Je ne sais pas'] },
  { id:'t05', ph:'Découverte', type:'task', q:'Lancez l’aperçu animé d’un modèle.', auto:{ ev:'video_play' }, rate:true },
  { id:'t06', ph:'Découverte', type:'task', q:'Mettez deux modèles en favoris (le cœur sur la vidéo).', auto:{ ev:'fav_add', n:2 }, rate:true },
  { id:'t07', ph:'Découverte', type:'task', q:'Retrouvez la liste de vos favoris.', auto:{ ev:'fav_panel' }, rate:true },
  { id:'t08', ph:'Découverte', type:'task', q:'Ouvrez la démo d’un modèle (elle s’ouvre dans un nouvel onglet : revenez ensuite sur cet onglet).', auto:{ ev:'demo_open' } },
  /* ---- Tarifs ---- */
  { id:'t09', ph:'Tarifs', type:'choice', q:'Vous voulez que vos invités puissent répondre à l’invitation. Quelle formule choisissez-vous ?', opts:['Essentiel','Signature','Prestige','Je ne sais pas'], correct:'Signature', hint:'Cherchez l’information sur le site avant de répondre.' },
  { id:'t10', ph:'Tarifs', type:'text', q:'Dans vos mots, quelle est la différence entre Signature et Prestige ?' },
  /* ---- Commande de A à Z ---- */
  { id:'t11', ph:'Commande', type:'task', q:'Vous avez choisi : lancez la personnalisation de votre invitation avec le bouton « Personnaliser mon invitation » en haut de la page.', auto:{ ev:'pageview', w:{ page:'commande' } }, rate:true },
  { id:'t12', ph:'Commande', type:'task', q:'Choisissez le modèle de votre invitation.', auto:{ ev:'step', w:{ n:2 } }, rate:true },
  { id:'t13', ph:'Commande', type:'task', q:'Remplissez vos informations (inventez-les) jusqu’à ouvrir l’aperçu de votre invitation.', auto:{ ev:'step', w:{ n:3 } }, rate:true },
  { id:'t14', ph:'Commande', type:'scale', q:'L’aperçu vous donne-t-il envie de commander ?', min:1, max:5, lo:'Pas du tout', hi:'Beaucoup' },
  { id:'t15', ph:'Commande', type:'choice', q:'Le filigrane « Maison Opaline » sur l’aperçu : comprenez-vous pourquoi il est là ?', opts:['Oui, c’est clair','Non, je ne sais pas pourquoi','Oui, mais il me gêne'] },
  { id:'t16', ph:'Commande', type:'task', q:'Passez à l’étape de commande.', auto:{ ev:'step', w:{ n:4 } }, rate:true },
  { id:'t17', ph:'Commande', type:'task', q:'Choisissez la formule qui vous convient.', auto:{ ev:'formula_pick' }, rate:true },
  { id:'t18', ph:'Commande', type:'choice', q:'Avant de cliquer sur « Envoyer ma demande » : que va-t-il se passer, selon vous ?', opts:['Je paie tout de suite et je reçois mon lien','Ma demande est examinée, puis je reçois un lien de paiement','Mon invitation est publiée sans paiement','Je ne sais pas'], correct:'Je paie tout de suite et je reçois mon lien' },
  { id:'t19', ph:'Commande', type:'task', q:'Indiquez un e-mail fictif, cochez les conditions et envoyez votre demande. (Mode test : rien n’est réellement envoyé.)', auto:{ ev:'request_sim' }, rate:true },
  { id:'t20', ph:'Commande', type:'text', q:'Que pensez-vous qu’il se passe maintenant, et en combien de temps ?' },
  { id:'t21', ph:'Paiement', type:'task', q:'Imaginez que votre demande est validée et que vous recevez l’e-mail. Touchez le bouton ci-dessous pour voir la page de paiement, puis réglez (simulation, aucun paiement réel).', action:{ label:'Voir la page de paiement', fn:'moTestShowValidated' }, auto:{ ev:'pay_sim' }, rate:true },
  /* ---- Aide et conclusion ---- */
  { id:'t22', ph:'Aide', type:'task', q:'Vous avez une question avant de commander. Où iriez-vous la poser ?', auto:{ ev:'pageview', w:{ page:['contact','devis'] } }, rate:true },
  { id:'t23', ph:'Bilan', type:'scale', q:'Recommanderiez-vous Maison Opaline à un proche ?', min:0, max:10, lo:'Pas du tout', hi:'Absolument' },
  { id:'t24', ph:'Bilan', type:'text', q:'Qu’est-ce qui vous a le plus gêné ou surpris pendant ce test ?' },
  { id:'t25', ph:'Bilan', type:'text', q:'Qu’est-ce que vous avez préféré ?' }
];
