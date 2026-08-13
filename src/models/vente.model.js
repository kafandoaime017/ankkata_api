// Vente au guichet (SaleSummary côté ankata_guichet) — mutable (annulation,
// vérification colis), à la différence de la réservation en ligne.
const { MOYEN_PAIEMENT, CLASSE_CONFORT, TYPE_BILLET } = require('../constants/enums');

module.exports = (sequelize, DataTypes) => {
  const Vente = sequelize.define(
    'Vente',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      reference: { type: DataTypes.STRING, allowNull: false, unique: true },
      // Identifiant généré côté client (mode offline guichet) — permet de
      // rejouer un envoi sans risque de doublon si la connexion coupe après
      // que le serveur a bien enregistré la vente mais avant que sa réponse
      // arrive au poste. Voir controllers/vente.controller.js#create et
      // ankata_guichet/lib/core/services/vente_sync_session.dart.
      idLocal: { type: DataTypes.UUID, allowNull: true },
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
      // Billet aller-retour vendu en une fois (voir
      // `vente.controller.js#createAllerRetour`) : chaque jambe reste une
      // `Vente` à part entière (son propre `tripId`/`prixUnitaire`, cohérent
      // avec le quota par trajet), les deux se référencent mutuellement via
      // `venteLieeId` pour être affichées/imprimées comme un seul billet.
      typeBillet: { type: DataTypes.ENUM(...TYPE_BILLET), allowNull: false, defaultValue: 'aller_simple' },
      venteLieeId: { type: DataTypes.UUID, allowNull: true },
      // Prix unitaire AVANT réduction aller-retour (voir
      // `Ligne.reductionAllerRetourPourcentage` et
      // `vente.controller.js#createAllerRetour`) — `null` tant qu'aucune
      // réduction n'a été appliquée à cette jambe. Permet d'afficher le tarif
      // normal barré à côté du prix net sur le reçu/billet.
      prixUnitaireAvantReduction: { type: DataTypes.INTEGER, allowNull: true },
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
    Vente.belongsTo(models.Vente, { foreignKey: 'venteLieeId', as: 'venteLiee' });
  };

  return Vente;
};
