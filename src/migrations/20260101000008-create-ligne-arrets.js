'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ligne_arrets', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      ligne_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'lignes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      ville: { type: Sequelize.STRING, allowNull: false },
      ordre: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('ligne_arrets', ['ligne_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ligne_arrets');
  },
};
