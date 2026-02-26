FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3001

# O comando final roda a atualização automática do banco e inicia a API
CMD ["sh", "-c", "npx prisma generate && npx prisma db push && npm run start"]
