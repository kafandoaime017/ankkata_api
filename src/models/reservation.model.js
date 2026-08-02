// Réservation (en ligne ou guichet), lue en lecture seule côté équipe
// Ankkata mais pleinement gérable côté compagnie. Fusionne Reservation
// (ankata_guichet) et ReservationSupervisee (ankkata_admin).
const { CANAL_RESERVATION, STATUT_RESERVATION, MOYEN_PAIEMENT, CLASSE_CONFORT } = require('../constants/enums');

module.exports = (sequelize, DataTypes) => {
  const Reservation = sequelize.define(
    'Reservation',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      reference: { type: DataTypes.STRING, allowNull: false, unique: true },
      companyId: { type: DataTypes.UUID, allowNull: false },
      clientId: { type: DataTypes.UUID, allowNull: true },
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
    },
    {
      tableName: 'reservations',
    }
  );

  Reservation.associate = (models) => {
    Reservation.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    Reservation.belongsTo(models.Client, { foreignKey: 'clientId', as: 'client' });
    Reservation.belongsTo(models.Trip, { foreignKey: 'tripId', as: 'trip' });
    Reservation.belongsTo(models.Agence, { foreignKey: 'agenceId', as: 'agence' });
  };

  return Reservation;
};
