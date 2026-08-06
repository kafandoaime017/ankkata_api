'use strict';

// Réservation groupée en une seule opération publique (1 à 6 passagers, voir
// `public.controller.js#createReservationGroupe`) — même esprit que
// `reservation_liee_id` (aller-retour, migration
// `add-type-billet-to-reservations`) : on NE modélise PAS de nouvelle entité
// "panier"/"groupe", chaque passager reste une `Reservation` à part entière
// (son propre `nomVoyageur`, sa propre `reference`, son propre billet PDF/QR),
// mais les N réservations posées ensemble partagent la même
// `groupe_reference` — ce qui permet de les retrouver et de les afficher
// ensemble sur une seule page de confirmation, sans toucher au quota par
// trajet déjà en place (chaque passager continue de compter pour 1 place).
//
// NULL pour une réservation solo (`createReservation`) ou une jambe
// aller-retour (`createReservationAllerRetour`) posée seule — seule
// `createReservationGroupe` renseigne ce champ, y compris pour un groupe de 1
// passager, afin que le frontend n'ait qu'un seul chemin de code (toujours
// "liste des billets d'un groupe") pour afficher la confirmation.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reservations', 'groupe_reference', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addIndex('reservations', ['groupe_reference'], {
      name: 'reservations_groupe_reference_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('reservations', 'reservations_groupe_reference_idx');
    await queryInterface.removeColumn('reservations', 'groupe_reference');
  },
};
