'use strict';
const { TYPE_MOUVEMENT_CAISSE } = require('../constants/enums');
const { dropEnumTypes } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cash_movements', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      cash_session_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'cash_sessions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      reference: { type: Sequelize.STRING, allowNull: false },
      date: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      type: { type: Sequelize.ENUM(...TYPE_MOUVEMENT_CAISSE), allowNull: false },
      motif: { type: Sequelize.STRING, allowNull: false },
      montant: { type: Sequelize.INTEGER, allowNull: false },
      guichetier_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'guichetiers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('cash_movements', ['cash_session_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('cash_movements');
    await dropEnumTypes(queryInterface, 'cash_movements', ['type']);
  },
};
