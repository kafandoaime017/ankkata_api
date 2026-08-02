'use strict';
const { NIVEAU_ADMIN } = require('../constants/roles');
const { dropEnumTypes } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('comptes_admin', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      code: { type: Sequelize.STRING, allowNull: false, unique: true },
      company_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      nom: { type: Sequelize.STRING, allowNull: false },
      identifiant: { type: Sequelize.STRING, allowNull: false },
      mot_de_passe_hash: { type: Sequelize.STRING, allowNull: false },
      niveau: {
        type: Sequelize.ENUM(...Object.values(NIVEAU_ADMIN)),
        allowNull: false,
        defaultValue: NIVEAU_ADMIN.ADMINISTRATEUR,
      },
      actif: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('comptes_admin', ['company_id', 'identifiant'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('comptes_admin');
    await dropEnumTypes(queryInterface, 'comptes_admin', ['niveau']);
  },
};
