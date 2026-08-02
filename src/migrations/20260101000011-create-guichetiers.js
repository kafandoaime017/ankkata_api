'use strict';
const { ROLE_GUICHETIER } = require('../constants/roles');
const { dropEnumTypes } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('guichetiers', {
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
      nom: { type: Sequelize.STRING, allowNull: false },
      identifiant: { type: Sequelize.STRING, allowNull: false },
      role: {
        type: Sequelize.ENUM(...Object.values(ROLE_GUICHETIER)),
        allowNull: false,
        defaultValue: ROLE_GUICHETIER.GUICHETIER,
      },
      actif: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      code_pin_hash: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('guichetiers', ['company_id', 'identifiant'], { unique: true });
    await queryInterface.addIndex('guichetiers', ['agence_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('guichetiers');
    await dropEnumTypes(queryInterface, 'guichetiers', ['role']);
  },
};
