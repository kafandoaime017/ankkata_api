// Journal (append-only) de chaque tentative de contrôle à l'embarquement —
// même logique que AuditLog/Pointage/CashMovement : jamais modifié après
// écriture, une ligne par tentative (y compris les échecs : "déjà utilisé",
// "billet introuvable"...), pour garder un historique complet consultable
// côté compagnie. Voir constants/enums.js pour le détail des enums, et
// controllers/embarquement.controller.js pour la logique métier.
const { TYPE_TICKET_EMBARQUEMENT, SOURCE_EMBARQUEMENT, STATUT_EMBARQUEMENT } = require('../constants/enums');

module.exports = (sequelize, DataTypes) => {
  const Embarquement = sequelize.define(
    'Embarquement',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      companyId: { type: DataTypes.UUID, allowNull: false },
      tripId: { type: DataTypes.UUID, allowNull: false },
      // Nullable : ces routes restent aussi accessibles à un admin/guichetier
      // de la compagnie (voir `canOperateEmbarquement` côté middleware), qui
      // n'a pas de ligne `agents_controle` — l'attribution précise à un
      // agent n'est renseignée que quand c'est réellement l'espace
      // `controle` qui a agi (voir embarquement.controller.js).
      agentControleId: { type: DataTypes.UUID, allowNull: true },
      // Généré côté app au moment du scan/de la saisie manuelle — permet de
      // rejouer l'envoi sans risque de doublon si la connexion coupe juste
      // après que le serveur a enregistré l'embarquement mais avant que sa
      // réponse arrive au téléphone de l'agent (même mécanisme que
      // Vente.idLocal, voir vente.controller.js#create).
      idLocal: { type: DataTypes.UUID, allowNull: false },
      ticketType: { type: DataTypes.ENUM(...TYPE_TICKET_EMBARQUEMENT), allowNull: false },
      ticketId: { type: DataTypes.UUID, allowNull: true },
      reference: { type: DataTypes.STRING, allowNull: false },
      groupeReference: { type: DataTypes.STRING, allowNull: true },
      statut: { type: DataTypes.ENUM(...STATUT_EMBARQUEMENT), allowNull: false },
      source: { type: DataTypes.ENUM(...SOURCE_EMBARQUEMENT), allowNull: false, defaultValue: 'scan' },
      // Horodatage réel côté téléphone de l'agent (pas l'heure de synchro —
      // un embarquement peut être enregistré hors ligne puis synchronisé
      // bien plus tard).
      scanneAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'embarquements',
      updatedAt: false,
      indexes: [
        // Idempotence par poste/agent : rejouer le même idLocal ne doit
        // jamais créer un doublon.
        { unique: true, fields: ['trip_id', 'id_local'] },
        // Un même billet ne peut avoir qu'UN embarquement "réussi" par
        // trajet — appliqué au niveau applicatif (voir
        // embarquement.controller.js), cet index accélère la recherche par
        // référence plutôt que de la garantir lui-même (un billet peut
        // légitimement avoir plusieurs lignes `invalide`/`deja_embarque`).
        { fields: ['trip_id', 'reference'] },
      ],
    }
  );

  Embarquement.associate = (models) => {
    Embarquement.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    Embarquement.belongsTo(models.Trip, { foreignKey: 'tripId', as: 'trip' });
    Embarquement.belongsTo(models.AgentControle, { foreignKey: 'agentControleId', as: 'agentControle' });
  };

  return Embarquement;
};
