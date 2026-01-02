FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5173

# Habilita host para acesso externo ao container
CMD ["npm", "run", "dev", "--", "--host"]
