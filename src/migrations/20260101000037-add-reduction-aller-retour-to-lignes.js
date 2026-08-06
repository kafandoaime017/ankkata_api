'use strict';

// Réduction optionnelle appliquée au prix TOTAL d'un billet aller-retour posé
// en une seule réservation publique (voir `public.controller.js
// #createReservationAllerRetour`) quand les deux trajets choisis appartiennent
// à une paire de lignes réversibles explicitement liées (`ligneRetourId`, voir
// migration `add-ligne-retour-id-to-lignes`). NULL ou 0 = aucune réduction,
// le prix reste la simple somme des deux tarifs (comportement historique,
// identique à ce que fait déjà `vente.controller.js#createAllerRetour` côté
// guichet, qui n'a lui-même aucune réduction).
//
// Rattachée à la Ligne (pas à la paire elle-même, qui n'a pas d'entité
// dédiée) car la relation `ligneRetourId` est symétrique : peu importe quelle
// ligne de la paire porte la valeur, `public.controller.js` lit le
// pourcentage sur LA LIGNE DE L'ALLER choisi par le voyageur.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lignes', 'reduction_aller_retour_pourcentage', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('lignes', 'reduction_aller_retour_pourcentage');
  },
};
