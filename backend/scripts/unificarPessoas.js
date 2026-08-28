/**
 * Unifica as pessoas numa tabela so: leva os publicadores do carrinho para `Irmao` e
 * preenche o genero de todo mundo.
 *
 *   npm run unificar:pessoas -- --simular    (nao grava nada; so mostra o que faria)
 *   npm run unificar:pessoas                 (grava)
 *
 * PRECISA DE BANCO. Roda uma vez, e e idempotente: rodar de novo nao duplica ninguem nem
 * desfaz o que ja foi ajustado a mao depois.
 *
 * POR QUE ISTO EXISTE
 * -------------------
 * As pessoas viviam em duas tabelas. `Irmao` guarda quem tem funcao mecanica — designacoes e
 * dirigentes sao coisa de homens, entao ali so ha irmaos. `CarrinhoPublicador` guarda quem
 * faz carrinho, homens e mulheres, e e a unica das duas que ja tinha telefone. Quem estava
 * nas duas existia duas vezes, com telefone podendo divergir sem ninguem perceber.
 *
 * A confirmacao das partes de estudante precisa do telefone das IRMAS, que so aparecem no
 * carrinho. Dai a unificacao.
 *
 * O QUE ELE FAZ
 * -------------
 *  1. Marca genero='irmao' em todo `Irmao` que ainda esta sem genero.
 *  2. Para cada `CarrinhoPublicador`:
 *       - se ja existe um `Irmao` com o mesmo nome (sem acento/caixa) OU cujo nome CONTENHA
 *         o do publicador, reaproveita esse registro — e o caso do Walney, que o carrinho
 *         registra como "Walney" e o cadastro como "Walney Souza". A primeira versao so
 *         comparava por igualdade, nao casou nenhum dos 33 e duplicou quem estava nas duas
 *         listas;
 *       - se nao existe, cria um `Irmao` com genero='irma', sem funcao nenhuma.
 *     O telefone do carrinho e copiado quando o irmao ainda nao tem um. Nunca sobrescreve:
 *     um numero ja cadastrado a mao vale mais que o importado.
 *  3. Liga cada `CarrinhoEscala` ao `Irmao` correspondente (`irmaoId`), sem apagar o
 *     `publicadorId` — a coluna antiga so sai depois que isto for conferido em producao.
 *  4. Da a funcao 'carrinho' a quem ficou ligado a alguma escala. O carrinho deixou de ter
 *     cadastro proprio: quem aparece la e um `Irmao` com essa funcao, igual as mecanicas.
 *
 * O QUE ELE NAO FAZ
 * -----------------
 * Nao apaga `CarrinhoPublicador` nem a coluna `publicadorId`. Remover coluna trava o deploy
 * do EasyPanel (que usa `db push`), e desfazer uma migracao errada sem a origem seria bem
 * pior do que conviver com uma tabela orfa por uns dias.
 */
const prisma = require('../src/prisma');
const { tokenize } = require('../src/services/MatchIrmaosService');

const simular = process.argv.includes('--simular');

