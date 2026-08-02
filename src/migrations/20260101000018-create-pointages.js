'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pointages', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      code: { type: Sequelize.STRING, allowNull: false, unique: true },
      company_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      guichetier_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'guichetiers', key: 'id' },
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
      cash_session_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'cash_sessions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      heure_connexion: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      heure_deconnexion: { type: Sequelize.DATE, allowNull: true },
      rapport_envoye: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      ecart_caisse: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      rapport: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('pointages', ['company_id']);
    await queryInterface.addIndex('pointages', ['guichetier_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('pointages');
  },
};
