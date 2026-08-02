'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('agences', {
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
      ville: { type: Sequelize.STRING, allowNull: false },
      responsable: { type: Sequelize.STRING, allowNull: false, defaultValue: '' },
      telephone: { type: Sequelize.STRING, allowNull: false, defaultValue: '' },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      latitude: { type: Sequelize.DECIMAL(9, 6), allowNull: true },
      longitude: { type: Sequelize.DECIMAL(9, 6), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('agences', ['company_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('agences');
  },
};
