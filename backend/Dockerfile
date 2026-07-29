FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3001

# Atualiza o schema do banco e sobe a API.
#
# O `|| echo` no meio nao e descuido: `prisma db push` RECUSA mudancas que ele considera
# arriscadas (por exemplo criar uma constraint UNIQUE), e como o encadeamento era todo com
# `&&`, o `npm start` nunca era alcancado - o container entrava em loop de reinicio e a API
# ficava 100% fora do ar por causa de uma alteracao de schema. Foi o que aconteceu ao
# adicionar `Usuario.irmaoId @unique`.
#
# Agora o servidor sobe de qualquer jeito. Se o push for recusado, o log traz o aviso e o
# operador aplica a mudanca manualmente (`npx prisma db push --accept-data-loss` depois de
# conferir o diff com `npx prisma migrate diff`). Uma coluna faltando degrada um endpoint;
# um crash loop derruba tudo.
#
# Correcao definitiva: migrar de `db push` para migrations versionadas (`prisma migrate deploy`).
CMD ["sh", "-c", "npx prisma generate && { npx prisma db push || echo '>>> AVISO: prisma db push foi RECUSADO. O schema do banco pode estar desatualizado. Confira o diff e aplique manualmente. <<<'; } && npm run start"]
