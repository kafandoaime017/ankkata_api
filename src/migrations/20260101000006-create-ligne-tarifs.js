'use strict';
const { CLASSE_CONFORT } = require('../constants/enums');
const { dropEnumTypes } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ligne_tarifs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      ligne_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'lignes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      classe: { type: Sequelize.ENUM(...CLASSE_CONFORT), allowNull: false },
      prix: { type: Sequelize.INTEGER, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('ligne_tarifs', ['ligne_id', 'classe'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ligne_tarifs');
    await dropEnumTypes(queryInterface, 'ligne_tarifs', ['classe']);
  },
};
