FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3001

# Prisma generate será rodado no start ou build, mas aqui garantimos dependências
# O comando final será sobrescrito pelo docker-compose ou definido aqui
CMD ["npm", "run", "dev"]
