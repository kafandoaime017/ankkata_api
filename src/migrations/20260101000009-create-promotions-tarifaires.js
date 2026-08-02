'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('promotions_tarifaires', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      ligne_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'lignes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      libelle: { type: Sequelize.STRING, allowNull: false },
      date_debut: { type: Sequelize.DATEONLY, allowNull: false },
      date_fin: { type: Sequelize.DATEONLY, allowNull: false },
      reduction_pourcentage: { type: Sequelize.INTEGER, allowNull: false },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('promotions_tarifaires', ['ligne_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('promotions_tarifaires');
  },
};
