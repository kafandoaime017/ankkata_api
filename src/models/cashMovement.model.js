// Mouvement de caisse hors-vente (dépense / versement) — CaisseMouvement
// côté ankata_guichet, avec la FK vers sa session qui manquait dans le
// modèle Dart d'origine.
const { TYPE_MOUVEMENT_CAISSE } = require('../constants/enums');

module.exports = (sequelize, DataTypes) => {
  const CashMovement = sequelize.define(
    'CashMovement',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      cashSessionId: { type: DataTypes.UUID, allowNull: false },
      reference: { type: DataTypes.STRING, allowNull: false },
      date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      type: { type: DataTypes.ENUM(...TYPE_MOUVEMENT_CAISSE), allowNull: false },
      motif: { type: DataTypes.STRING, allowNull: false },
      montant: { type: DataTypes.INTEGER, allowNull: false },
      guichetierId: { type: DataTypes.UUID, allowNull: false },
    },
    {
      tableName: 'cash_movements',
    }
  );

  CashMovement.associate = (models) => {
    CashMovement.belongsTo(models.CashSession, { foreignKey: 'cashSessionId', as: 'cashSession' });
    CashMovement.belongsTo(models.Guichetier, { foreignKey: 'guichetierId', as: 'guichetier' });
  };

  return CashMovement;
};
