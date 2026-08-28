/**
 * Cria os grupos de campo da congregacao.
 *
 *   npm run seed:grupos -- --simular   (nao grava nada)
 *   npm run seed:grupos                (grava)
 *
 * PRECISA DE BANCO. E idempotente: grupo que ja existe nao e recriado nem renomeado.
 *
 * Alem de criar, ele aproveita o que estiver na coluna antiga `grupo` (texto livre, que durou
 * um commit): quem tiver um texto que bata com o nome de um grupo e vinculado a ele. Como
 * ninguem chegou a preencher aquele campo na pratica, o normal e isso nao fazer nada — mas
 * fazer a conta e barato e evita perder o que porventura tenha sido digitado.
 */
const prisma = require('../src/prisma');

const simular = process.argv.includes('--simular');

/** Os cinco grupos, na ordem em que devem aparecer. */
const GRUPOS = [
    'Edilson Santos',
    'Luiz Roberto',
    'Elvandyr Lima',
    'Átilas Santos',
    'Marcelo Santana',
];

const chaveNome = (nome) =>
    String(nome || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

async function main() {
    console.log(simular ? '=== SIMULACAO (nada e gravado) ===\n' : '=== GRUPOS DE CAMPO ===\n');

    const existentes = await prisma.grupoCampo.findMany();
    const porNome = new Map(existentes.map((g) => [chaveNome(g.nome), g]));

    let criados = 0;
    for (const [indice, nome] of GRUPOS.entries()) {
        if (porNome.has(chaveNome(nome))) {
            console.log(`   ja existe: "${nome}"`);
            continue;
        }
        criados += 1;
        if (simular) {
            console.log(`   criaria: "${nome}"`);
            continue;
        }
        const novo = await prisma.grupoCampo.create({ data: { nome, ordem: indice } });
        porNome.set(chaveNome(novo.nome), novo);
        console.log(`   criado: "${novo.nome}"`);
    }
    console.log(`\ngrupos criados: ${criados} | ja existiam: ${GRUPOS.length - criados}`);

    // ---- aproveita o texto livre que porventura exista ----------------------
    const comTexto = await prisma.irmao.findMany({
        where: { grupo: { not: null }, grupoId: null },
        select: { id: true, nome: true, grupo: true },
    });

    let vinculados = 0;
    let semCorrespondente = 0;
    for (const pessoa of comTexto) {
        const grupo = porNome.get(chaveNome(pessoa.grupo));
        if (!grupo) {
            semCorrespondente += 1;
            console.log(`   sem grupo correspondente: "${pessoa.nome}" tinha "${pessoa.grupo}"`);
            continue;
        }
        vinculados += 1;
        if (!simular) {
            await prisma.irmao.update({ where: { id: pessoa.id }, data: { grupoId: grupo.id } });
        }
    }
    console.log(`texto antigo aproveitado: ${vinculados}${semCorrespondente ? ` | sem correspondente: ${semCorrespondente}` : ''}`);

    if (!simular) {
        const [total, semGrupo] = await Promise.all([
            prisma.irmao.count(),
            prisma.irmao.count({ where: { grupoId: null } }),
        ]);
        console.log(`\n=== CONFERENCIA ===`);
        console.log(`publicadores:        ${total}`);
        console.log(`ainda sem grupo:     ${semGrupo} (preencher na tela de Publicadores)`);
    }
}

main()
    .catch((e) => {
        console.error('\nFALHOU:', e.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
