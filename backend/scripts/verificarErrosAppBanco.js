/**
 * Os erros do app com banco de verdade: o mesmo erro soma `vezes` (inclusive vindo de outra
 * pessoa), erros diferentes viram linhas diferentes, a lista traz quem viu por ultimo e limpar
 * apaga tudo.
 *
 *   ZOOM_TESTE_BANCO=1 DATABASE_URL=postgres://.../banco_descartavel npm run verificar:erros-app-banco
 *
 * SO num banco descartavel, com as migrations aplicadas (npm run migrar): o teste cria e apaga
 * dados. Nomes inventados.
 */

async function rodar(prisma) {
    let falhas = 0;
    const ok = (cond, descricao, extra) => {
        if (cond) console.log(`   ok   ${descricao}`);
        else {
            falhas += 1;
            console.log(`   FALHA ${descricao}${extra !== undefined ? `\n         ${JSON.stringify(extra)}` : ''}`);
        }
    };
    const E = require('../src/services/ErroAppService');

    const usuario = (nickname) => prisma.usuario.create({ data: { nickname, nome: nickname, senha: 'x' }, select: { id: true } });
    const ana = await usuario('ana-erros');
    const bia = await usuario('bia-erros');
    const erro = { mensagem: 'TypeError: x is undefined', tela: '/estudo', updateId: 'u1', plataforma: 'ios', pilha: 'TypeError\n    at Hoje (i:1:2)' };

    console.log('registrar');
    ok((await E.registrar(ana, { erros: [erro, { mensagem: '' }] })).recebidos === 1, 'o vazio fica de fora');
    await E.registrar(bia, { erros: [erro] });
    await new Promise((r) => setTimeout(r, 5));
    await E.registrar(bia, { erros: [{ ...erro, tela: '/ministerio' }] });
    const { erros } = await E.listar();
    const mesmo = erros.find((e) => e.tela === '/estudo');
    ok(erros.length === 2, 'o mesmo erro e uma linha; outra tela, outra', erros.map((e) => e.tela));
    ok(mesmo && mesmo.vezes === 2 && mesmo.usuario === 'bia-erros', 'soma as vezes e guarda quem viu por ultimo', mesmo);
    ok(erros[0].tela === '/ministerio', 'o mais recente primeiro');
    ok(!('assinatura' in mesmo) && !('usuarioId' in mesmo), 'a lista nao leva a assinatura nem o id');
    ok((await E.registrar(ana, { erros: Array.from({ length: 30 }, (_, i) => ({ mensagem: `e${i}` })) })).recebidos === 20, 'no maximo 20 por envio');
    ok((await E.registrar(ana, {})).recebidos === 0, 'sem lista: nada');

    console.log('limpar');
    ok((await E.limpar()).apagados === 22, 'apaga tudo');
    ok((await E.listar()).erros.length === 0, 'a lista fica vazia');

    await prisma.usuario.deleteMany({ where: { id: { in: [ana.id, bia.id] } } });
    return falhas;
}

module.exports = { rodar };

if (require.main === module) {
    if (process.env.ZOOM_TESTE_BANCO !== '1') {
        console.error('Este teste grava dados. Rode so num banco descartavel: ZOOM_TESTE_BANCO=1 DATABASE_URL=... npm run verificar:erros-app-banco');
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
