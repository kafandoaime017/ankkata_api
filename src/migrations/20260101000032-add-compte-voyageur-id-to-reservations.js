'use strict';

// Rattachement OPTIONNEL d'une réservation à un compte voyageur connecté
// (site public) — reste `null` pour toute réservation posée par un
// voyageur non connecté (guest checkout, toujours possible) ou au guichet.
// Permet à "Mes trajets" (espace compte voyageur) de lister directement les
// réservations sans dépendre du couple référence+téléphone.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reservations', 'compte_voyageur_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'comptes_voyageurs', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('reservations', ['compte_voyageur_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('reservations', 'compte_voyageur_id');
  },
};
