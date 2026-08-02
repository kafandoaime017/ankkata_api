'use strict';
const { ROLE_ANKKATA } = require('../constants/roles');
const { dropEnumTypes } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('comptes_ankkata', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      code: { type: Sequelize.STRING, allowNull: false, unique: true },
      nom: { type: Sequelize.STRING, allowNull: false },
      identifiant: { type: Sequelize.STRING, allowNull: false, unique: true },
      mot_de_passe_hash: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.ENUM(...Object.values(ROLE_ANKKATA)), allowNull: false },
      actif: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      photo_initiales: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('comptes_ankkata');
    await dropEnumTypes(queryInterface, 'comptes_ankkata', ['role']);
  },
};
