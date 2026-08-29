/**
 * Preenche `publicadoEm` / `publicadoPorId` dos quadros que ja estavam publicados.
 *
 *   npm run backfill:publicacoes -- --simular   (nao grava nada)
 *   npm run backfill:publicacoes                (grava)
 *
 * PRECISA DE BANCO. E idempotente: quadro que ja tem a data nao e tocado.
 *
 * POR QUE ISTO EXISTE
 * O painel de tarefas mede se o quadro do mes saiu ANTES de o anterior acabar. Para isso ele
 * precisa da data da publicacao, e ate agora ninguem a guardava — `status` diz que saiu,
 * `updatedAt` muda a cada celula editada.
 *
 * O QUADRO DE DESIGNACOES tem de onde vir: `Historico` ja registrava a acao "publicou" com o
 * usuario e a data. Este script transporta esse registro para as colunas novas.
 *
 * A ESCALA DE DIRIGENTES nao tem: `Historico` so tem chave estrangeira para `Quadro`, e a
 * escala nunca escreveu nada. Esses ficam sem data, e o painel diz "sem histórico anterior"
 * em vez de inventar. A partir de agora as duas passam a ser carimbadas na publicacao.
 */
const prisma = require('../src/prisma');

const simular = process.argv.includes('--simular');

async function main() {
    console.log(simular ? '=== SIMULACAO (nada e gravado) ===\n' : '=== BACKFILL DAS PUBLICACOES ===\n');

    // ---- quadro de designacoes: vem do Historico ---------------------------
    const quadros = await prisma.quadro.findMany({
        where: { status: 'publicado', publicadoEm: null },
        select: { id: true, mes: true, ano: true, titulo: true, createdAt: true },
        orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
    });

    console.log(`--- Quadros de designações publicados e sem data: ${quadros.length} ---\n`);

    let comHistorico = 0;
    let semHistorico = 0;

    for (const quadro of quadros) {
        // O PRIMEIRO "publicou" e o que vale: republicar depois de arquivar nao muda a
        // entrega original, que e o que o painel mede.
        const registro = await prisma.historico.findFirst({
            where: { quadroId: quadro.id, acao: 'publicou' },
            orderBy: { createdAt: 'asc' },
            select: { usuarioId: true, createdAt: true },
        });

        if (!registro) {
            semHistorico += 1;
            console.log(`   ${quadro.titulo}: sem registro de publicação no histórico — fica sem data`);
            continue;
        }

        comHistorico += 1;
        const quando = registro.createdAt.toISOString().slice(0, 10);
        const quem = registro.usuarioId
            ? (await prisma.usuario.findUnique({ where: { id: registro.usuarioId }, select: { nome: true } }))?.nome
            : null;
        console.log(`   ${quadro.titulo}: ${quando}${quem ? ` por ${quem}` : ' (autor apagado)'}`);

        if (!simular) {
            await prisma.quadro.update({
                where: { id: quadro.id },
                data: { publicadoEm: registro.createdAt, publicadoPorId: registro.usuarioId },
            });
        }
    }

    // ---- escala de dirigentes: nao ha de onde ------------------------------
    const escalas = await prisma.quadroDirigente.count({
        where: { status: 'publicado', publicadoEm: null },
    });

    console.log(`\n--- Escalas de dirigentes publicadas e sem data: ${escalas} ---\n`);
    if (escalas > 0) {
        console.log(
            '   Não há de onde preencher: a escala nunca escreveu no Histórico.\n' +
            '   Elas continuam sem data, e o painel as trata como "sem histórico anterior".\n' +
            '   As próximas publicações já são carimbadas.'
        );
    }

    console.log(
        `\n${simular ? 'Gravaria' : 'Gravei'} a data de ${comHistorico} quadro(s).` +
        (semHistorico > 0 ? ` ${semHistorico} ficaram sem histórico de onde tirar.` : '') +
        (simular ? '\nRode sem --simular para valer.' : '')
    );
}

main()
    .catch((erro) => {
        console.error('\nFALHOU:', erro.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
