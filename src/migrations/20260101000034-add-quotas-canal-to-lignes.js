'use strict';

// Répartition de la capacité d'une ligne par canal de vente, + délai de
// fermeture des réservations en ligne avant le départ.
//
// Jusqu'ici `capacite_totale` était un plafond UNIQUE partagé par tous les
// canaux (voir migration `add-capacite-totale-to-lignes` et
// `services/quota.service.js`) : n'importe quelle combinaison de ventes
// guichet + réservations en ligne pouvait remplir tout le bus, sans qu'une
// compagnie puisse réserver un sous-quota de places à la vente en ligne
// (ex. garder des places au guichet pour les clients qui se présentent
// physiquement, même si le site affiche complet).
//
// - `quota_en_ligne` : plafond de places réservables EN LIGNE spécifiquement
//   (NULL = pas de sous-quota, la réservation en ligne reste seulement
//   bornée par `capacite_totale` comme avant ce correctif — rétrocompatible
//   avec toutes les lignes existantes).
// - `quota_guichet` : plafond de places vendables AU GUICHET spécifiquement
//   (même sémantique NULL = pas de sous-quota).
// - `delai_limite_reservation_en_ligne_minutes` : nombre de minutes avant le
//   départ à partir duquel la réservation en ligne se ferme (le trajet
//   disparaît alors de la recherche voyageur, voir
//   `public.controller.js#reservationEnLigneFermee`) — NULL = pas de délai,
//   réservable en ligne jusqu'au départ (comportement actuel inchangé).
//
// Dans tous les cas, `capacite_totale` reste le plafond global absolu :
// même si `quota_en_ligne` + `quota_guichet` dépasse `capacite_totale`, la
// somme réelle des ventes/réservations confirmées ne pourra jamais le
// dépasser (`quota.service.js` vérifie toujours les deux bornes).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lignes', 'quota_en_ligne', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('lignes', 'quota_guichet', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('lignes', 'delai_limite_reservation_en_ligne_minutes', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('lignes', 'quota_en_ligne');
    await queryInterface.removeColumn('lignes', 'quota_guichet');
    await queryInterface.removeColumn('lignes', 'delai_limite_reservation_en_ligne_minutes');
  },
};
