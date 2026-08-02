// Instance Sequelize unique utilisée par toute l'application au moment de
// l'exécution (distincte de config.js, qui ne sert qu'à sequelize-cli).
const { Sequelize } = require('sequelize');
const { types } = require('pg');
const env = require('./env');

// Le driver pg renvoie par défaut les colonnes BIGINT (OID 20) sous forme de
// chaîne de caractères, pour éviter toute perte de précision sur de très
// grands nombres. Nos seules colonnes BIGINT (couleurPrimaire/couleurSecondaire
// — des entiers ARGB toujours largement sous Number.MAX_SAFE_INTEGER) doivent
// rester des nombres JSON pour les clients Flutter, qui attendent un `int`
// et non une chaîne (voir company.model.js).
types.setTypeParser(20, (valeur) => parseInt(valeur, 10));

const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'postgres',
  dialectOptions: env.db.ssl ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  logging: env.isProduction ? false : console.log,
  define: {
    underscored: true,
    timestamps: true,
  },
});

module.exports = sequelize;