/** Compara nomes como pessoas os escrevem: sem acento, sem caixa, sem espaco sobrando. */
const chaveNome = (nome) =>
    String(nome || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

const log = (...args) => console.log(...args);

async function main() {
    log(simular ? '=== SIMULACAO (nada e gravado) ===\n' : '=== UNIFICACAO DE PESSOAS ===\n');

    const [irmaos, publicadores, escalas] = await Promise.all([
        prisma.irmao.findMany(),
        prisma.carrinhoPublicador.findMany(),
        prisma.carrinhoEscala.findMany(),
    ]);

    log(`irmaos cadastrados:      ${irmaos.length}`);
    log(`publicadores do carrinho: ${publicadores.length}`);
    log(`escalas do carrinho:      ${escalas.length}\n`);

    // ---- 1. genero dos que ja eram Irmao -----------------------------------
    const semGenero = irmaos.filter((i) => !i.genero);
    log(`1) genero='irmao' em ${semGenero.length} irmao(s) sem genero`);
    if (!simular && semGenero.length > 0) {
        await prisma.irmao.updateMany({
            where: { id: { in: semGenero.map((i) => i.id) } },
            data: { genero: 'irmao' },
        });
    }

    // ---- 2. publicadores viram Irmao ---------------------------------------
    const porNome = new Map(irmaos.map((i) => [chaveNome(i.nome), i]));
    let comTokens = irmaos.map((i) => ({ irmao: i, tokens: tokenize(i.nome) }));

    /**
     * Acha o Irmao que ja e esta pessoa.
     *
     * Primeiro por igualdade de nome. Nao achando, aceita quem CONTEM o nome inteiro do
     * publicador ("walney" ⊂ "walney souza") — e so quando ha UM candidato: "Jose" dentro de
     * "Jose Santos" e "Jose Ricardo" nao identifica ninguem, e ai e melhor criar um registro a
     * mais do que fundir duas pessoas diferentes.
     */
    const acharExistente = (nome) => {
        const exato = porNome.get(chaveNome(nome));
        if (exato) return exato;

        const alvo = tokenize(nome);
        if (alvo.length === 0) return null;
        const contem = comTokens.filter((c) => alvo.every((t) => c.tokens.includes(t)));
        return contem.length === 1 ? contem[0].irmao : null;
    };
    const mapaPublicadorParaIrmao = new Map(); // publicadorId -> irmaoId

    let criados = 0;
    let reaproveitados = 0;
    let telefonesCopiados = 0;

    for (const p of publicadores) {
        const existente = acharExistente(p.nome);

        if (existente) {
            reaproveitados += 1;
            mapaPublicadorParaIrmao.set(p.id, existente.id);
            log(`   ja existe em Irmao: "${p.nome}" = "${existente.nome}" -> mantem genero '${existente.genero || 'irmao'}'`);

            // Telefone so entra quando falta: nao sobrescreve o que foi cadastrado a mao.
            if (p.telefone && !existente.telefone) {
                telefonesCopiados += 1;
                if (!simular) {
                    await prisma.irmao.update({
                        where: { id: existente.id },
                        data: { telefone: String(p.telefone).replace(/\D/g, '') || null },
                    });
                }
            }
            continue;
        }

        criados += 1;
        if (simular) {
            log(`   criaria: "${p.nome}" (irma${p.telefone ? ', com telefone' : ', sem telefone'})`);
            continue;
        }

        const novo = await prisma.irmao.create({
            data: {
                nome: p.nome.trim(),
                funcoes: [],
                genero: 'irma',
                telefone: p.telefone ? String(p.telefone).replace(/\D/g, '') || null : null,
                ativo: p.ativo,
            },
        });
        porNome.set(chaveNome(novo.nome), novo);
        comTokens = [...comTokens, { irmao: novo, tokens: tokenize(novo.nome) }];
        mapaPublicadorParaIrmao.set(p.id, novo.id);
        log(`   criado: "${novo.nome}" (irma)`);
    }

    log(`\n2) publicadores: ${criados} criado(s) como irma, ${reaproveitados} ja existiam em Irmao`);
    log(`   telefones copiados para quem nao tinha: ${telefonesCopiados}`);

    // ---- 3. escalas do carrinho apontam para Irmao -------------------------
    const paraLigar = escalas.filter((e) => !e.irmaoId && e.publicadorId);
    log(`\n3) escalas do carrinho a religar: ${paraLigar.length}`);

    let religadas = 0;
    let semDestino = 0;
    for (const escala of paraLigar) {
        const irmaoId = mapaPublicadorParaIrmao.get(escala.publicadorId);
        if (!irmaoId) {
            semDestino += 1;
            continue;
        }
        religadas += 1;
        if (!simular) {
            await prisma.carrinhoEscala.update({
                where: { id: escala.id },
                data: { irmaoId },
            });
        }
    }
    log(`   religadas: ${religadas}${semDestino ? ` | sem destino: ${semDestino}` : ''}`);

    // ---- 4. quem faz carrinho ganha a funcao 'carrinho' --------------------
    // O carrinho deixou de ter cadastro proprio: quem aparece la e um `Irmao` com essa
    // funcao, igual as mecanicas. Sem este passo, quem foi migrado some da tela do carrinho.
    const idsNoCarrinho = new Set([...mapaPublicadorParaIrmao.values()]);
    const jaComFuncao = await prisma.irmao.findMany({
        where: { id: { in: [...idsNoCarrinho] } },
        select: { id: true, nome: true, funcoes: true },
    });
    const faltando = jaComFuncao.filter((i) => !i.funcoes.includes('carrinho'));

    log(`
4) funcao 'carrinho' a dar: ${faltando.length}`);
    if (!simular) {
        for (const i of faltando) {
            await prisma.irmao.update({
                where: { id: i.id },
                data: { funcoes: [...i.funcoes, 'carrinho'] },
            });
        }
    }

    // ---- conferencia -------------------------------------------------------
    log('\n=== CONFERENCIA ===');
    if (simular) {
        log('(simulacao: os numeros acima sao o que seria feito)');
    } else {
        const [totalIrmaos, semGeneroDepois, escalasSoltas] = await Promise.all([
            prisma.irmao.count(),
            prisma.irmao.count({ where: { genero: null } }),
            prisma.carrinhoEscala.count({ where: { irmaoId: null } }),
        ]);
        log(`pessoas em Irmao:            ${totalIrmaos}`);
        log(`ainda sem genero:            ${semGeneroDepois} ${semGeneroDepois === 0 ? '(ok)' : '(CONFERIR)'}`);
        log(`escalas sem irmaoId:         ${escalasSoltas} ${escalasSoltas === 0 ? '(ok)' : '(CONFERIR)'}`);

        const porGenero = await prisma.irmao.groupBy({ by: ['genero'], _count: true });
        porGenero.forEach((g) => log(`  ${g.genero || '(sem)'}: ${g._count}`));
    }

    log('\nA tabela CarrinhoPublicador e a coluna publicadorId continuam de pe de proposito.');
    log('Confira a tela de Pessoas e a escala do carrinho antes de remover as duas.');
}

main()
    .catch((e) => {
        console.error('\nFALHOU:', e.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
