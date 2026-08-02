'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ligne_horaires', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      ligne_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'lignes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      heure: { type: Sequelize.STRING(5), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('ligne_horaires', ['ligne_id', 'heure'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ligne_horaires');
  },
};
