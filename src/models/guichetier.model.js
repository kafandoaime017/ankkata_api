// Compte guichetier (agent de comptoir), rattaché à une agence précise —
// fusionne GuichetierCompagnie (ankkata_admin) et CompteGuichetier
// (ankata_guichet).
const { ROLE_GUICHETIER } = require('../constants/roles');

module.exports = (sequelize, DataTypes) => {
  const Guichetier = sequelize.define(
    'Guichetier',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      code: { type: DataTypes.STRING, allowNull: false, unique: true },
      companyId: { type: DataTypes.UUID, allowNull: false },
      agenceId: { type: DataTypes.UUID, allowNull: false },
      nom: { type: DataTypes.STRING, allowNull: false },
      identifiant: { type: DataTypes.STRING, allowNull: false },
      role: {
        type: DataTypes.ENUM(...Object.values(ROLE_GUICHETIER)),
        allowNull: false,
        defaultValue: ROLE_GUICHETIER.GUICHETIER,
      },
      actif: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      codePinHash: { type: DataTypes.STRING, allowNull: true },
    },
    {
      tableName: 'guichetiers',
      indexes: [{ unique: true, fields: ['company_id', 'identifiant'] }],
    }
  );

  Guichetier.associate = (models) => {
    Guichetier.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    Guichetier.belongsTo(models.Agence, { foreignKey: 'agenceId', as: 'agence' });
    Guichetier.hasMany(models.Vente, { foreignKey: 'guichetierId', as: 'ventes' });
    Guichetier.hasMany(models.CashSession, { foreignKey: 'guichetierId', as: 'cashSessions' });
    Guichetier.hasMany(models.CashMovement, { foreignKey: 'guichetierId', as: 'cashMovements' });
    Guichetier.hasMany(models.Pointage, { foreignKey: 'guichetierId', as: 'pointages' });
    Guichetier.hasMany(models.AuditLog, { foreignKey: 'auteurGuichetierId', as: 'auditLogs' });
  };

  return Guichetier;
};
