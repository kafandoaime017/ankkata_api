// Vente au guichet (SaleSummary côté ankata_guichet) — mutable (annulation,
// vérification colis), à la différence de la réservation en ligne.
const { MOYEN_PAIEMENT, CLASSE_CONFORT } = require('../constants/enums');

module.exports = (sequelize, DataTypes) => {
  const Vente = sequelize.define(
    'Vente',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      reference: { type: DataTypes.STRING, allowNull: false, unique: true },
      companyId: { type: DataTypes.UUID, allowNull: false },
      agenceId: { type: DataTypes.UUID, allowNull: false },
      tripId: { type: DataTypes.UUID, allowNull: true },
      guichetierId: { type: DataTypes.UUID, allowNull: false },
      clientId: { type: DataTypes.UUID, allowNull: true },
      classe: { type: DataTypes.ENUM(...CLASSE_CONFORT), allowNull: false, defaultValue: 'Standard' },
      nombrePlaces: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      prixUnitaire: { type: DataTypes.INTEGER, allowNull: false },
      nomVoyageur: { type: DataTypes.STRING, allowNull: false },
      telephoneVoyageur: { type: DataTypes.STRING, allowNull: false },
      pieceIdentite: { type: DataTypes.STRING, allowNull: true },
      moyenPaiement: { type: DataTypes.ENUM(...MOYEN_PAIEMENT), allowNull: false },
      heureVente: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      dateVoyage: { type: DataTypes.DATEONLY, allowNull: false },
      annulee: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      motifAnnulation: { type: DataTypes.STRING, allowNull: true },
      aDesColis: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      colisDescription: { type: DataTypes.STRING, allowNull: true },
      colisPoidsKg: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
      colisVerifie: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      montantRecu: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      tableName: 'ventes',
    }
  );

  Vente.associate = (models) => {
    Vente.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    Vente.belongsTo(models.Agence, { foreignKey: 'agenceId', as: 'agence' });
    Vente.belongsTo(models.Trip, { foreignKey: 'tripId', as: 'trip' });
    Vente.belongsTo(models.Guichetier, { foreignKey: 'guichetierId', as: 'guichetier' });
    Vente.belongsTo(models.Client, { foreignKey: 'clientId', as: 'client' });
  };

  return Vente;
};
