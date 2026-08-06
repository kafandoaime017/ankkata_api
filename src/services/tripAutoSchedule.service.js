// SUPPRIMÉ — l'approche "job nightly qui régénère 3 jours glissants pour
// toutes les compagnies" a été remplacée par une génération en masse (~2
// mois) déclenchée une seule fois À LA CRÉATION de chaque ligne (voir
// `tripGeneration.service.js#genererTrajetsPourLigneSurPeriode`, appelée
// depuis `ligne.controller.js#create`). Au-delà de cette fenêtre initiale,
// l'extension reste volontairement MANUELLE (bouton "Générer pour cette
// date", voir `trip.controller.js#generateForDate`) — décision produit
// explicite : pas de tâche de fond qui continue à écrire silencieusement en
// base indéfiniment.
//
// Ce fichier ne doit plus être importé nulle part (voir `server.js`, qui ne
// le référence plus) — conservé uniquement pour laisser une trace du
// changement plutôt que de faire disparaître le fichier sans explication.
// Peut être supprimé du dépôt en toute sécurité.
module.exports = {};
