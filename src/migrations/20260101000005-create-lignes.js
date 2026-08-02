'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lignes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      code: { type: Sequelize.STRING, allowNull: false, unique: true },
      company_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
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
      ville_arrivee: { type: Sequelize.STRING, allowNull: false },
      bus_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'buses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      reversible: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      duree_estimee_minutes: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('lignes', ['company_id']);
    await queryInterface.addIndex('lignes', ['agence_depart_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lignes');
  },
};
