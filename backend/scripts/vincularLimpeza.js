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
 * A NUMERACAO MUDA COM O TEMPO. A congregacao ja teve seis grupos (havia um "Grupo 3 do
 * Helber Dias" em Marco/2026), e quando um grupo sai os outros sao renumerados — o historico
 * passa a contradizer o presente sem erro nenhum envolvido. Por isso o script decide por
 * RECENCIA: vale o numero das semanas mais novas, desde que duas o confirmem. Toda divergencia
 * e impressa, inclusive as que ele resolve sozinho.
 *
 * O QUE ELE NAO FAZ: nao inventa numero. Grupo que nunca apareceu numa linha de limpeza fica
 * sem numero e continua casando por nome, como hoje. E um numero novo que aparece uma vez so,
 * brigando com o passado, nao grava nada: pode ser renumeracao comecando ou pode ser engano,
 * e chutar ali colocaria o grupo errado para limpar o salao.
 */
const prisma = require('../src/prisma');
const Limpeza = require('../src/services/LimpezaGrupoService');

const simular = process.argv.includes('--simular');

/** "dd/MM/yyyy" -> "yyyy-MM-dd", que ordena cronologicamente como texto. Sem data, null. */
function chaveCronologica(semana) {
    const m = String(semana.dataReuniao || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

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
        select: { faixaData: true, dataReuniao: true, limpeza: true },
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
    // A ordem cronologica sai da DATA da reuniao, nao do `id`: reimportar um mes recria as
    // semanas dele com ids novos e o passado passaria a parecer o presente — que e
    // exatamente o que faria a numeracao antiga ganhar da atual.
    const entradas = semanas.map(s => ({ texto: s.limpeza, quando: chaveCronologica(s) }));
    const { aprendidos, conflitos } = Limpeza.aprenderNumeros(entradas, grupos);

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
        if (conflito.resolvido) {
            // Normal quando a congregacao ja teve outra quantidade de grupos: o historico
            // usa a numeracao velha. Aparece assim mesmo para nao decidir isso em silencio.
            console.log(
                `   ~  ${nome}: o historico ja o chamou de Grupo ${conflito.descartados.join(' e ')}; ` +
                `fico com o Grupo ${conflito.numero} (${conflito.apoio} semanas recentes)`
            );
        } else {
            console.log(
                `   !! ${nome}: o documento o chama de Grupo ${conflito.numeros.join(' e de Grupo ')}, ` +
                'e o mais novo aparece uma vez so — nao gravo nada'
            );
        }
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
