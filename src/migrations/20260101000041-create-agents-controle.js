'use strict';

// Compte "agent de contrôle" (app mobile de scan/embarquement) — même forme
// que `guichetiers` (identifiant + PIN haché, rattaché à une agence), mais
// une table À PART : voir constants/roles.js#ESPACES.CONTROLE pour le
// raisonnement (cloisonnement complet vis-à-vis de vente/caisse).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('agents_controle', {
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
      actif: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      code_pin_hash: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('agents_controle', ['company_id', 'identifiant'], { unique: true });
    await queryInterface.addIndex('agents_controle', ['agence_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('agents_controle');
  },
};
