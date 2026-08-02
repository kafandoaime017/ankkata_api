'use strict';
const { STATUT_TRIP } = require('../constants/enums');
const { dropEnumTypes } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('trips', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      company_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      ligne_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'lignes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      agence_depart_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'agences', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      bus_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'buses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      heure_depart: { type: Sequelize.STRING(5), allowNull: false },
      chauffeur: { type: Sequelize.STRING, allowNull: true },
      statut: { type: Sequelize.ENUM(...STATUT_TRIP), allowNull: false, defaultValue: 'prevu' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('trips', ['ligne_id', 'date', 'heure_depart'], { unique: true });
    await queryInterface.addIndex('trips', ['company_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('trips');
    await dropEnumTypes(queryInterface, 'trips', ['statut']);
  },
};
