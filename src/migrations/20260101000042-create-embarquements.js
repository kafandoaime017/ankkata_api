'use strict';
const { TYPE_TICKET_EMBARQUEMENT, SOURCE_EMBARQUEMENT, STATUT_EMBARQUEMENT } = require('../constants/enums');
const { dropEnumTypes } = require('../utils/migrationHelpers');

// Journal (append-only) de chaque tentative de contrôle à l'embarquement —
// voir models/embarquement.model.js pour le détail des champs.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('embarquements', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      company_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      trip_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'trips', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      agent_controle_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'agents_controle', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      id_local: { type: Sequelize.UUID, allowNull: false },
      ticket_type: { type: Sequelize.ENUM(...TYPE_TICKET_EMBARQUEMENT), allowNull: false },
      ticket_id: { type: Sequelize.UUID, allowNull: true },
      reference: { type: Sequelize.STRING, allowNull: false },
      groupe_reference: { type: Sequelize.STRING, allowNull: true },
      statut: { type: Sequelize.ENUM(...STATUT_EMBARQUEMENT), allowNull: false },
      source: { type: Sequelize.ENUM(...SOURCE_EMBARQUEMENT), allowNull: false, defaultValue: 'scan' },
      scanne_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('embarquements', ['trip_id', 'id_local'], { unique: true });
    await queryInterface.addIndex('embarquements', ['trip_id', 'reference']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('embarquements');
    await dropEnumTypes(queryInterface, 'embarquements', ['ticket_type', 'source', 'statut']);
  },
};
