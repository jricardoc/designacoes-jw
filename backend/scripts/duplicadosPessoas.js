/**
 * Encontra (e opcionalmente junta) pessoas que ficaram duplicadas em `Irmao`.
 *
 *   npm run pessoas:duplicados            lista os candidatos, NAO grava nada
 *   npm run pessoas:duplicados -- --juntar  junta os pares confirmados
 *
 * PRECISA DE BANCO.
 *
 * POR QUE ISTO EXISTE
 * -------------------
 * `unificarPessoas.js` casa nome por igualdade exata (sem acento e sem caixa). Isso e cego
 * para a diferenca mais comum entre as duas listas: o carrinho registra "Walney" e o cadastro
 * registra "Walney Souza". Na migracao de 2026-08-27 nenhum dos 33 publicadores casou, e quem
 * ja existia em `Irmao` ganhou um segundo registro — com o genero errado, porque o script
 * assume 'irma' para quem vem do carrinho.
 *
 * COMO ELE ACHA
 * -------------
 * Nao da para usar o `matchStrength` da importacao aqui: ele da a MESMA forca (2) para
 * "Walney" x "Walney Souza" e para "Jose Santos" x "Jose Ricardo" — o primeiro par e a mesma
 * pessoa, o segundo sao dois irmaos diferentes. Criterio bom para sugerir, pessimo para
 * apagar registro.
 *
 * O criterio aqui e mais estreito e usa o que se sabe da migracao:
 *   - de um lado, os registros CRIADOS por ela: nome identico ao de um CarrinhoPublicador;
 *   - do outro, os que ja existiam;
 *   - e o par so vale quando TODOS os nomes do criado aparecem no que ja existia
 *     ("walney" ⊂ "walney souza"). "Jose Santos" nao esta contido em "Jose Ricardo", entao
 *     esse par nem e cogitado.
 *
 * Quando um criado casa com MAIS DE UM que ja existia, ninguem e apagado: o script mostra os
 * candidatos e deixa a decisao com quem conhece a congregacao.
 *
 * COMO ELE JUNTA
 * --------------
 * Fica o registro MAIS COMPLETO — o que tem funcoes, privilegio ou usuario vinculado, que e
 * sempre o do cadastro antigo. Do duplicado vem o que ele tiver de util: as escalas do
 * carrinho, e o telefone quando o principal nao tem. Depois o duplicado e apagado.
 *
 * O genero do principal e PRESERVADO. E o que conserta o Walney: ele volta a ser 'irmao'.
 */
const prisma = require('../src/prisma');
const { tokenize } = require('../src/services/MatchIrmaosService');

const juntar = process.argv.includes('--juntar');

