// Chargeur de modèles Sequelize — motif standard généré par sequelize-cli :
// chaque fichier du dossier exporte une fonction (sequelize, DataTypes) =>
// Model, ce fichier les charge tous, appelle `.associate(models)` sur
// chacun, puis exporte l'objet `models` + l'instance `sequelize`.
const fs = require('fs');
const path = require('path');
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const basename = path.basename(__filename);
const db = {};

fs
  .readdirSync(__dirname)
  .filter((file) => file !== basename && file.endsWith('.model.js'))
  .forEach((file) => {
    const modelDefiner = require(path.join(__dirname, file));
    const model = modelDefiner(sequelize, DataTypes);
    db[model.name] = model;
  });

Object.values(db).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = require('sequelize');

module.exports = db;
