'use strict';
const { ETAT_BUS } = require('../constants/enums');
const { dropEnumTypes } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('buses', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      code: { type: Sequelize.STRING, allowNull: false, unique: true },
      company_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      agence_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'agences', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      immatriculation: { type: Sequelize.STRING, allowNull: false },
      marque_modele: { type: Sequelize.STRING, allowNull: false },
      capacite_standard: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      capacite_vip: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      etat: { type: Sequelize.ENUM(...ETAT_BUS), allowNull: false, defaultValue: 'en_service' },
      date_mise_en_service: { type: Sequelize.DATEONLY, allowNull: false },
      prochain_entretien: { type: Sequelize.DATEONLY, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('buses', ['company_id']);
    await queryInterface.addIndex('buses', ['agence_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('buses');
    await dropEnumTypes(queryInterface, 'buses', ['etat']);
  },
};
