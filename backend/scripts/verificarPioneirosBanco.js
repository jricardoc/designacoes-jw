/**
 * O fluxo da area de pioneiros com banco de verdade: quem entra, cronometro (com pausa e com
 * dois "parar" ao mesmo tempo), horas, meta, revisitas de um que o outro nao ve, aviso da visita
 * marcada, o relatorio que cai no grupo e o pioneiro auxiliar do cadastro (meta e lista de grupos).
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

    console.log('conversas de hoje e tipos de visita');
    const meioDia = new Date(P._internos.inicioDoDia(hoje).getTime() + 12 * 3600000).toISOString();
    const hojeA = await P.criarRevisita(uPioneira, { nome: 'Joana Exemplo', proximaVisita: meioDia });
    const hojeB = await P.criarRevisita(uPioneira, { nome: 'Rita Exemplo', proximaVisita: meioDia, estudo: true });
    let pc = await P.painel(uPioneira);
    // A Maria (la de cima) tambem esta marcada para hoje e ja foi visitada hoje.
    ok(pc.nome === 'Pioneira' && pc.conversasHoje.total === 3 && pc.conversasHoje.feitas === 1, 'tres conversas hoje: duas marcadas e a ja visitada', pc.conversasHoje);
    await P.registrarVisita(uPioneira, hojeA.revisita.id, { tipo: 'nao_em_casa', proximaVisita: new Date(Date.now() + 7 * 86400000).toISOString() });
    await P.registrarVisita(uPioneira, hojeB.revisita.id, { tipo: 'estudo', observacao: 'Lição 3' });
    pc = await P.painel(uPioneira);
    ok(pc.conversasHoje.total === 3 && pc.conversasHoje.feitas === 3 && pc.conversasHoje.itens.find((i) => i.id === hojeA.revisita.id).feita === 'nao_em_casa', 'as tres feitas (uma "nao em casa", remarcada para a semana que vem)', pc.conversasHoje);
    ok(pc.aSeguir.some((r) => r.id === hojeA.revisita.id && r.situacao === 'marcada'), 'a remarcada vai para "a seguir"');
    const det = await P.revisita(uPioneira, hojeB.revisita.id);
    ok(det.revisita.visitas[0].tipo === 'estudo', 'a visita guarda o tipo');

    console.log('agenda (planos, companheiros e saidas de campo)');
    const amanha = new Date(P._internos.inicioDoDia(hoje).getTime() + 36 * 3600000).toISOString().slice(0, 10);
    const outra = await irmao('Companheira Teste', { pioneiro: 'regular' });
    const uOutra = await usuario('companheira-teste', outra.id);
    ok((await P.criarPlano(uPioneira, { data: amanha, hora: '09:30', duracaoMin: 120, local: 'Praça' })).plano, 'plano de amanha');
    const dela = await P.criarPlano(uOutra, { data: amanha, hora: '14:00', duracaoMin: 90 });
    ok(dela.plano && (await P.criarPlano(uOutra, { data: '2000-01-01', hora: '14:00' })).erro === 400, 'a companheira planeja; plano no passado e recusado');
    const saida = await prisma.saidaCampo.create({ data: { diaSemana: 'sabado', local: 'Salão do Reino', horario: '08:45' } });
    const [anoAm, mesAm, diaAm] = amanha.split('-').map(Number);
    const quadro = await prisma.quadroDirigente.create({ data: { mes: mesAm, ano: anoAm, titulo: 'Teste', status: 'publicado' } });
    await prisma.escalaDirigente.create({ data: { quadroId: quadro.id, saidaCampoId: saida.id, data: `${String(diaAm).padStart(2, '0')}/${String(mesAm).padStart(2, '0')}`, dia: 'Sábado', principal: 'Dirigente Teste' } });
    let ag = await P.agenda(uPioneira, { de: hoje, ate: amanha });
    ok(ag.planos.length === 2 && ag.planos.find((p) => p.meu).local === 'Praça' && ag.planos.find((p) => !p.meu).nome === 'Companheira', 'agenda: o meu plano e o da companheira (so o primeiro nome)', ag.planos);
    ok(ag.saidas.length === 1 && ag.saidas[0].data === amanha && ag.saidas[0].hora === '08:45' && ag.saidas[0].dirigente === 'Dirigente Teste', 'agenda: a saida de campo publicada', ag.saidas);
    ok(ag.visitas.some((v) => v.id === hojeA.revisita.id) === false && ag.visitas.some((v) => v.situacao), 'agenda: as visitas marcadas no periodo, com a situacao');
    ok((await P.atualizarPerfil(uOutra, { compartilharPlanos: false })).compartilharPlanos === false, 'a companheira deixa de compartilhar');
    ag = await P.agenda(uPioneira, { de: hoje, ate: amanha });
    ok(ag.planos.length === 1 && ag.planos[0].meu, 'some o plano dela da minha agenda');
    ok((await P.apagarPlano(uPioneira, dela.plano.id)).erro === 404, 'nao apago o plano de outra');
    ok((await P.agenda(uPioneira, { de: '2026-01-01', ate: '2026-06-01' })).erro === 400, 'periodo de mais de 2 meses: 400');

    console.log('viagens');
    ok((await P.criarViagem(uPioneira, { data: hoje, km: '12,5', custo: '14,70' })).viagem.km === 12.5, 'viagem de 12,5 km');
    await P.criarViagem(uPioneira, { data: hoje, km: 7.5 });
    const vg = await P.viagens(uPioneira, mes);
    ok(vg.quantidade === 2 && vg.km === 20 && vg.custo === 14.7 && vg.porDia[hoje] === 20, 'totais do mes e o km do dia', vg);
    const deOutraViagem = await prisma.pioneiroViagem.create({ data: { irmaoId: outra.id, data: hoje, km: 3 } });
    ok((await P.apagarViagem(uPioneira, deOutraViagem.id)).erro === 404, 'nao apago viagem de outra');

    console.log('progresso');
    const pg = await P.progresso(uPioneira, mes);
    const doMes = pg.porMes.find((m) => m.mes === mes);
    ok(pg.porMes.length === 12 && doMes.relatorio === true && doMes.minutos === 150, 'o mes com as horas e o relatorio enviado', doMes);
    ok(pg.emblemas.length === 4 && pg.emblemas.find((e) => e.id === 'estudos').valor === 1 && pg.emblemas.find((e) => e.id === 'regando').valor === 2, 'emblemas contam as visitas do mes (sem o "nao em casa") e os estudos', pg.emblemas);
    ok(pg.viagens.km === 20 && pg.metaAno === pg.meta * 12, 'quilometragem e meta do ano');

    console.log('calendario');
    ok((await P.painel(uPioneira)).calendario === false, 'sem link ainda: o painel diz que nao assinou');
    const l1 = await P.linkCalendario(uPioneira);
    ok(/^[a-f0-9]{48}$/.test(l1.token) && (await P.linkCalendario(uPioneira)).token === l1.token, 'o link e criado uma vez e reaproveitado');
    ok((await P.painel(uPioneira)).calendario === true, 'com o link criado, o painel avisa o app');
    const cal = await P.calendarioIcs(l1.token);
    ok(cal.includes('SUMMARY:Revisita: Joana Exemplo') && cal.includes(`DTSTART:${amanha.replace(/-/g, '')}T123000Z`) && (cal.match(/UID:plano-/g) || []).length === 1,
        'a visita remarcada e o meu plano (09:30 da congregacao em UTC); o plano da companheira nao', cal);
    const l2 = await P.linkCalendario(uPioneira, { trocar: true });
    ok(l2.token !== l1.token && (await P.calendarioIcs(l1.token)) === null && (await P.calendarioIcs(l2.token)) !== null, 'trocar o link derruba o antigo');
    ok((await P.calendarioIcs('nao-e-token')) === null && (await P.linkCalendario(uPublicador)).erro === 403, 'token invalido nao abre; publicador comum nao tem calendario');

    console.log('relatorio do proprio publicador ("Registrar o campo")');
    const R = require('../src/services/RelatorioCampoService');
    const somar = R._internos.somarMeses;
    const doGrupo = await irmao('Publicadora Do Grupo', { grupoId: grupo.id });
    const uDoGrupo = await usuario('publicadora-do-grupo', doGrupo.id);
    ok((await R.meuRelatorio(uDoGrupo, mes)).relatorio === null, 'antes de mandar: sem relatorio');
    const m1 = await R.enviarMeuRelatorio(uDoGrupo, { mes, participou: true, estudos: 2, observacao: ' tudo certo ' });
    ok(m1.relatorio && m1.relatorio.grupoId === grupo.id && m1.relatorio.registradoPorId === uDoGrupo.id && m1.relatorio.observacao === 'tudo certo',
        'manda e cai no grupo dela, registrado por ela', m1);
    const lido = await R.meuRelatorio(uDoGrupo, mes);
    ok(lido.relatorio.participou === true && lido.relatorio.estudos === 2 && lido.pioneiroRegular === false, 'o app reabre o relatorio preenchido', lido);
    const m2 = await R.enviarMeuRelatorio(uDoGrupo, { mes, participou: false, estudos: 3 });
    ok(m2.relatorio.estudos === 0 && (await prisma.relatorioCampo.count({ where: { irmaoId: doGrupo.id } })) === 1,
        'mandar de novo corrige (sem participar, sem estudo), sem duplicar');
    const aux = await R.enviarMeuRelatorio(uDoGrupo, { mes, participou: true, pioneiroAuxiliar: true, horas: 30.4, estudos: 1 });
    ok(aux.relatorio.pioneiroAuxiliar === true && aux.relatorio.horas === 30, 'auxiliar relata horas inteiras', aux.relatorio);
    ok((await R.enviarMeuRelatorio(uDoGrupo, { mes, pioneiroAuxiliar: true, estudos: 1 })).erro === 400, 'auxiliar sem horas: 400');
    ok((await R.enviarMeuRelatorio(uDoGrupo, { mes: somar(mes, 1), participou: true })).erro === 400, 'mes que nao chegou: 400');
    ok((await R.enviarMeuRelatorio(uDoGrupo, { mes: somar(mes, -3), participou: true })).erro === 400, 'mes antigo demais: 400');
    ok(!(await R.enviarMeuRelatorio(uDoGrupo, { mes: somar(mes, -2), participou: true })).erro, 'dois meses para tras ainda corrige');
    ok((await R.enviarMeuRelatorio(uPioneira, { mes, participou: true })).erro === 400, 'pioneiro regular manda pelo Ministerio');
    ok((await R.enviarMeuRelatorio(uAdminSemCadastro, { mes, participou: true })).erro === 403, 'conta sem cadastro: 403');
    ok((await R.enviarMeuRelatorio(uPublicador, { mes, participou: true })).relatorio.grupoId === null, 'sem grupo tambem grava (o secretario ve)');

    console.log('pioneiro auxiliar do cadastro');
    const resposta = () => {
        const r = { statusCode: 200, body: null };
        r.status = (codigo) => ((r.statusCode = codigo), r);
        r.json = (corpo) => ((r.body = corpo), r);
        return r;
    };
    const Irmaos = require('../src/controllers/IrmaoController');
    const auxiliar = await irmao('Auxiliar Teste', { pioneiro: 'auxiliar', grupoId: grupo.id });
    const uAuxiliar = await usuario('auxiliar-teste', auxiliar.id);
    const pa = await P.painel(uAuxiliar);
    ok(!pa.erro && pa.regular === false && pa.meta === 30, 'auxiliar do cadastro entra, com meta de 30 h', pa);
    await Irmaos.update({ params: { id: String(auxiliar.id) }, body: { pioneiro: 'regular' } }, resposta());
    ok((await P.painel(uAuxiliar)).meta === 50, 'virou regular no cadastro: a meta vai para 50 h');
    await Irmaos.update({ params: { id: String(auxiliar.id) }, body: { pioneiro: 'auxiliar' } }, resposta());
    ok((await P.painel(uAuxiliar)).meta === 30, 'voltou a auxiliar: 30 h');
    const estranho = resposta();
    await Irmaos.update({ params: { id: String(auxiliar.id) }, body: { pioneiro: 'especial' } }, estranho);
    ok(estranho.body && estranho.body.pioneiro === null, 'tipo desconhecido limpa', estranho.body);
    ok((await P.painel(uAuxiliar)).erro === 403, 'sem tipo, sai da area');
    await Irmaos.update({ params: { id: String(auxiliar.id) }, body: { pioneiro: 'auxiliar' } }, resposta());

    // A lista de grupos (PDF) so sabe do regular (o verde): o auxiliar do cadastro fica como esta.
    const regularSemVerde = await irmao('Regular Sem Verde Teste', { pioneiro: 'regular' });
    const viraRegular = await irmao('Vira Regular Teste', { pioneiro: 'auxiliar' });
    await P.painel(await usuario('vira-regular-teste', viraRegular.id)); // cria o perfil, com 30 h
    const divisao = resposta();
    await require('../src/controllers/GruposController').aplicarDivisao(
        {
            body: {
                tirarDosGrupos: false,
                grupos: [
                    {
                        numero: 92,
                        membros: [
                            { nomeDocumento: auxiliar.nome, irmaoId: auxiliar.id, pioneiro: false },
                            { nomeDocumento: regularSemVerde.nome, irmaoId: regularSemVerde.id, pioneiro: false },
                            { nomeDocumento: viraRegular.nome, irmaoId: viraRegular.id, pioneiro: true },
                        ],
                    },
                ],
            },
        },
        divisao,
    );
    const depois = await prisma.irmao.findMany({ where: { id: { in: [auxiliar.id, regularSemVerde.id, viraRegular.id] } }, select: { id: true, pioneiro: true } });
    const tipo = (i) => depois.find((d) => d.id === i.id).pioneiro;
    ok(
        divisao.statusCode === 200 && tipo(auxiliar) === 'auxiliar' && tipo(regularSemVerde) === null && tipo(viraRegular) === 'regular',
        'lista de grupos: o auxiliar fica, o regular sem verde sai, o verde vira regular',
        { status: divisao.statusCode, corpo: divisao.body, depois },
    );
    ok((await prisma.pioneiroPerfil.findUnique({ where: { irmaoId: viraRegular.id } })).metaMensal === 50, 'quem virou regular pela lista vai para 50 h');

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
