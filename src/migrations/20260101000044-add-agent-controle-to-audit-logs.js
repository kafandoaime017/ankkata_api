'use strict';

// Complète le journal d'audit unifié pour le nouvel espace 'controle' — voir
// services/audit.service.js et models/auditLog.model.js. Un seul des 4
// champs `auteur_xxx_id` est renseigné à la fois.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('audit_logs', 'auteur_agent_controle_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'agents_controle', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('audit_logs', 'auteur_agent_controle_id');
  },
};
