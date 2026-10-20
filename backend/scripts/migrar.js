/**
 * Prepara o banco no boot: `npm run migrar` (chamado pelo Dockerfile e pelo docker-compose).
 *
 *   - Banco VAZIO (instalacao nova): cria o schema inteiro com `prisma db push` e marca todas
 *     as migrations como aplicadas. As migrations antigas nao reconstroem o banco do zero —
 *     algumas nasceram depois de mudancas feitas por `db push` e uma delas altera a tabela
 *     GrupoCampo antes da migration que a cria —, entao aplica-las numa instalacao nova
 *     falhava no meio e deixava o servidor sem metade das tabelas.
 *   - Banco EXISTENTE: `prisma migrate deploy`, como sempre. Nada muda para quem ja esta no ar.
 *
 * Num banco vazio o `db push` nao tem dado a perder, que era o risco dele em producao.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const prisma = require('../src/prisma');

const run = (cmd) => execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });

async function main() {
    const [{ existe }] = await prisma.$queryRaw`SELECT to_regclass('public."Usuario"') IS NOT NULL AS existe`;
    await prisma.$disconnect();

    if (!existe) {
        console.log('Banco vazio: criando o schema completo...');
        run('npx prisma db push --skip-generate');
        const pasta = path.join(__dirname, '..', 'prisma', 'migrations');
        const migrations = fs.readdirSync(pasta).filter((m) => fs.statSync(path.join(pasta, m)).isDirectory());
        for (const m of migrations) run(`npx prisma migrate resolve --applied ${m}`);
    }

    run('npx prisma migrate deploy');
}

main().catch((erro) => {
    console.error(erro);
    process.exit(1);
});
