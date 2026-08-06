// Réservation (en ligne ou guichet), lue en lecture seule côté équipe
// Ankkata mais pleinement gérable côté compagnie. Fusionne Reservation
// (ankata_guichet) et ReservationSupervisee (ankkata_admin).
const { CANAL_RESERVATION, STATUT_RESERVATION, MOYEN_PAIEMENT, CLASSE_CONFORT, TYPE_BILLET } = require('../constants/enums');

module.exports = (sequelize, DataTypes) => {
  const Reservation = sequelize.define(
    'Reservation',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      reference: { type: DataTypes.STRING, allowNull: false, unique: true },
      companyId: { type: DataTypes.UUID, allowNull: false },
      clientId: { type: DataTypes.UUID, allowNull: true },
      compteVoyageurId: { type: DataTypes.UUID, allowNull: true },
      tripId: { type: DataTypes.UUID, allowNull: true },
      agenceId: { type: DataTypes.UUID, allowNull: false },
      nomVoyageur: { type: DataTypes.STRING, allowNull: false },
      telephoneVoyageur: { type: DataTypes.STRING, allowNull: false },
      villeDepart: { type: DataTypes.STRING, allowNull: false },
      villeArrivee: { type: DataTypes.STRING, allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      heureDepart: { type: DataTypes.STRING(5), allowNull: false },
      classe: { type: DataTypes.ENUM(...CLASSE_CONFORT), allowNull: false, defaultValue: 'Standard' },
      montant: { type: DataTypes.INTEGER, allowNull: false },
      moyenPaiement: { type: DataTypes.ENUM(...MOYEN_PAIEMENT), allowNull: false },
      canal: { type: DataTypes.ENUM(...CANAL_RESERVATION), allowNull: false },
      statut: { type: DataTypes.ENUM(...STATUT_RESERVATION), allowNull: false, defaultValue: 'confirmee' },
      motifAnnulation: { type: DataTypes.STRING, allowNull: true },
      dateReservation: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      // Billet aller-retour posé en une seule opération publique (voir
      // migration `add-type-billet-to-reservations` et
      // `public.controller.js#createReservationAllerRetour`) — même
      // architecture que `Vente.typeBillet`/`Vente.venteLieeId` côté guichet :
      // chaque jambe reste une `Reservation` à part entière, liée à l'autre
      // via `reservationLieeId` (auto-référence symétrique).
      typeBillet: { type: DataTypes.ENUM(...TYPE_BILLET), allowNull: false, defaultValue: 'aller_simple' },
      reservationLieeId: { type: DataTypes.UUID, allowNull: true },
      // NULL tant qu'aucune réduction aller-retour n'a été appliquée ; sinon,
      // ce que cette jambe aurait coûté SEULE avant réduction — uniquement
      // pour l'affichage ("vous économisez X FCFA"), voir
      // `Ligne.reductionAllerRetourPourcentage`.
      montantAvantReduction: { type: DataTypes.INTEGER, allowNull: true },
      // Réservation groupée (1 à 6 passagers) posée en une seule opération
      // publique — voir migration `add-groupe-reference-to-reservations` et
      // `public.controller.js#createReservationGroupe`. Partagée par toutes
      // les `Reservation` d'un même groupe (chaque passager reste sa propre
      // ligne, son propre billet), NULL pour une réservation solo ou une
      // jambe aller-retour posée seule.
      groupeReference: { type: DataTypes.STRING, allowNull: true },
    },
    {
      tableName: 'reservations',
    }
  );

  Reservation.associate = (models) => {
    Reservation.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    Reservation.belongsTo(models.Client, { foreignKey: 'clientId', as: 'client' });
    Reservation.belongsTo(models.CompteVoyageur, { foreignKey: 'compteVoyageurId', as: 'compteVoyageur' });
    Reservation.belongsTo(models.Trip, { foreignKey: 'tripId', as: 'trip' });
    Reservation.belongsTo(models.Agence, { foreignKey: 'agenceId', as: 'agence' });
    Reservation.belongsTo(models.Reservation, { foreignKey: 'reservationLieeId', as: 'reservationLiee' });
  };

  return Reservation;
};
