const prisma = require('./src/prisma');

async function main() {
    console.log('Cleaning up broken quadro...');
    try {
        const q = await prisma.quadro.findFirst({
            where: { mes: 1, ano: 2026 },
            include: { designacoes: true }
        });

        if (q && q.designacoes.length === 0) {
            console.log(`Found broken quadro ${q.id} (Jan 2026) with 0 designacoes.`);

            // Delete related records just in case
            await prisma.historico.deleteMany({ where: { quadroId: q.id } });
            await prisma.designacao.deleteMany({ where: { quadroId: q.id } });
            await prisma.quadro.delete({ where: { id: q.id } });

            console.log('Quadro deleted successfully.');
        } else {
            console.log('No broken quadro found (or quadro has designacoes).');
        }
    } catch (e) {
        console.error('Error during cleanup:', e);
    }
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
