/* ===== À COMPLÉTER UNE SEULE FOIS : ces informations s'affichent dans toutes les pages légales ===== */
window.LEGAL = {
  nom: '',            // Prénom NOM de l'entrepreneur(e)
  statut: 'Entrepreneur individuel (micro-entreprise)',
  siret: '853 187 508 00025',          // numéro SIRET (14 chiffres)
  adresse: '',        // adresse professionnelle
  email: 'contact@maisonopaline-invitations.fr',   // adresse e-mail de contact
  telephone: '',      // facultatif
  tva: 'TVA non applicable, article 293 B du CGI',   // à confirmer selon ton régime
  mediateur: '',      // nom et coordonnées du médiateur de la consommation
  maj: 'novembre 2026'
};
document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('[data-l]').forEach(function(el){
    var k = el.getAttribute('data-l'), v = (window.LEGAL[k] || '').trim();
    if(v){ el.textContent = v; } else { el.textContent = '[À compléter : ' + k + ']'; el.className = 'todo'; }
  });
});
