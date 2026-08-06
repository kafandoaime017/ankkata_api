// Ligne (itinéraire) du catalogue d'une compagnie — agence de départ +
// ville d'arrivée + bus assigné (optionnel). Tarifs/horaires/arrêts/
// promotions vivent dans des tables enfants (ligne_tarifs, ligne_horaires,
// ligne_arrets, promotions_tarifaires) plutôt que des colonnes Map/List.
module.exports = (sequelize, DataTypes) => {
  const Ligne = sequelize.define(
    'Ligne',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      code: { type: DataTypes.STRING, allowNull: false, unique: true },
      companyId: { type: DataTypes.UUID, allowNull: false },
      agenceDepartId: { type: DataTypes.UUID, allowNull: false },
      // Gare d'arrivée — voir migration `add-agence-arrivee-id-to-lignes` :
      // remplace le champ libre historique par une vraie Agence (les gares
      // SONT les agences), ce qui permet d'afficher la gare d'arrivée et de
      // tracer un itinéraire sur une carte. Nullable uniquement pour les
      // lignes créées avant ce changement et dont le backfill automatique
      // n'a trouvé aucune correspondance ; le contrôleur l'exige désormais à
      // la création (voir `ligne.controller.js#create`).
      agenceArriveeId: { type: DataTypes.UUID, allowNull: true },
      // Dérivé automatiquement de `agenceArrivee.ville` par le contrôleur à
      // chaque écriture (plus jamais accepté en texte libre depuis le
      // client) — conservé tel quel pour ne rien casser côté recherche
      // voyageur, rapports, etc. qui lisent encore ce champ directement.
      villeArrivee: { type: DataTypes.STRING, allowNull: false },
      busId: { type: DataTypes.UUID, allowNull: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      reversible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      dureeEstimeeMinutes: { type: DataTypes.INTEGER, allowNull: true },
      // Nombre de places par départ de cette ligne — voir
      // `services/quota.service.js`, seule source de vérité utilisée pour
      // refuser une vente/réservation qui dépasserait la capacité réelle
      // d'un trajet (y compris une vente hors ligne rejouée après coup).
      capaciteTotale: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50, validate: { min: 1 } },
      // Répartition de `capaciteTotale` par canal — voir migration
      // `add-quotas-canal-to-lignes` et `services/quota.service.js` pour la
      // logique de vérification. NULL = pas de sous-quota pour ce canal (il
      // reste seulement borné par `capaciteTotale`, comportement historique).
      quotaEnLigne: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 0 } },
      quotaGuichet: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 0 } },
      // Minutes avant le départ à partir desquelles la réservation en ligne
      // se ferme (le trajet disparaît de la recherche voyageur — voir
      // `public.controller.js#reservationEnLigneFermee`). NULL = réservable
      // en ligne jusqu'au départ.
      delaiLimiteReservationEnLigneMinutes: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 0 } },
      // Auto-référence symétrique vers "l'autre ligne de la paire" pour une
      // ligne réversible (aller <-> retour) — voir migration
      // `add-ligne-retour-id-to-lignes`. Permet de résoudre le trajet retour
      // au moment d'une vente aller-retour (`vente.controller.js
      // #createAllerRetour`) par une simple jointure plutôt que par la
      // convention villeArrivee/agenceDepartId utilisée jusqu'ici côté
      // client (fragile, voir `lignes_tarifs_screen.dart`).
      ligneRetourId: { type: DataTypes.UUID, allowNull: true },
      // Réduction (%) appliquée au prix TOTAL d'un billet aller-retour posé
      // en une seule réservation publique quand les deux trajets choisis
      // appartiennent à cette paire réversible — voir migration
      // `add-reduction-aller-retour-to-lignes` et
      // `public.controller.js#createReservationAllerRetour`. NULL ou 0 =
      // aucune réduction (prix = simple somme des deux tarifs).
      reductionAllerRetourPourcentage: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 0, max: 100 } },
      // Services/équipements inclus sur cette ligne (climatisation, wifi,
      // repas...) — tableau de codes tirés de `EQUIPEMENTS_LIGNE` (voir
      // constants/enums.js), validés à l'écriture par
      // `ligne.controller.js#validerEquipements`. Affiché en icônes côté
      // voyageur (cards de résultats + détail trajet, voir
      // `public.controller.js#construireResultat`). Tableau vide par défaut,
      // jamais NULL — voir migration `add-equipements-to-lignes`.
      equipements: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
    },
    {
      tableName: 'lignes',
    }
  );

  Ligne.associate = (models) => {
    Ligne.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    Ligne.belongsTo(models.Agence, { foreignKey: 'agenceDepartId', as: 'agenceDepart' });
    Ligne.belongsTo(models.Agence, { foreignKey: 'agenceArriveeId', as: 'agenceArrivee' });
    Ligne.belongsTo(models.Bus, { foreignKey: 'busId', as: 'bus' });
    Ligne.hasMany(models.LigneTarif, { foreignKey: 'ligneId', as: 'tarifs', onDelete: 'CASCADE' });
    Ligne.hasMany(models.LigneHoraire, { foreignKey: 'ligneId', as: 'horaires', onDelete: 'CASCADE' });
    Ligne.hasMany(models.LigneArret, { foreignKey: 'ligneId', as: 'arrets', onDelete: 'CASCADE' });
    Ligne.hasMany(models.Promotion, { foreignKey: 'ligneId', as: 'promotions', onDelete: 'CASCADE' });
    Ligne.hasMany(models.Trip, { foreignKey: 'ligneId', as: 'trips' });
    Ligne.belongsTo(models.Ligne, { foreignKey: 'ligneRetourId', as: 'ligneRetour' });
  };

  return Ligne;
};
