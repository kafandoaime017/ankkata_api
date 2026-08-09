'use strict';

// Clôture de l'embarquement (app agent de contrôle) — voir
// models/trip.model.js et embarquement.controller.js#cloturer. NULL =
// jamais clôturé.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('trips', 'embarquement_cloture_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('trips', 'embarquement_cloture_par', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'agents_controle', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('trips', 'embarquement_cloture_par');
    await queryInterface.removeColumn('trips', 'embarquement_cloture_at');
  },
};
