/**
 * Ensina ao sistema o NUMERO com que a programacao chama cada grupo de campo.
 *
 *   npm run vincular:limpeza -- --simular   (nao grava nada)
 *   npm run vincular:limpeza                (grava)
 *
 * PRECISA DE BANCO. E idempotente: rodar de novo nao muda nada se ja estiver certo.
 *
 * POR QUE ISTO EXISTE
 * A programacao escala a limpeza assim: "Limpeza: Grupo 4 Elvandy LIma & Grupo 5 Luiz
 * Roberto". O nome ali chega abreviado, com caixa trocada e com Z/S trocados — e o cadastro
 * conhece o grupo como "Elvandyr Lima". O casamento por nome de LimpezaGrupoService aguenta
 * esses defeitos, mas ele nao aguentaria o grupo ser REBATIZADO (o que acontece toda vez que
 * troca o dirigente, porque o grupo leva o nome de quem o dirige). O numero, esse, o
 * documento escreve sempre igual.
 *
 * Entao o script le todas as semanas ja importadas, casa cada fragmento por NOME, e grava o
 * numero que veio junto. Dai em diante o casamento passa a ser por numero, e o nome vira so
 * conferencia.
 *
 * O QUE ELE NAO FAZ: nao inventa numero. Grupo que nunca apareceu numa linha de limpeza fica
 * sem numero e continua casando por nome, como hoje. Duas semanas discordando sobre o numero
 * do mesmo grupo tambem nao gravam nada — e sinal de que o casamento por nome errou, e chutar
 * ali colocaria o grupo errado para limpar o salao.
 */
const prisma = require('../src/prisma');
const Limpeza = require('../src/services/LimpezaGrupoService');

const simular = process.argv.includes('--simular');

async function main() {
    console.log(simular ? '=== SIMULACAO (nada e gravado) ===\n' : '=== VINCULAR LIMPEZA AOS GRUPOS ===\n');

    const grupos = await prisma.grupoCampo.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, numero: true },
        orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });

    if (grupos.length === 0) {
        console.log('Nenhum grupo de campo cadastrado. Rode `npm run seed:grupos` antes.');
        return;
    }

    const semanas = await prisma.semanaReuniao.findMany({
        where: { limpeza: { not: null } },
        select: { faixaData: true, limpeza: true },
        orderBy: { id: 'asc' },
    });

    console.log(`grupos: ${grupos.length} | semanas com limpeza: ${semanas.length}\n`);
    if (semanas.length === 0) {
        console.log('Nenhuma semana importada tem a linha "Limpeza:". Importe a programacao antes.');
        return;
    }

    // ---- 1. o que cada semana escala hoje ---------------------------------
    console.log('--- Como cada semana e lida HOJE ---\n');
    const orfaos = [];
    for (const semana of semanas) {
        const { grupos: escalados, naoCasados } = Limpeza.gruposDaSemana(semana.limpeza, grupos);
        const lidos = escalados.map(e => `${e.grupo.nome} (por ${e.criterio})`).join(' + ') || '(nenhum)';
        console.log(`   ${semana.faixaData}`);
        console.log(`      "${semana.limpeza}"`);
        console.log(`      -> ${lidos}`);
        for (const f of naoCasados) {
            orfaos.push({ semana: semana.faixaData, ...f });
            console.log(`      !! sem grupo: "${f.bruto}"${f.ambiguo ? ' (ambiguo: bate com mais de um)' : ''}`);
        }
    }

    // ---- 2. o numero aprendido --------------------------------------------
    console.log('\n--- Numeracao aprendida do documento ---\n');
    const { aprendidos, conflitos } = Limpeza.aprenderNumeros(semanas.map(s => s.limpeza), grupos);

    const porId = new Map(grupos.map(g => [g.id, g]));
    let paraGravar = 0;
    let jaCertos = 0;

    for (const grupo of grupos) {
        const novo = aprendidos.get(grupo.id);
        if (novo === undefined) {
            console.log(`   ${grupo.nome}: nunca apareceu numerado — continua casando por nome`);
            continue;
        }
        if (grupo.numero === novo) {
            jaCertos += 1;
            console.log(`   ${grupo.nome}: ja e o Grupo ${novo}`);
            continue;
        }
        paraGravar += 1;
        const antes = grupo.numero === null ? 'sem numero' : `Grupo ${grupo.numero}`;
        console.log(`   ${grupo.nome}: ${antes} -> Grupo ${novo}`);
    }

    for (const conflito of conflitos) {
        const nome = porId.get(conflito.grupoId)?.nome ?? `#${conflito.grupoId}`;
        console.log(`   !! ${nome}: o documento o chama de Grupo ${conflito.numeros.join(' e de Grupo ')} — nao gravo nada`);
    }

    // ---- 3. grava -----------------------------------------------------------
    if (paraGravar === 0) {
        console.log(`\nNada a gravar (${jaCertos} ja estavam certos).`);
    } else if (simular) {
        console.log(`\nGravaria o numero de ${paraGravar} grupo(s). Rode sem --simular para valer.`);
    } else {
        for (const grupo of grupos) {
            const novo = aprendidos.get(grupo.id);
            if (novo === undefined || grupo.numero === novo) continue;
            await prisma.grupoCampo.update({ where: { id: grupo.id }, data: { numero: novo } });
        }
        console.log(`\n${paraGravar} grupo(s) numerado(s).`);
    }

    // ---- 4. quem limpa, afinal ---------------------------------------------
    console.log('\n--- Quantas pessoas cada grupo alcanca ---\n');
    const comGente = await Limpeza.carregarGrupos();
    for (const grupo of comGente) {
        console.log(`   ${grupo.nome}: ${grupo.integrantes.length} pessoa(s)`);
    }
    const semNinguem = comGente.filter(g => g.integrantes.length === 0);
    if (semNinguem.length > 0) {
        console.log(
            `\n   AVISO: ${semNinguem.map(g => g.nome).join(', ')} nao tem ninguem vinculado. ` +
            'A semana de limpeza deles nao vai aparecer para irmao nenhum.'
        );
    }

    if (orfaos.length > 0) {
        console.log(
            `\n   AVISO: ${orfaos.length} fragmento(s) de limpeza nao casaram com grupo nenhum. ` +
            'Esses grupos ficam sem ser avisados — confira a grafia no cadastro.'
        );
    }
}

main()
    .catch((erro) => {
        console.error('\nFALHOU:', erro.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
