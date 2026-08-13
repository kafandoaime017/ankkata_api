'use strict';

// Prix unitaire AVANT réduction aller-retour (voir `Ligne.reductionAllerRetourPourcentage`
// et `vente.controller.js#createAllerRetour`) — NULL tant qu'aucune réduction
// n'a été appliquée à cette jambe (aller simple, ou aller-retour sur une paire
// de lignes sans réduction configurée). Renseigné uniquement quand la vente
// est une jambe d'un billet aller-retour dont la ligne appartient à une paire
// réversible avec un pourcentage de réduction actif : permet d'afficher sur
// le reçu/billet à la fois le tarif normal barré et le prix réellement payé,
// au lieu de ne garder que le prix net (`prixUnitaire`) sans trace de la
// réduction appliquée. Même raisonnement que `montantAvantReduction` côté
// `Reservation` (réservation publique aller-retour, voir
// `public.controller.js#createReservationAllerRetour`).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ventes', 'prix_unitaire_avant_reduction', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ventes', 'prix_unitaire_avant_reduction');
  },
};
