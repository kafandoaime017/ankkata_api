// Journal d'audit unifié — fusionne AuditEntry (ankkata_admin) et
// AuditEntry (ankata_guichet). `companyId` nul = événement interne Ankkata
// (provisioning, gestion des comptes internes...). Un seul des 3 champs
// `auteurXxxId` est renseigné à la fois (voir services/audit.service.js).
module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define(
    'AuditLog',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      companyId: { type: DataTypes.UUID, allowNull: true },
      auteurAnkkataId: { type: DataTypes.UUID, allowNull: true },
      auteurAdminId: { type: DataTypes.UUID, allowNull: true },
      auteurGuichetierId: { type: DataTypes.UUID, allowNull: true },
      auteurAgentControleId: { type: DataTypes.UUID, allowNull: true },
      auteurNom: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Système' },
      action: { type: DataTypes.STRING, allowNull: false },
      details: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'audit_logs',
      updatedAt: false,
    }
  );

  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    AuditLog.belongsTo(models.CompteAnkkata, { foreignKey: 'auteurAnkkataId', as: 'auteurAnkkata' });
    AuditLog.belongsTo(models.CompteAdmin, { foreignKey: 'auteurAdminId', as: 'auteurAdmin' });
    AuditLog.belongsTo(models.Guichetier, { foreignKey: 'auteurGuichetierId', as: 'auteurGuichetier' });
    AuditLog.belongsTo(models.AgentControle, { foreignKey: 'auteurAgentControleId', as: 'auteurAgentControle' });
  };

  return AuditLog;
};
