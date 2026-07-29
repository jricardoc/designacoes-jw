FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3001

# Aplica as migrations versionadas de prisma/migrations e sobe a API.
#
# Antes isto era `prisma db push`, que INFERE a mudanca comparando schema e banco no boot.
# Ele recusa o que julga arriscado - criar uma constraint UNIQUE, por exemplo - e, com tudo
# encadeado por `&&`, o `npm start` nunca era alcancado: o container reiniciava em loop e a
# API ficava fora do ar por causa de uma alteracao de schema aditiva.
#
# O `|| echo` mantem o servidor no ar mesmo se uma migration falhar, com aviso no log:
# uma coluna faltando degrada um endpoint, um crash loop derruba tudo.
#
# Ao mudar o schema: `npx prisma migrate dev --name descricao` e commitar prisma/migrations.
CMD ["sh", "-c", "npx prisma generate && { npx prisma migrate deploy || echo '>>> AVISO: prisma migrate deploy FALHOU. Rode `npx prisma migrate status` para investigar. <<<'; } && npm run start"]
