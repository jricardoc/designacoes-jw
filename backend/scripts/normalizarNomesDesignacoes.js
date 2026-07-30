/**
 * Normaliza os nomes gravados nas designacoes para o nome atual do irmao no cadastro.
 *
 *   node scripts/normalizarNomesDesignacoes.js           # dry-run: mostra o plano, nao grava
 *   node scripts/normalizarNomesDesignacoes.js --apply   # grava
 *
 * POR QUE ISSO EXISTE
 * Designacao.irmao1/irmao2 guardam o nome como TEXTO, nao como chave estrangeira. Quem foi
 * renomeado no cadastro depois de ja estar escalado deixou o nome antigo para tras nas
 * designacoes ("Claudio Oliveira" x "Cláudio da Silva Oliveira"), e os quadros mais antigos
 * ainda tem nomes so de primeiro nome, herdados do seed. Um nome orfao custa caro:
 *
 *   - o irmao nao ve as proprias designacoes (MinhasDesignacoesService casa por igualdade
 *     exata) nem recebe o lembrete das 19h;
 *   - ele sai do rodizio do AutoDesignacaoService, que conta o historico por nome;
 *   - ele aparece como "ainda nao designado" no quadro em que esta escalado.
 *
 * O IrmaoController passou a propagar o rename para as designacoes, entao isto aqui e a
 * limpeza do passivo: roda UMA vez por ambiente e depois nao deve mais ter serventia.
 *
 * SEGURANCA
 * - Dry-run por padrao. Sem --apply nada e gravado.
 * - Nunca inventa nome: o destino tem de existir em Irmao.nome.
 * - Nome ambiguo (empate entre irmaos) ou sem match e DEIXADO COMO ESTA e relatado. Errar
 *   aqui e pior que nao mexer: juntaria dois irmaos diferentes numa pessoa so.
 */
const prisma = require('../src/prisma');
const { tokenize, matchStrength } = require('../src/services/MatchIrmaosService');

/**
 * Casos que o matcher por tokens nao resolve sozinho e que foram conferidos com o usuario.
 *   'Nome do irmao' = renomeia para esse irmao (tem de existir no cadastro)
 *   ''              = limpa a celula (vaga em branco, como QuadroController grava um slot vazio)
 *   null            = reconhecido, mas fica como esta
 */
const MAPA_MANUAL = {
    // Grafia diferente ("ley" x "lei"): nao ha token em comum alem do sobrenome, e o unico
    // palpite do matcher seria "Cristian Assad", que e OUTRO irmao.
    'Cristiandley Assad': 'Cristiandlei S. Assad',
    'Cristiandley': 'Cristiandlei S. Assad',
    // "Elesbão" tambem aparece em "Carlos Elesbão" e "Kauã Elesbão", entao o sobrenome nao
    // decide; quem decide e o primeiro nome.
    'Kaique Elesbão': 'Kaique Kevin',
    // Nao existe no cadastro nem parecido: sai do quadro e a vaga de janeiro fica em branco.
    'Rudá': ''
};

const APLICAR = process.argv.includes('--apply');

