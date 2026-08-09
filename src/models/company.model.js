// Compagnie cliente (tenant) — table racine de tout le multi-tenant.
// Fusionne CompagnieClient (ankkata_admin) et CompagnieProfil + les champs
// de marque de AdminSession (ankata_guichet) en une seule table.
const { PLAN_ABONNEMENT, STATUT_COMPAGNIE } = require('../constants/enums');

module.exports = (sequelize, DataTypes) => {
  const Company = sequelize.define(
    'Company',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      code: { type: DataTypes.STRING, allowNull: false, unique: true },
      nom: { type: DataTypes.STRING, allowNull: false },
      cleActivation: { type: DataTypes.STRING, allowNull: false, unique: true },
      logoPath: { type: DataTypes.STRING, allowNull: true },
      couleurPrimaire: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0xff141b4d },
      couleurSecondaire: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0xff2748e0 },
      devise: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Franc CFA (XOF)' },
      fuseauHoraire: { type: DataTypes.STRING, allowNull: false, defaultValue: 'GMT (Afrique/Ouagadougou)' },
      ville: { type: DataTypes.STRING, allowNull: false },
      pays: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Burkina Faso' },
      responsableNom: { type: DataTypes.STRING, allowNull: false },
      responsableTelephone: { type: DataTypes.STRING, allowNull: false },
      responsableEmail: { type: DataTypes.STRING, allowNull: false },
      plan: { type: DataTypes.ENUM(...PLAN_ABONNEMENT), allowNull: false, defaultValue: 'essai' },
      statut: { type: DataTypes.ENUM(...STATUT_COMPAGNIE), allowNull: false, defaultValue: 'essai' },
      dateExpirationAbonnement: { type: DataTypes.DATEONLY, allowNull: false },
      // Cycle de vie de l'abonnement (dégradation progressive) — voir
      // services/abonnement.service.js#calculerPalier.
      montantDu: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      suspensionDemandeeAt: { type: DataTypes.DATE, allowNull: true },
      resiliationAt: { type: DataTypes.DATE, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      enTeteTicket: { type: DataTypes.STRING, allowNull: true },
      piedPageTicket: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Merci de votre confiance — bon voyage !',
      },
      afficherLogoSurTicket: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'companies',
    }
  );

  Company.associate = (models) => {
    Company.hasMany(models.Agence, { foreignKey: 'companyId', as: 'agences' });
    Company.hasMany(models.Bus, { foreignKey: 'companyId', as: 'buses' });
    Company.hasMany(models.Ligne, { foreignKey: 'companyId', as: 'lignes' });
    Company.hasMany(models.CompteAdmin, { foreignKey: 'companyId', as: 'comptesAdmin' });
    Company.hasMany(models.Guichetier, { foreignKey: 'companyId', as: 'guichetiers' });
    Company.hasMany(models.AgentControle, { foreignKey: 'companyId', as: 'agentsControle' });
    Company.hasMany(models.Embarquement, { foreignKey: 'companyId', as: 'embarquements' });
    Company.hasMany(models.Client, { foreignKey: 'companyId', as: 'clients' });
    Company.hasMany(models.Trip, { foreignKey: 'companyId', as: 'trips' });
    Company.hasMany(models.Reservation, { foreignKey: 'companyId', as: 'reservations' });
    Company.hasMany(models.Vente, { foreignKey: 'companyId', as: 'ventes' });
    Company.hasMany(models.CashSession, { foreignKey: 'companyId', as: 'cashSessions' });
    Company.hasMany(models.Pointage, { foreignKey: 'companyId', as: 'pointages' });
    Company.hasMany(models.AuditLog, { foreignKey: 'companyId', as: 'auditLogs' });
  };

  return Company;
};