/** Compara nomes como pessoas os escrevem: sem acento, sem caixa, sem espaco sobrando. */
const chaveNome = (nome) =>
    String(nome || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

/** Quanto "cadastro de verdade" um registro tem. O maior vence e sobrevive. */
function peso(irmao) {
    return (
        (irmao.funcoes?.length || 0) * 10 +
        (irmao.privilegio ? 5 : 0) +
        (irmao._temUsuario ? 100 : 0) +
        (irmao.nome.trim().split(/\s+/).length > 1 ? 1 : 0) // nome completo desempata
    );
}

async function main() {
    console.log(juntar ? '=== JUNTANDO DUPLICADOS ===\n' : '=== DUPLICADOS (nada e gravado) ===\n');

    const irmaos = await prisma.irmao.findMany({
        include: {
            usuario: { select: { id: true } },
            _count: { select: { carrinhoEscalas: true, indisponibilidades: true, dirigenteSaidas: true } },
        },
        orderBy: { id: 'asc' },
    });

    const publicadores = await prisma.carrinhoPublicador.findMany({ select: { nome: true } });
    const nomesDoCarrinho = new Set(publicadores.map((p) => chaveNome(p.nome)));

    const comTokens = irmaos.map((i) => ({
        ...i,
        _temUsuario: !!i.usuario,
        _veioDoCarrinho: nomesDoCarrinho.has(chaveNome(i.nome)),
        tokens: tokenize(i.nome),
    }));

    const criados = comTokens.filter((i) => i._veioDoCarrinho);
    const jaExistiam = comTokens.filter((i) => !i._veioDoCarrinho);

    const pares = [];
    const ambiguos = [];
    for (const novo of criados) {
        if (novo.tokens.length === 0) continue;
        const contem = jaExistiam.filter((velho) =>
            novo.tokens.every((t) => velho.tokens.includes(t)));
        if (contem.length === 0) continue;
        if (contem.length > 1) {
            ambiguos.push([novo, contem]);
            continue;
        }
        pares.push([contem[0], novo]);
    }

    for (const [novo, candidatos] of ambiguos) {
        console.log(`  AMBIGUO: "${novo.nome}" (#${novo.id}) parece ser um destes:`);
        candidatos.forEach((c) => console.log(`           #${c.id} "${c.nome}"`));
        console.log('           nenhum foi tocado — resolva a mao.\n');
    }

    if (pares.length === 0) {
        console.log('Nenhum par duplicado para juntar.');
        return;
    }

    console.log(`${pares.length} par(es) que sao a mesma pessoa:\n`);

    for (const [velho, novo] of pares) {
        // Quem fica e sempre o do cadastro antigo: tem funcoes, privilegio e o genero certo.
        // O `peso` so confirma isso e aparece no log para a decisao ficar visivel.
        const [fica, sai] = peso(velho) >= peso(novo) ? [velho, novo] : [novo, velho];

        console.log(`  FICA: #${fica.id} "${fica.nome}" (${fica.genero || 'sem genero'})`);
        console.log(`        funcoes=${fica.funcoes.length} escalas=${fica._count.carrinhoEscalas} tel=${fica.telefone || '-'}${fica._temUsuario ? ' [tem usuario]' : ''}`);
        console.log(`  SAI:  #${sai.id} "${sai.nome}" (${sai.genero || 'sem genero'})`);
        console.log(`        funcoes=${sai.funcoes.length} escalas=${sai._count.carrinhoEscalas} tel=${sai.telefone || '-'}${sai._temUsuario ? ' [tem usuario]' : ''}`);

        if (sai._temUsuario) {
            console.log('  !!    o que sairia tem USUARIO vinculado — pulado, resolva a mao\n');
            continue;
        }

        if (!juntar) {
            console.log('  ->    (simulacao)\n');
            continue;
        }

        // Escalas do carrinho passam para quem fica, sem criar repetida no mesmo turno.
        const escalasDoSai = await prisma.carrinhoEscala.findMany({ where: { irmaoId: sai.id } });
        const turnosDoFica = new Set(
            (await prisma.carrinhoEscala.findMany({ where: { irmaoId: fica.id } })).map((e) => e.turnoId)
        );

        let movidas = 0;
        let descartadas = 0;
        for (const escala of escalasDoSai) {
            if (turnosDoFica.has(escala.turnoId)) {
                await prisma.carrinhoEscala.delete({ where: { id: escala.id } });
                descartadas += 1;
                continue;
            }
            await prisma.carrinhoEscala.update({ where: { id: escala.id }, data: { irmaoId: fica.id } });
            turnosDoFica.add(escala.turnoId);
            movidas += 1;
        }

        // Telefone so entra quando falta em quem fica.
        const dados = {};
        if (!fica.telefone && sai.telefone) dados.telefone = sai.telefone;
        // Genero: se quem fica esta sem, herda; se tem, MANTEM — e o que devolve o Walney
        // para 'irmao' em vez de deixar o 'irma' que a migracao chutou.
        if (!fica.genero && sai.genero) dados.genero = sai.genero;
        if (Object.keys(dados).length > 0) {
            await prisma.irmao.update({ where: { id: fica.id }, data: dados });
        }

        await prisma.irmao.delete({ where: { id: sai.id } });
        console.log(`  ->    juntado: ${movidas} escala(s) movida(s)${descartadas ? `, ${descartadas} repetida(s) descartada(s)` : ''}, #${sai.id} apagado\n`);
    }

    if (!juntar) {
        console.log('Nada foi gravado. Rode com  -- --juntar  para aplicar.');
        return;
    }

    const [total, semGenero, escalasSoltas] = await Promise.all([
        prisma.irmao.count(),
        prisma.irmao.count({ where: { genero: null } }),
        prisma.carrinhoEscala.count({ where: { irmaoId: null } }),
    ]);
    console.log('=== CONFERENCIA ===');
    console.log(`pessoas em Irmao:    ${total}`);
    console.log(`sem genero:          ${semGenero} ${semGenero === 0 ? '(ok)' : '(CONFERIR)'}`);
    console.log(`escalas sem irmaoId: ${escalasSoltas} ${escalasSoltas === 0 ? '(ok)' : '(CONFERIR)'}`);
}

main()
    .catch((e) => {
        console.error('\nFALHOU:', e.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