async function main() {
    const irmaos = await prisma.irmao.findMany({ select: { nome: true } });
    const designacoes = await prisma.designacao.findMany({
        select: { id: true, quadroId: true, data: true, funcao: true, irmao1: true, irmao2: true }
    });

    const cadastro = new Set(irmaos.map((i) => i.nome));
    const irmaosTok = irmaos.map((i) => ({ nome: i.nome, tokens: tokenize(i.nome) }));

    // 1) Quais nomes aparecem nas designacoes sem existir no cadastro, e quantas vezes.
    const ocorrencias = new Map();
    for (const d of designacoes) {
        for (const nome of [d.irmao1, d.irmao2]) {
            if (!nome || !nome.trim() || cadastro.has(nome)) continue;
            ocorrencias.set(nome, (ocorrencias.get(nome) || 0) + 1);
        }
    }

    if (ocorrencias.size === 0) {
        console.log('Nenhum nome orfao nas designacoes. Nada a fazer.');
        return;
    }

    // 2) Resolve cada orfao: mapa manual primeiro, matcher por tokens depois.
    const plano = [];
    const pendentes = [];
    for (const [orfao, vezes] of [...ocorrencias.entries()].sort((a, b) => b[1] - a[1])) {
        if (Object.prototype.hasOwnProperty.call(MAPA_MANUAL, orfao)) {
            const destino = MAPA_MANUAL[orfao];
            if (destino === null) {
                pendentes.push({ orfao, vezes, motivo: 'sem destino no cadastro (mapa manual)' });
            } else if (destino === '') {
                plano.push({ orfao, destino: '', vezes, origem: 'manual (limpa a vaga)' });
            } else if (!cadastro.has(destino)) {
                pendentes.push({ orfao, vezes, motivo: `destino "${destino}" nao existe no cadastro` });
            } else {
                plano.push({ orfao, destino, vezes, origem: 'manual' });
            }
            continue;
        }

        const tokensOrfao = tokenize(orfao);
        const scored = irmaosTok
            .map((it) => ({ nome: it.nome, s: matchStrength(tokensOrfao, it.tokens) }))
            .filter((x) => x.s >= 2);

        if (scored.length === 0) {
            pendentes.push({ orfao, vezes, motivo: 'nenhum irmao parecido' });
            continue;
        }

        const melhor = Math.max(...scored.map((x) => x.s));
        const vencedores = scored.filter((x) => x.s === melhor);
        if (vencedores.length > 1) {
            pendentes.push({
                orfao,
                vezes,
                motivo: `ambiguo entre ${vencedores.map((v) => v.nome).join(' / ')}`
            });
            continue;
        }
        plano.push({ orfao, destino: vencedores[0].nome, vezes, origem: `auto f${melhor}` });
    }

    // 3) Um mesmo irmao nos dois lados da mesma designacao seria efeito colateral da
    //    normalizacao, nao um dado que existia antes: precisa aparecer no relatorio.
    const destinoDe = new Map(plano.map((p) => [p.orfao, p.destino]));
    const resolver = (nome) => destinoDe.get(nome) || nome;
    const colisoes = designacoes.filter((d) => {
        const a = resolver(d.irmao1);
        const b = resolver(d.irmao2);
        return a && b && a === b && !(d.irmao1 === d.irmao2);
    });

    console.log(`\n=== ${APLICAR ? 'APLICANDO' : 'DRY-RUN (use --apply para gravar)'} ===`);
    console.log(`${designacoes.length} designacoes, ${ocorrencias.size} nomes orfaos, ` +
        `${[...ocorrencias.values()].reduce((a, b) => a + b, 0)} ocorrencias\n`);

    console.log(`-- A normalizar (${plano.length}) --`);
    for (const p of plano) {
        console.log(`  ${p.orfao}  ->  ${p.destino || '(vaga em branco)'}   (${p.vezes}x, ${p.origem})`);
    }

    if (pendentes.length) {
        console.log(`\n-- Deixados como estao (${pendentes.length}) --`);
        for (const p of pendentes) console.log(`  ${p.orfao} (${p.vezes}x): ${p.motivo}`);
    }

    if (colisoes.length) {
        console.log(`\n-- ATENCAO: ${colisoes.length} designacao(oes) ficariam com o mesmo irmao nos dois lados --`);
        for (const d of colisoes) {
            console.log(`  designacao ${d.id} (quadro ${d.quadroId}, ${d.data}, ${d.funcao}): ` +
                `"${d.irmao1}" + "${d.irmao2}" -> "${resolver(d.irmao1)}"`);
        }
        console.log('  Resolva essas no app antes de aplicar (ou use --force para gravar assim mesmo).');
    }

    if (!APLICAR) {
        console.log('\nNada foi gravado.');
        return;
    }

    // O aviso de colisao so vale se ele barrar de verdade: a designacao ficaria com o mesmo
    // irmao dos dois lados, o que nenhuma tela do app permite montar.
    if (colisoes.length && !process.argv.includes('--force')) {
        console.log('\nAbortado por causa das colisoes acima. Nada foi gravado.');
        process.exitCode = 1;
        return;
    }

    // Rede de seguranca: um updateMany em massa nao tem desfazer. Antes de gravar, imprime o
    // SQL que restaura celula por celula -- copie do console e guarde ANTES de conferir o
    // resultado no app.
    const sql = (s) => `'${String(s).replace(/'/g, "''")}'`;
    const undo = [];
    for (const d of designacoes) {
        for (const campo of ['irmao1', 'irmao2']) {
            const atual = d[campo];
            if (!atual || !destinoDe.has(atual)) continue;
            undo.push(`UPDATE "Designacao" SET "${campo}" = ${sql(atual)} WHERE id = ${d.id};`);
        }
    }
    console.log(`\n-- DESFAZER (${undo.length} comando(s)) — guarde antes de continuar --`);
    for (const linha of undo) console.log(linha);

    // Uma transacao: o quadro nao fica meio normalizado se algo falhar no meio.
    const updates = plano.flatMap((p) => [
        prisma.designacao.updateMany({ where: { irmao1: p.orfao }, data: { irmao1: p.destino } }),
        prisma.designacao.updateMany({ where: { irmao2: p.orfao }, data: { irmao2: p.destino } })
    ]);
    const resultados = await prisma.$transaction(updates);
    const total = resultados.reduce((soma, r) => soma + r.count, 0);
    console.log(`\n${total} celula(s) de designacao atualizada(s).`);
}

main()
    .catch((e) => {
        console.error('Falhou (nada foi gravado se o erro veio da transacao):', e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
