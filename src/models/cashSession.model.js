// Session de caisse d'un guichetier (CaisseSession vivante + CashSessionRecord
// historique côté ankata_guichet, fusionnées en une seule table : `ouverte`
// distingue les deux états).
module.exports = (sequelize, DataTypes) => {
  const CashSession = sequelize.define(
    'CashSession',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      numeroSession: { type: DataTypes.STRING, allowNull: false, unique: true },
      companyId: { type: DataTypes.UUID, allowNull: false },
      agenceId: { type: DataTypes.UUID, allowNull: false },
      guichetierId: { type: DataTypes.UUID, allowNull: false },
      dateOuverture: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      dateFermeture: { type: DataTypes.DATE, allowNull: true },
      fondInitial: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      totalVentesEspeces: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      totalVentesMobileMoney: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      nombreBilletsVendus: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      montantCompte: { type: DataTypes.INTEGER, allowNull: true },
      commentaire: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      totalDepenses: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      totalVersements: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ouverte: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'cash_sessions',
    }
  );

  CashSession.associate = (models) => {
    CashSession.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    CashSession.belongsTo(models.Agence, { foreignKey: 'agenceId', as: 'agence' });
    CashSession.belongsTo(models.Guichetier, { foreignKey: 'guichetierId', as: 'guichetier' });
    CashSession.hasMany(models.CashMovement, { foreignKey: 'cashSessionId', as: 'mouvements', onDelete: 'CASCADE' });
    CashSession.hasMany(models.Pointage, { foreignKey: 'cashSessionId', as: 'pointages' });
  };

  return CashSession;
};
