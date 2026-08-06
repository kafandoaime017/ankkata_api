// Départ concret (instance datée d'une Ligne) — comble le manque d'`id`/
// FK relevé dans le `Trip` Dart (qui n'était identifié que par la
// combinaison date/heure/villes). Ici chaque trip a un vrai id et référence
// sa ligne, son agence de départ et son bus.
const { STATUT_TRIP } = require('../constants/enums');

module.exports = (sequelize, DataTypes) => {
  const Trip = sequelize.define(
    'Trip',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      companyId: { type: DataTypes.UUID, allowNull: false },
      ligneId: { type: DataTypes.UUID, allowNull: false },
      agenceDepartId: { type: DataTypes.UUID, allowNull: false },
      busId: { type: DataTypes.UUID, allowNull: true },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      heureDepart: { type: DataTypes.STRING(5), allowNull: false }, // "HH:mm"
      chauffeur: { type: DataTypes.STRING, allowNull: true },
      statut: { type: DataTypes.ENUM(...STATUT_TRIP), allowNull: false, defaultValue: 'prevu' },
      // Surcharge PONCTUELLE (ce départ daté précis uniquement) des sous-quotas
      // par canal définis sur la `Ligne` (voir ligne.model.js#quotaEnLigne /
      // #quotaGuichet) — sans ceci, ajuster un quota sur la Ligne s'applique à
      // TOUS les jours de ce créneau récurrent, ce qui empêche de fermer/
      // limiter la réservation en ligne pour UN SEUL départ (ex. "complet le 6
      // août" mais pas le 7 août) sans toucher au réglage par défaut de la
      // ligne. NULL = pas de surcharge, on retombe sur la valeur de la Ligne
      // (comportement par défaut, inchangé). Voir migration
      // `add-quota-overrides-to-trips` et `quota.service.js`.
      quotaEnLigneOverride: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 0 } },
      quotaGuichetOverride: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 0 } },
    },
    {
      tableName: 'trips',
      indexes: [{ unique: true, fields: ['ligne_id', 'date', 'heure_depart'] }],
    }
  );

  Trip.associate = (models) => {
    Trip.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    Trip.belongsTo(models.Ligne, { foreignKey: 'ligneId', as: 'ligne' });
    Trip.belongsTo(models.Agence, { foreignKey: 'agenceDepartId', as: 'agenceDepart' });
    Trip.belongsTo(models.Bus, { foreignKey: 'busId', as: 'bus' });
    Trip.hasMany(models.Reservation, { foreignKey: 'tripId', as: 'reservations' });
    Trip.hasMany(models.Vente, { foreignKey: 'tripId', as: 'ventes' });
  };

  return Trip;
};
