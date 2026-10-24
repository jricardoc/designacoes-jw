/**
 * O proprio irmao confirma a parte de estudante, com banco de verdade: a resposta aparece em
 * Minhas designacoes e na tela de Confirmacoes (e a mesma linha), o "nao posso" avisa por push
 * quem cuida das confirmacoes (uma vez so), e ninguem responde a parte de outro nem a de reuniao
 * que ja passou.
 *
 *   ZOOM_TESTE_BANCO=1 DATABASE_URL=postgres://.../banco_descartavel npm run verificar:confirmar-parte-banco
 *
 * SO num banco descartavel, com as migrations aplicadas (npm run migrar): o teste cria e apaga
 * dados. Nomes inventados.
 */

async function rodar(prisma, { enviados = [] } = {}) {
    let falhas = 0;
    const ok = (cond, descricao, extra) => {
        if (cond) console.log(`   ok   ${descricao}`);
        else {
            falhas += 1;
            console.log(`   FALHA ${descricao}${extra !== undefined ? `\n         ${JSON.stringify(extra)}` : ''}`);
        }
    };
    const M = require('../src/services/MinhasDesignacoesService');
    const C = require('../src/services/ConfirmacaoDesignacaoService');

    const irmao = await prisma.irmao.create({ data: { nome: 'Ana Teste Lima' } });
    const usuario = (nickname, dados = {}) =>
        prisma.usuario.create({ data: { nickname, nome: nickname, senha: 'x', ...dados }, select: { id: true, isAdmin: true, escopos: true, irmaoId: true } });
    const ana = await usuario('ana-confirma', { irmaoId: irmao.id });
    const resp = await usuario('resp-confirma', { escopos: ['confirmacoes'] });
    const admin = await usuario('admin-confirma', { isAdmin: true });
    const outro = await usuario('outro-confirma');
    for (const u of [ana, resp, admin, outro]) {
        await prisma.pushToken.create({ data: { usuarioId: u.id, token: `ExponentPushToken[${u.id}-confirma]` } });
    }

    const reuniao = await prisma.reuniao.create({ data: { mes: 11, ano: 2099 } });
    const semana = await prisma.semanaReuniao.create({
        data: {
            reuniaoId: reuniao.id,
            faixaData: 'Semana de teste',
            dataReuniao: '05/11/2099',
            tesouro3_principal: 'Ana Teste Lima',
            ministerio2_salaB: 'Bia Teste Souza / Ana Teste Lima',
            ministerio3_principal: 'Bia Teste Souza',
            oracaoInicial: 'Ana Teste Lima',
        },
    });
    const passada = await prisma.semanaReuniao.create({
        data: { reuniaoId: reuniao.id, faixaData: 'Semana antiga', dataReuniao: '01/01/2020', tesouro3_principal: 'Ana Teste Lima' },
    });
    const id = (campo, s = semana) => `reuniao-${s.id}-${campo}`;
    const minhas = async () => (await M.listarPorIrmao(irmao)).filter((c) => c.origem?.tipo === 'reuniao' && c.dataISO === '2099-11-05');
    const naTela = async (campo, nome = 'Ana Teste Lima') =>
        (await C.listar()).reunioes.flatMap((r) => r.partes).find((p) => p.data === '05/11/2099' && p.campo === campo && p.nome === nome)?.confirmou;

    console.log('o que Minhas designacoes mostra');
    const antes = await minhas();
    const leitura = antes.find((c) => c.id === id('tesouro3_principal'));
    ok(leitura && leitura.confirmacao && leitura.confirmacao.confirmou === null, 'a parte de estudante vem sem resposta', leitura);
    ok(antes.find((c) => c.id === id('ministerio2_salaB'))?.confirmacao?.confirmou === null, 'a parte em dupla tambem (a linha e a dela)');
    ok(antes.find((c) => c.id === id('oracaoInicial')) && !antes.find((c) => c.id === id('oracaoInicial')).confirmacao, 'a oracao nao pede confirmacao');

    console.log('confirmar');
    ok((await M.confirmarParte(ana, { id: id('tesouro3_principal'), confirmou: true })).confirmou === true, 'confirmo');
    ok((await minhas()).find((c) => c.id === id('tesouro3_principal')).confirmacao.confirmou === true, 'Minhas designacoes mostra confirmada');
    ok((await naTela('tesouro3_principal')) === true, 'a tela de Confirmacoes ve a mesma resposta');
    ok(enviados.length === 0, 'confirmar nao avisa ninguem');

    console.log('nao posso');
    await M.confirmarParte(ana, { id: id('ministerio2_salaB'), confirmou: false });
    const tokens = enviados.map((m) => m.to).sort();
    ok(tokens.length === 2 && tokens.includes(`ExponentPushToken[${resp.id}-confirma]`) && tokens.includes(`ExponentPushToken[${admin.id}-confirma]`), 'avisa quem cuida das confirmacoes e o admin geral (nao ela, nem os outros)', tokens);
    ok(enviados.every((m) => m.data.screen === 'confirmacoes' && m.body.includes('Ana Teste Lima') && m.body.includes('05/11') && m.body.includes('Sala B')), 'o aviso diz quem, quando e onde, e abre as Confirmacoes', enviados[0]);
    ok((await naTela('ministerio2_salaB')) === false && (await naTela('ministerio2_salaB', 'Bia Teste Souza')) === null, 'so a linha dela muda, nao a da dupla');
    await M.confirmarParte(ana, { id: id('ministerio2_salaB'), confirmou: false });
    ok(enviados.length === 2, 'o mesmo "nao posso" de novo nao avisa outra vez');
    ok((await M.confirmarParte(ana, { id: id('ministerio2_salaB'), confirmou: null })).confirmou === null && (await naTela('ministerio2_salaB')) === null, 'desfaz (volta a sem resposta)');

    console.log('o que nao pode');
    ok((await M.confirmarParte(ana, { id: id('ministerio3_principal'), confirmou: true })).erro === 404, 'a parte de outra pessoa: 404');
    ok((await M.confirmarParte(ana, { id: id('oracaoInicial'), confirmou: true })).erro === 400, 'parte que nao pede confirmacao: 400');
    ok((await M.confirmarParte(ana, { id: id('tesouro3_principal', passada), confirmou: true })).erro === 400, 'reuniao que ja passou: 400');
    ok((await M.confirmarParte(outro, { id: id('tesouro3_principal'), confirmou: true })).erro === 403, 'conta sem cadastro ligado: 403');
    ok((await M.confirmarParte(ana, { id: id('tesouro3_principal'), confirmou: 'sim' })).erro === 400, 'resposta invalida: 400');
    ok((await M.confirmarParte(ana, { id: 'designacao-1', confirmou: true })).erro === 400, 'designacao que nao e da reuniao: 400');

    await prisma.confirmacaoDesignacao.deleteMany({ where: { data: { in: ['05/11/2099', '01/01/2020'] } } });
    await prisma.reuniao.delete({ where: { id: reuniao.id } });
    await prisma.usuario.deleteMany({ where: { id: { in: [ana.id, resp.id, admin.id, outro.id] } } });
    await prisma.irmao.delete({ where: { id: irmao.id } });
    return falhas;
}

module.exports = { rodar };

if (require.main === module) {
    if (process.env.ZOOM_TESTE_BANCO !== '1') {
        console.error('Este teste grava dados. Rode so num banco descartavel: ZOOM_TESTE_BANCO=1 DATABASE_URL=... npm run verificar:confirmar-parte-banco');
        process.exit(1);
    }
    const prisma = require('../src/prisma');
    rodar(prisma)
        .then(async (falhas) => {
            await prisma.$disconnect();
            console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
            process.exit(falhas ? 1 : 0);
        })
        .catch((e) => {
            console.error(e);
            process.exit(1);
        });
}
