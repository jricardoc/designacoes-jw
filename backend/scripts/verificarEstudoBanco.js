/**
 * O fluxo do estudo pessoal com banco de verdade: perfil, trechos lidos (sem duplicar, com a
 * joia), assuntos com link so do jw.org, sessao pelo cronometro (concluir uma vez so), estudo
 * registrado a mao, aviso da rotina sem repetir e plano B so para quem nao leu. E cada um so o seu.
 *
 *   ZOOM_TESTE_BANCO=1 DATABASE_URL=postgres://.../banco_descartavel npm run verificar:estudo-banco
 *
 * SO num banco descartavel, com as migrations aplicadas (npm run migrar): o teste cria dados.
 * Nomes inventados.
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
    const E = require('../src/services/EstudoService');
    const { relogioDaCongregacao } = require('../src/services/RegrasLembrete');
    /** O instante em que o relogio da congregacao marca `dia hora`. */
    const noRelogio = (dia, hora) => {
        const base = new Date(`${dia}T${hora}:00Z`);
        return new Date(base.getTime() - (relogioDaCongregacao(base).getTime() - base.getTime()));
    };

    const usuario = (nickname) =>
        prisma.usuario.create({ data: { nickname, nome: nickname, senha: 'x' }, select: { id: true, isAdmin: true, escopos: true, irmaoId: true } });
    const ana = await usuario('ana-estudo');
    const bia = await usuario('bia-estudo');
    await prisma.pushToken.create({ data: { usuarioId: ana.id, token: 'ExponentPushToken[ana-estudo]' } });
    await prisma.pushToken.create({ data: { usuarioId: bia.id, token: 'ExponentPushToken[bia-estudo]' } });

    console.log('perfil');
    const e0 = await E.estado(ana);
    ok(e0.perfil.plano === 'jw' && e0.perfil.inicio === null && e0.leituras.length === 0, 'sem nada salvo: o programa do jw.org, ainda sem inicio', e0.perfil);
    ok((await E.atualizarPerfil(ana, { plano: 'jw', opcao: 'vermelho', inicio: e0.hoje, ritmo: 2 })).perfil.opcao === 'vermelho', 'escolhe o programa, o ritmo e o inicio');
    ok((await E.atualizarPerfil(ana, { ritmo: 5 })).erro === 400, 'ritmo invalido: 400');

    console.log('trechos lidos');
    await E.marcarLeituras(ana, { plano: 'jw', itens: ['1:1-3', '1:4-7'] });
    await E.marcarLeituras(ana, { plano: 'jw', itens: ['1:1-3'] });
    await E.marcarLeituras(ana, { plano: 'livre', itens: ['43:3'], nota: 'Jeová amou o mundo' });
    const e1 = await E.estado(ana);
    ok(e1.leituras.length === 3 && e1.leituras.every((l) => l.dia === e1.hoje), 'marca em lote, sem duplicar, no dia de hoje', e1.leituras);
    ok(e1.leituras.find((l) => l.item === '43:3').nota === 'Jeová amou o mundo', 'a joia espiritual fica no trecho (e marca como lido)');
    await E.marcarLeituras(ana, { plano: 'jw', itens: ['1:4-7'], lido: false });
    ok((await E.estado(ana)).leituras.length === 2, 'desmarca');
    ok((await E.estado(bia)).leituras.length === 0, 'a outra pessoa nao ve as leituras dela');
    ok((await E.marcarLeituras(ana, { plano: 'jw', itens: ['<x>'] })).erro === 400, 'trecho invalido: 400');
    ok((await E.marcarLeituras(ana, { plano: 'jw', itens: ['1:1-3', '1:4-7'], nota: 'x' })).erro === 400, 'anotacao de dois trechos: 400');
    ok((await E.marcarLeituras(ana, { plano: 'livre', itens: ['19:151'] })).erro === 400, 'leitura livre: so capitulo que existe');
    // Marcada sem internet, chega depois com `em`: conta o dia em que foi lida.
    const ontem = new Date(Date.now() - 86400000);
    await E.marcarLeituras(ana, { plano: 'livre', itens: ['1:1'], em: ontem.getTime() });
    const lidaOntem = await prisma.leituraFeita.findFirst({ where: { usuarioId: ana.id, plano: 'livre', item: '1:1' } });
    ok(lidaOntem && lidaOntem.dia === relogioDaCongregacao(ontem).toISOString().slice(0, 10), 'marcada sem internet: conta o dia em que foi lida', lidaOntem);
    ok((await E.marcarLeituras(ana, { plano: 'livre', itens: ['1:2'], em: Date.now() - 15 * 86400000 })).erro === 400, 'guardada ha mais de 14 dias: 400');
    await prisma.leituraFeita.deleteMany({ where: { usuarioId: ana.id, plano: 'livre', item: '1:1' } });

    console.log('assuntos');
    const a1 = (await E.criarAssunto(ana, { titulo: 'A oração de Ana', tipo: 'oracao', link: 'https://wol.jw.org/pt/wol/b/r5/lp-t/nwtsty/9/2' })).assunto;
    ok(a1 && a1.link === 'https://wol.jw.org/pt/wol/b/r5/lp-t/nwtsty/9/2', 'assunto com link da Biblioteca On-line');
    ok((await E.criarAssunto(ana, { titulo: 'x', link: 'https://exemplo.com/' })).erro === 400, 'link de fora do jw.org: 400');
    ok((await E.atualizarAssunto(bia, a1.id, { titulo: 'outro' })).erro === 404 && (await E.apagarAssunto(bia, a1.id)).erro === 404, 'a outra pessoa nao mexe no assunto dela');

    console.log('sessao de estudo');
    const t0 = new Date();
    const depois = (min) => new Date(t0.getTime() + min * 60000);
    ok(!(await E.sessao(ana, { acao: 'iniciar', assuntoId: a1.id }, t0)).erro, 'inicia com o assunto escolhido');
    const iniciouDeNovo = await E.sessao(ana, { acao: 'iniciar' }, depois(5));
    ok(new Date(iniciouDeNovo.perfil.sessaoInicio).getTime() === t0.getTime(), 'iniciar com ele rodando nao recomeca');
    const c1 = await E.sessao(ana, { acao: 'concluir', resumo: 'Jeová ouve', aplicacao: 'Orar com mais confiança', estudado: true, ideias: ['A oração de Ezequias', ' '] }, depois(25));
    ok(c1.sessao && c1.sessao.minutos === 25 && c1.sessao.titulo === 'A oração de Ana' && c1.ideias === 1, 'conclui: 25 min, o titulo do assunto e uma ideia nova', c1);
    ok((await E.sessao(ana, { acao: 'concluir' }, depois(26))).erro === 409, 'concluir de novo: 409');
    const e2 = await E.estado(ana);
    ok(e2.assuntos.find((a) => a.id === a1.id).estudadoEm && e2.assuntos.some((a) => a.titulo === 'A oração de Ezequias'), 'o assunto fica estudado e a ideia entra na lista');
    ok(!e2.perfil.sessaoInicio && e2.sessoes[0].resumo === 'Jeová ouve', 'o cronometro para e o resumo fica na sessao');
    await E.sessao(ana, { acao: 'iniciar' }, depois(30));
    const corridas = await Promise.all([E.sessao(ana, { acao: 'concluir' }, depois(40)), E.sessao(ana, { acao: 'concluir' }, depois(40))]);
    ok(corridas.filter((c) => c.sessao).length === 1, 'dois "concluir" ao mesmo tempo gravam uma sessao so', corridas);
    await E.sessao(ana, { acao: 'iniciar' }, depois(50));
    const corrigida = await E.sessao(ana, { acao: 'concluir', minutos: 999 }, depois(70));
    ok(corrigida.sessao.minutos === 20, 'o app corrige para menos, nunca para mais', corrigida.sessao);
    ok((await E.registrarSessao(ana, { dia: e2.hoje, minutos: 10, titulo: 'Texto do dia' })).sessao.minutos === 10, 'estudo registrado a mao');
    ok((await E.registrarSessao(ana, { dia: '2999-01-01', minutos: 10 })).erro === 400, 'dia no futuro: 400');
    ok((await E.apagarSessao(bia, c1.sessao.id)).erro === 404, 'a outra pessoa nao apaga o estudo dela');

    console.log('rotina e avisos');
    // 03/11/2026 e uma terca (dia 2).
    const rotina = (await E.criarRotina(ana, { tipo: 'estudo', dias: [2, 4], hora: '20:00', avisoMin: 15 })).rotina;
    ok(rotina && rotina.dias.join() === '2,4', 'rotina de terca e quinta, 20:00, aviso 15 min antes');
    ok((await E.atualizarRotina(bia, rotina.id, { tipo: 'estudo', dias: [1], hora: '20:00' })).erro === 404, 'a outra pessoa nao mexe na rotina dela');
    const doEstudo = () => enviados.filter((m) => m.to === 'ExponentPushToken[ana-estudo]' && m.title === 'Hora do estudo pessoal').length;
    await E.avisarRotina(noRelogio('2026-11-03', '19:30'));
    ok(doEstudo() === 0, 'antes da hora, nada');
    await E.avisarRotina(noRelogio('2026-11-03', '19:45'));
    ok(doEstudo() === 1, 'no tique das 19:45, o aviso do estudo das 20:00');
    await E.avisarRotina(noRelogio('2026-11-03', '20:00'));
    ok(doEstudo() === 1, 'o tique seguinte nao repete');
    await E.avisarRotina(noRelogio('2026-11-04', '19:45'));
    ok(doEstudo() === 1, 'na quarta, que nao esta na rotina, nada');
    ok(enviados.find((m) => m.title === 'Hora do estudo pessoal').body.includes('Assunto: A oração de Ezequias.'), 'o aviso diz o assunto da vez (o mais antigo ainda nao estudado)');

    // Quinta (05/11): avisou as 19:45; editar as 19:50 nao avisa de novo no tique das 20:00.
    await E.avisarRotina(noRelogio('2026-11-05', '19:45'));
    ok(doEstudo() === 2, 'quinta: avisou');
    await E.atualizarRotina(ana, rotina.id, { tipo: 'estudo', dias: [2, 4], hora: '20:00', avisoMin: 15 }, noRelogio('2026-11-05', '19:50'));
    await E.avisarRotina(noRelogio('2026-11-05', '20:00'));
    ok(doEstudo() === 2, 'editar depois do aviso nao repete');

    // A leitura das 06:30 (aviso na hora): quem ja leu no dia nao recebe.
    await E.criarRotina(bia, { tipo: 'leitura', dias: [2], hora: '06:30', avisoMin: 0 }, noRelogio('2026-11-02', '12:00'));
    await prisma.leituraFeita.create({ data: { usuarioId: bia.id, plano: 'livre', item: '1:2', dia: '2026-11-03' } });
    await E.avisarRotina(noRelogio('2026-11-03', '06:30'));
    ok(!enviados.some((m) => m.to === 'ExponentPushToken[bia-estudo]' && m.title === 'Hora da leitura da Bíblia'), 'ja leu hoje: sem o lembrete da leitura');

    // Plano B: a Ana nao leu no dia 03/11; a Bia leu.
    await E.atualizarPerfil(ana, { planoB: '21:00' }, noRelogio('2026-11-03', '12:00'));
    await E.atualizarPerfil(bia, { planoB: '21:00' }, noRelogio('2026-11-03', '12:00'));
    await prisma.leituraFeita.create({ data: { usuarioId: bia.id, plano: 'livre', item: '1:1', dia: '2026-11-03' } });
    // (as duas escolheram o plano B antes da hora dele)
    const planoB = (token) => enviados.filter((m) => m.to === token && m.title === 'Ainda dá tempo de ler hoje').length;
    await E.avisarRotina(noRelogio('2026-11-03', '21:00'));
    ok(planoB('ExponentPushToken[ana-estudo]') === 1 && planoB('ExponentPushToken[bia-estudo]') === 0, 'plano B: avisa quem nao leu, e so ela');
    await E.avisarRotina(noRelogio('2026-11-03', '21:15'));
    ok(planoB('ExponentPushToken[ana-estudo]') === 1, 'o plano B nao repete no dia');
    ok(enviados.some((m) => m.data && m.data.screen === 'estudo'), 'o push leva ao ambiente do estudo');

    return falhas;
}

module.exports = { rodar };

if (require.main === module) {
    if (process.env.ZOOM_TESTE_BANCO !== '1') {
        console.error('Este teste grava dados. Rode so num banco descartavel: ZOOM_TESTE_BANCO=1 DATABASE_URL=... npm run verificar:estudo-banco');
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
