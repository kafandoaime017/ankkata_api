// Config consommée par sequelize-cli (migrations/seeders), au format
// attendu par la CLI (un objet par environnement). On réutilise les mêmes
// variables d'environnement que le runtime applicatif (voir env.js) afin
// de n'avoir qu'un seul jeu de variables à maintenir.
require('dotenv').config();

const base = {
  username: process.env.DB_USER || 'ankkata',
  password: process.env.DB_PASSWORD || 'ankkata_secret',
  database: process.env.DB_NAME || 'ankkata',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  dialect: 'postgres',
  dialectOptions:
    String(process.env.DB_SSL).toLowerCase() === 'true'
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
  logging: false,
};

module.exports = {
  development: base,
  test: { ...base, database: `${base.database}_test` },
  production: base,
};
