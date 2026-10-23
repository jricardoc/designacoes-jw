/**
 * O fluxo da area de pioneiros com banco de verdade: quem entra, cronometro (com pausa e com
 * dois "parar" ao mesmo tempo), horas, meta, revisitas de um que o outro nao ve, aviso da visita
 * marcada e o relatorio que cai no grupo.
 *
 *   ZOOM_TESTE_BANCO=1 DATABASE_URL=postgres://.../banco_descartavel npm run verificar:pioneiros-banco
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
    const P = require('../src/services/PioneiroService');
    const hoje = require('../src/services/RegrasLembrete').relogioDaCongregacao(new Date()).toISOString().slice(0, 10);
    const mes = hoje.slice(0, 7);

    // ---- cadastro ----
    const grupo = await prisma.grupoCampo.create({ data: { nome: 'Grupo Pioneiro Teste', numero: 91 } });
    const irmao = async (nome, extra = {}) => prisma.irmao.create({ data: { nome, funcoes: [], ...extra } });
    const pioneira = await irmao('Pioneira Teste', { pioneiro: 'regular', grupoId: grupo.id });
    const publicador = await irmao('Publicador Teste');
    const adminIrmao = await irmao('Admin Teste');
    const usuario = (nickname, irmaoId, isAdmin = false) =>
        prisma.usuario.create({ data: { nickname, nome: nickname, senha: 'x', irmaoId, isAdmin }, select: { id: true, isAdmin: true, escopos: true, irmaoId: true } });
    const uPioneira = await usuario('pioneira-teste', pioneira.id);
    const uPublicador = await usuario('publicador-teste', publicador.id);
    const uAdmin = await usuario('admin-teste', adminIrmao.id, true);
    const uAdminSemCadastro = await usuario('admin-sem-cadastro', null, true);
    await prisma.pushToken.create({ data: { usuarioId: uPioneira.id, token: 'ExponentPushToken[pioneira]' } });

    console.log('quem entra');
    ok((await P.painel(uPublicador)).erro === 403, 'publicador comum: 403');
    ok((await P.painel(uAdminSemCadastro)).erro === 403, 'admin sem cadastro ligado: 403 (nao ha de quem sao as horas)');
    const p0 = await P.painel(uPioneira);
    ok(p0.regular && p0.meta === 50 && p0.metaAno === 600 && !p0.cronometro.rodando && p0.minutosMes === 0, 'pioneira: meta de 50 h e cronometro parado', p0);
    ok(!(await P.painel(uAdmin)).erro, 'admin geral com cadastro entra');

    console.log('cronometro');
    const t0 = new Date();
    const min = (n) => new Date(t0.getTime() + n * 60000);
    await P.cronometro(uPioneira, 'iniciar', t0);
    let c = await P.cronometro(uPioneira, 'pausar', min(30));
    ok(!c.cronometro.rodando && c.cronometro.acumuladoSeg === 1800, 'pausa guarda os 30 min', c.cronometro);
    await P.cronometro(uPioneira, 'iniciar', min(40));
    c = await P.cronometro(uPioneira, 'iniciar', min(41));
    ok(c.cronometro.rodando && new Date(c.cronometro.inicio).getTime() === min(40).getTime(), 'iniciar de novo com ele rodando nao recomeca');
    const [a, b] = await Promise.all([P.cronometro(uPioneira, 'parar', min(70)), P.cronometro(uPioneira, 'parar', min(70))]);
    const registros = [a.registro, b.registro].filter(Boolean);
    ok(registros.length === 1 && registros[0].minutos === 60 && registros[0].origem === 'cronometro', 'parar lanca 1 h; dois "parar" ao mesmo tempo nao lancam duas vezes', [a.registro, b.registro]);
    c = await P.cronometro(uPioneira, 'parar', min(80));
    ok(!c.registro && !c.cronometro.rodando && c.cronometro.acumuladoSeg === 0, 'parar parado nao lanca nada');
    await P.cronometro(uPioneira, 'iniciar', min(90));
    c = await P.cronometro(uPioneira, 'descartar', min(120));
    ok(!c.registro && (await prisma.pioneiroHoras.count({ where: { irmaoId: pioneira.id } })) === 1, 'descartar nao lanca');
    ok((await P.cronometro(uPioneira, 'voar')).erro === 400, 'acao invalida');

    console.log('horas e meta');
    const ontem = new Date(`${hoje}T12:00:00Z`);
    ontem.setUTCDate(ontem.getUTCDate() - 1);
    const dataOntem = ontem.toISOString().slice(0, 10);
    const manual = await P.lancarHoras(uPioneira, { data: dataOntem.slice(0, 7) === mes ? dataOntem : hoje, minutos: 90, observacao: 'carrinho' });
    ok(manual.registro && manual.registro.minutos === 90, 'lanca 1h30 a mao');
    ok((await P.lancarHoras(uPioneira, { data: '2099-01-01', minutos: 60 })).erro === 400, 'dia no futuro: 400');
    const deOutro = await prisma.pioneiroHoras.create({ data: { irmaoId: adminIrmao.id, data: hoje, minutos: 30 } });
    ok((await P.apagarHoras(uPioneira, deOutro.id)).erro === 404, 'nao apaga horas de outro');
    ok((await P.definirMeta(uPioneira, 70)).metaMensal === 70 && (await P.definirMeta(uPioneira, 0)).erro === 400, 'meta de 70 h; zero recusado');
    const p1 = await P.painel(uPioneira);
    ok(p1.minutosMes === 150 && p1.meta === 70 && p1.metaAno === 840 && p1.registros.length === 2, 'painel: 2h30 no mes, meta nova', { minutosMes: p1.minutosMes, meta: p1.meta });
    ok(p1.porMes.length === 12 && p1.porMes.find((m) => m.mes === mes).minutos === 150, 'painel: o ano de servico mes a mes');

    console.log('revisitas');
    const proxima = new Date(Date.now() + 30 * 60000).toISOString();
    const nova = await P.criarRevisita(uPioneira, { nome: 'Maria Exemplo', endereco: 'Rua A, 10', lat: -12.95, lng: -38.36, estudo: true });
    ok(nova.revisita && nova.revisita.irmaoId === pioneira.id, 'cria a revisita da pioneira');
    ok((await P.listarRevisitas(uAdmin)).revisitas.length === 0, 'o admin nao ve as revisitas da pioneira (cada um ve as suas)');
    ok((await P.atualizarRevisita(uAdmin, nova.revisita.id, { nome: 'X' })).erro === 404, 'nem edita');
    ok((await P.listarRevisitas(uPublicador)).erro === 403, 'publicador comum nao entra');
    const visitada = await P.registrarVisita(uPioneira, nova.revisita.id, { observacao: 'Gostou do folheto', proximaVisita: proxima });
    ok(visitada.revisita.visitas.length === 1 && new Date(visitada.revisita.proximaVisita).toISOString() === proxima && visitada.revisita.lembreteEm === null, 'visita registrada e a proxima marcada');
    ok((await P.painel(uPioneira)).estudos === 1, 'estudo conta no painel');

    console.log('aviso da visita');
    enviados.length = 0;
    let aviso = await P.avisarVisitas(new Date());
    ok(aviso.avisadas === 1 && enviados.length === 1 && enviados[0].to === 'ExponentPushToken[pioneira]' && enviados[0].title.startsWith('Revisita às'), 'avisa a pioneira da visita em 30 min', enviados);
    aviso = await P.avisarVisitas(new Date());
    ok(aviso.avisadas === 0 && enviados.length === 1, 'uma vez so');
    await P.atualizarRevisita(uPioneira, nova.revisita.id, { proximaVisita: new Date(Date.now() + 45 * 60000).toISOString() });
    aviso = await P.avisarVisitas(new Date());
    ok(aviso.avisadas === 1, 'remarcou: avisa de novo');

    console.log('relatorio');
    let rel = await P.enviarRelatorio(uPioneira, { mes, estudos: 1 });
    ok(rel.relatorio && rel.relatorio.horas === 2 && rel.relatorio.pioneiroRegular && rel.relatorio.participou && rel.minutosQueSobram === 30, 'relatorio: 2 h (horas cheias) e 1 estudo; sobram 30 min', rel);
    ok((await prisma.relatorioGrupoMes.count({ where: { grupoId: grupo.id, mes } })) === 1, 'unica do grupo: o grupo conclui o mes');
    rel = await P.enviarRelatorio(uPioneira, { mes, estudos: 2 });
    ok(rel.relatorio.estudos === 2 && (await prisma.relatorioCampo.count({ where: { irmaoId: pioneira.id, mes } })) === 1, 'mandar de novo corrige, nao duplica');
    ok((await P.enviarRelatorio(uAdmin, { mes, estudos: 0 })).erro === 400, 'admin que nao e pioneiro regular: precisa marcar auxiliar');
    ok(!(await P.enviarRelatorio(uAdmin, { mes, estudos: 0, pioneiroAuxiliar: true })).erro, 'com auxiliar marcado, manda');
    ok((await P.enviarRelatorio(uPioneira, { mes: '2099-01', estudos: 0 })).erro === 400, 'mes no futuro: 400');

    return falhas;
}

module.exports = { rodar };

if (require.main === module) {
    if (process.env.ZOOM_TESTE_BANCO !== '1') {
        console.error('Este teste grava dados. Rode so num banco descartavel: ZOOM_TESTE_BANCO=1 DATABASE_URL=... npm run verificar:pioneiros-banco');
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
