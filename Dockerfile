FROM node:20-alpine

# Outils nécessaires au script d'attente de la base de données.
RUN apk add --no-cache bash netcat-openbsd

WORKDIR /usr/src/app

# Installation des dépendances (couche mise en cache tant que package*.json
# ne change pas).
COPY package*.json ./
RUN npm install

# Code source de l'application.
COPY . .

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
