/**
 * O fluxo inteiro da integracao com o Zoom, com banco de verdade e o Zoom falso:
 * webhook assinado -> evento gravado -> fila -> API (fetch falso) -> gravacao -> o que o app le.
 * Cobre repeticao de evento, relatorio ainda nao pronto, 429, 401, reuniao de fora, evento que
 * ficou para tras e a recuperacao de reunioes anteriores.
 *
 *   ZOOM_TESTE_BANCO=1 DATABASE_URL=postgres://.../banco_descartavel npm run verificar:zoom-banco
 *
 * SO num banco descartavel, com as migrations aplicadas (npm run migrar): o teste cria e apaga
 * dados. Nomes inventados.
 */
const crypto = require('crypto');

async function rodar(prisma) {
    let falhas = 0;
    const ok = (cond, descricao, extra) => {
        if (cond) console.log(`   ok   ${descricao}`);
        else {
            falhas += 1;
            console.log(`   FALHA ${descricao}${extra !== undefined ? `\n         ${JSON.stringify(extra)}` : ''}`);
        }
    };

    const SEGREDO = 'segredo-webhook-teste';
    Object.assign(process.env, { ZOOM_ACCOUNT_ID: 'conta', ZOOM_CLIENT_ID: 'cliente', ZOOM_CLIENT_SECRET: 'segredo', ZOOM_WEBHOOK_SECRET_TOKEN: SEGREDO });
    const Zoom = require('../src/services/ZoomApiService');
    const Sync = require('../src/services/ZoomSincronizacaoService');
    const Controller = require('../src/controllers/ZoomController');
    Zoom.invalidarToken();

    // ---- o Zoom falso ----
    const zoom = { resumo: {}, participantes: {}, transcricao: {}, detalhes: {}, instancias: {}, apiStatus: null };
    const chamadas = [];
    const original = globalThis.fetch;
    const json = (corpo, status = 200, headers = {}) => new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status, headers });
    globalThis.fetch = async (url) => {
        const u = new URL(String(url));
        const caminho = decodeURIComponent(decodeURIComponent(u.pathname));
        chamadas.push(caminho);
        if (caminho === '/oauth/token') return json({ access_token: 'tk', expires_in: 3600 });
        if (zoom.apiStatus) return json({ code: 124, message: 'Invalid access token.' }, zoom.apiStatus);
        let m;
        const responder = (tabela, chave) => {
            const r = tabela[chave];
            if (typeof r === 'function') return r();
            return r ? json(r) : json({ code: 3001, message: 'Meeting does not exist' }, 404);
        };
        if ((m = /^\/v2\/meetings\/(.+)\/meeting_summary$/.exec(caminho))) return responder(zoom.resumo, m[1]);
        if ((m = /^\/v2\/report\/meetings\/(.+)\/participants$/.exec(caminho))) return responder(zoom.participantes, m[1]);
        if ((m = /^\/v2\/meetings\/(.+)\/transcript$/.exec(caminho))) return responder(zoom.transcricao, m[1]);
        if ((m = /^\/v2\/past_meetings\/(\d+)\/instances$/.exec(caminho))) return json({ meetings: zoom.instancias[m[1]] || [] });
        if ((m = /^\/v2\/past_meetings\/(.+)$/.exec(caminho))) return responder(zoom.detalhes, m[1]);
        if (u.hostname === 'zoom.us' && caminho.startsWith('/rec/')) return json('WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nAna Sousa: Bom dia, irmãos.\n');
        return json({ code: 404, message: 'rota falsa nao existe' }, 404);
    };

    const res = () => {
        const r = { statusCode: 200, body: null };
        r.status = (c) => ((r.statusCode = c), r);
        r.json = (b) => ((r.body = b), r);
        return r;
    };
    const assinado = (corpo, { segredo = SEGREDO, estragar = false } = {}) => {
        const cru = Buffer.from(JSON.stringify(corpo));
        const ts = String(Math.floor(Date.now() / 1000));
        const assinatura = `v0=${crypto.createHmac('sha256', segredo).update(`v0:${ts}:${cru}`).digest('hex')}`;
        // Troca o ultimo caractere por outro, sempre diferente (com "00" fixo, 1 vez em 256 nao mudava nada).
        const estragada = assinatura.slice(0, -1) + (assinatura.endsWith('0') ? '1' : '0');
        const cabecalhos = { 'x-zm-signature': estragar ? estragada : assinatura, 'x-zm-request-timestamp': ts };
        return { body: cru, get: (h) => cabecalhos[h.toLowerCase()] };
    };
    // O controller dispara a fila logo depois de responder; no teste a fila anda quando o
    // teste manda (relogio controlado).
    const processarDeVerdade = Sync.processarPendentes;
    Sync.processarPendentes = async () => ({ desligado: true });
    const webhook = async (corpo, opcoes) => {
        const r = res();
        await Controller.webhook(assinado(corpo, opcoes), r);
        return r;
    };
    // Espera qualquer rodada em andamento (as que o servico dispara sozinho) antes e depois.
    const ocioso = async () => {
        await new Promise((r) => setImmediate(r));
        while (Sync._internos.rodando()) await new Promise((r) => setTimeout(r, 10));
    };
    const fila = async (minutos = 0) => {
        for (;;) {
            await ocioso();
            const r = await processarDeVerdade({ agora: new Date(Date.now() + minutos * 60_000), agendar: false });
            if (!r.ocupado) {
                await ocioso();
                return r;
            }
        }
    };
    const parte = async (uuid, p) => {
        const r = await prisma.zoomReuniao.findUnique({ where: { uuid }, select: { id: true } });
        return r && prisma.zoomSincronizacao.findUnique({ where: { reuniaoId_parte: { reuniaoId: r.id, parte: p } } });
    };

    // ---- cadastro ----
    const config = await prisma.config.findFirst();
    const zoomCfg = { meio: { link: 'https://zoom.us/j/1', id: '823 4567 8901', senha: 'x' }, fds: { link: 'https://zoom.us/j/2', id: '855 1111 2222', senha: 'y' } };
    if (config) await prisma.config.update({ where: { id: config.id }, data: { zoom: zoomCfg } });
    else await prisma.config.create({ data: { titulo: 'T', subtitulo: '', mes: 'OUT', zoom: zoomCfg } });
    for (const nome of ['Ana Sousa', 'Carlos Mendes', 'Paulo Exemplo Lima']) {
        await prisma.irmao.upsert({ where: { nome }, update: {}, create: { nome, funcoes: [] } });
    }
    const ana = await prisma.irmao.findUnique({ where: { nome: 'Ana Sousa' } });

    console.log('webhook');
    const desafio = { event: 'endpoint.url_validation', event_ts: 1, payload: { plainToken: 'qgg8vlvZRS6UYooatFL8Aw' } };
    let r = await webhook(desafio);
    ok(r.statusCode === 200 && r.body.encryptedToken === crypto.createHmac('sha256', SEGREDO).update('qgg8vlvZRS6UYooatFL8Aw').digest('hex'), 'desafio de validacao respondido');
    r = await webhook(desafio, { estragar: true });
    ok(r.statusCode === 401, 'desafio com assinatura errada: 401 (o endpoint nao vira calculadora de HMAC)');
    r = await webhook({ event: 'meeting.ended' }, { segredo: 'outro' });
    ok(r.statusCode === 401, 'evento com assinatura de outro segredo: 401');
    delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
    r = await webhook(desafio);
    ok(r.statusCode === 503, 'sem o secret token configurado: 503 (o Zoom tenta de novo)');
    process.env.ZOOM_WEBHOOK_SECRET_TOKEN = SEGREDO;

    const OCC = 'occ1+abc==';
    const fim = {
        event: 'meeting.ended',
        event_ts: 1761174900000,
        payload: { account_id: 'conta', object: { id: '82345678901', uuid: OCC, host_id: 'h1', host_email: 'anfitriao@exemplo.com', topic: 'Reunião do meio de semana', type: 8, start_time: '2026-10-22T22:30:00Z', end_time: '2026-10-23T00:15:00Z', timezone: 'America/Bahia', duration: 120 } },
    };
    r = await webhook(fim);
    ok(r.statusCode === 200 && r.body.registrado, 'fim da reuniao registrado', r.body);
    r = await webhook(fim);
    ok(r.statusCode === 200 && r.body.duplicado, 'o mesmo evento de novo (reenvio do Zoom): nao duplica', r.body);
    r = await webhook({ ...fim, event_ts: 5, payload: { ...fim.payload, object: { ...fim.payload.object, id: '99999999999', uuid: 'de-fora==' } } });
    ok(r.body.ignorado && !(await prisma.zoomReuniao.findUnique({ where: { uuid: 'de-fora==' } })), 'reuniao fora das cadastradas em Ajustes: gravada como ignorada, sem relatorio');
    r = await webhook({ event: 'meeting.participant_joined', event_ts: 6, payload: { object: { uuid: OCC } } });
    ok(r.body.ignorado, 'evento que nao interessa: ignorado');
    const reuniao = await prisma.zoomReuniao.findUnique({ where: { uuid: OCC } });
    ok(reuniao && reuniao.topico === 'Reunião do meio de semana' && reuniao.duracaoMin === 105 && reuniao.meetingId === '82345678901', 'a ocorrencia guardada com os dados do evento', reuniao);
    ok((await prisma.zoomEvento.count({ where: { meetingUuid: OCC, status: 'aplicado' } })) === 1 && (await prisma.zoomEvento.count({ where: { meetingUuid: OCC, status: 'ignorado' } })) === 1, 'um evento aplicado para a ocorrencia; o que nao interessa fica gravado como ignorado');

    console.log('fila');
    zoom.participantes[OCC] = {
        participants: [
            { id: 'z1', user_id: '1', participant_user_id: 'z1', name: 'iPhone de Ana Sousa', join_time: '2026-10-22T22:28:00Z', leave_time: '2026-10-22T23:30:00Z', duration: 3720, status: 'in_meeting' },
            { id: 'z1', user_id: '2', participant_user_id: 'z1', name: 'iPhone de Ana Sousa', join_time: '2026-10-22T23:31:00Z', leave_time: '2026-10-23T00:15:00Z', duration: 2640, status: 'in_meeting' },
            { id: '', user_id: '3', name: 'Carlos', join_time: '2026-10-22T22:35:00Z', leave_time: '2026-10-23T00:10:00Z', duration: 5700, status: 'in_meeting' },
            { id: '', user_id: '4', name: 'Visitante 123', join_time: '2026-10-22T22:40:00Z', leave_time: '2026-10-22T22:45:00Z', duration: 300, status: 'in_meeting' },
        ],
        next_page_token: '',
    };
    zoom.transcricao[OCC] = { can_download: false, download_restriction_reason: 'NOT_READY' };
    await fila(0);
    ok((await parte(OCC, 'participantes')).tentativas === 0, 'nada antes da hora (o relatorio leva minutos para sair)');
    await fila(31);
    const p1 = await parte(OCC, 'participantes');
    ok(p1.status === 'ok', 'participantes sincronizados', p1);
    const res1 = await parte(OCC, 'resumo');
    ok(res1.status === 'pendente' && res1.tentativas === 1 && /Ainda não disponível/.test(res1.ultimoErro), 'resumo ainda nao existe: volta para a fila', res1);
    const tr1 = await parte(OCC, 'transcricao');
    ok(tr1.status === 'pendente' && tr1.tentativas === 1, 'transcricao ainda nao pronta: volta para a fila', tr1);
    const participantes = await prisma.zoomParticipante.findMany({ where: { reuniao: { uuid: OCC } } });
    ok(participantes.length === 4 && participantes.filter((p) => p.irmaoId === ana.id).length === 2, 'as 4 entradas gravadas, Ana casada com o cadastro', participantes.map((p) => [p.nome, p.irmaoId]));
    ok((await prisma.zoomReuniao.findUnique({ where: { uuid: OCC } })).participantesQtd === 3, '3 pessoas (Ana saiu e voltou)');

    zoom.resumo[OCC] = {
        meeting_uuid: OCC, meeting_id: 82345678901, meeting_topic: 'Reunião do meio de semana', summary_title: 'Resumo da reunião',
        summary_last_modified_time: '2026-10-23T00:30:00Z',
        summary_content: '## Tópicos discutidos\n### Leitura da Bíblia\nComentários sobre a leitura da semana\n- **Detalhes**\n    - Boa participação nos comentários\n- **Conclusão**\n    - Manter os comentários curtos\n\n## Próximas etapas\n- **Paulo**\n  - Enviar o convite do Zoom no grupo',
    };
    r = await webhook({ event: 'meeting.summary_completed', event_ts: 1761175000000, payload: { account_id: 'conta', object: { meeting_id: 82345678901, meeting_uuid: OCC, meeting_topic: 'Reunião do meio de semana' } } });
    ok(r.body.registrado, 'resumo pronto: evento registrado');
    zoom.transcricao[OCC] = { can_download: true, download_url: 'https://zoom.us/rec/meeting/transcript/download/x', meeting_id: OCC };
    r = await webhook({ event: 'meeting.aic_transcript_completed', event_ts: 1761175100000, payload: { account_id: 'conta', object: { meeting_id: 82345678901, meeting_uuid: OCC, file_id: 'f' } } });
    ok(r.body.registrado, 'transcricao pronta: evento registrado');
    await fila(31);
    const z1 = await prisma.zoomReuniao.findUnique({ where: { uuid: OCC } });
    ok((await parte(OCC, 'resumo')).status === 'ok' && z1.resumoTitulo === 'Resumo da reunião' && z1.resumoMarkdown.startsWith('## Tópicos discutidos'), 'resumo gravado com o Markdown original');
    ok(JSON.stringify(z1.decisoes) === JSON.stringify(['Manter os comentários curtos']) && JSON.stringify(z1.proximosPassos) === JSON.stringify(['Paulo: Enviar o convite do Zoom no grupo']), 'decisoes e proximos passos extraidos', [z1.decisoes, z1.proximosPassos]);
    ok(z1.resumoBruto && z1.resumoBruto.summary_title === 'Resumo da reunião', 'resposta inteira da API guardada (rastreabilidade)');
    ok((await parte(OCC, 'transcricao')).status === 'ok' && z1.transcricao === 'Ana Sousa: Bom dia, irmãos.' && !('download_url' in (z1.transcricaoBruta || {})), 'transcricao gravada, sem o link de download');
    ok(z1.sincronizadoEm !== null, 'tudo pronto: reuniao marcada como sincronizada');

    zoom.resumo[OCC] = { ...zoom.resumo[OCC], summary_title: 'Resumo editado' };
    await webhook({ event: 'meeting.summary_updated', event_ts: 1761176000000, payload: { object: { meeting_id: 82345678901, meeting_uuid: OCC } } });
    await fila(31);
    ok((await prisma.zoomReuniao.findUnique({ where: { uuid: OCC } })).resumoTitulo === 'Resumo editado', 'resumo editado no Zoom: busca de novo');
    const antes = await prisma.zoomParticipante.count();
    await Sync.sincronizarReuniao(z1.id, { forcar: true });
    await fila(31);
    ok((await prisma.zoomParticipante.count()) === antes, 'sincronizar de novo nao duplica participantes');

    console.log('falhas');
    zoom.resumo[OCC] = () => json({ code: 429, message: 'You have reached the maximum daily rate limit for this API.' }, 429, { 'retry-after': '3600' });
    await Sync.sincronizarReuniao(z1.id, { forcar: true });
    await fila(31);
    const limite = await parte(OCC, 'resumo');
    ok(limite.status === 'pendente' && limite.proximaTentativa.getTime() - Date.now() > 3500 * 1000, 'limite diario (429 com Retry-After de 1h): reagendado para depois', limite);
    ok((await prisma.zoomReuniao.findUnique({ where: { uuid: OCC } })).resumoTitulo === 'Resumo editado', 'a falha nao apaga o resumo que ja estava gravado');

    const OCC2 = 'occ2==';
    await webhook({ ...fim, event_ts: 1761779700000, payload: { ...fim.payload, object: { ...fim.payload.object, uuid: OCC2, start_time: '2026-10-29T22:30:00Z', end_time: '2026-10-30T00:10:00Z' } } });
    zoom.apiStatus = 401;
    await fila(5);
    const negado = await parte(OCC2, 'participantes');
    ok(negado.status === 'erro' && /401/.test(negado.ultimoErro), 'credencial recusada (401 mesmo com token novo): erro, para corrigir a configuracao', negado);
    zoom.apiStatus = null;
    for (let i = 0; i < Sync._internos.LIMITE_AGUARDANDO; i += 1) await fila(31 + 60 * 24 * (i + 1));
    const nunca = await parte(OCC2, 'resumo');
    ok(nunca.status === 'indisponivel' && nunca.tentativas === Sync._internos.LIMITE_AGUARDANDO, 'resumo que nunca sai (AI Companion desligado): indisponivel depois do limite', nunca);
    ok(!chamadas.some((c) => c.includes('tk')), 'o token nunca aparece no caminho das chamadas');

    console.log('evento que ficou para tras');
    const solto = await prisma.zoomEvento.create({
        data: { chave: 'meeting.summary_completed|occ1+abc==|999', evento: 'meeting.summary_completed', meetingUuid: OCC, payload: { event: 'meeting.summary_completed', event_ts: 999, payload: { object: { meeting_id: 82345678901, meeting_uuid: OCC } } } },
    });
    zoom.resumo[OCC] = { meeting_uuid: OCC, summary_title: 'Depois do restart', summary_content: '## Resumo\n- ok' };
    await fila(31);
    ok((await prisma.zoomEvento.findUnique({ where: { id: solto.id } })).status === 'aplicado', 'evento gravado e nao aplicado (queda no meio): aplicado na proxima rodada');

    console.log('reunioes anteriores');
    zoom.instancias['82345678901'] = [{ uuid: OCC, start_time: '2026-10-22T22:30:00Z' }, { uuid: 'occ0==', start_time: '2026-10-15T22:30:00Z' }];
    zoom.detalhes['occ0=='] = { uuid: 'occ0==', id: 82345678901, topic: 'Reunião do meio de semana', start_time: '2026-10-15T22:30:00Z', end_time: '2026-10-16T00:12:00Z', duration: 102, host_id: 'h1', user_email: 'anfitriao@exemplo.com' };
    zoom.participantes['occ0=='] = { participants: [{ id: '', user_id: '9', name: 'Paulo Lima', join_time: '2026-10-15T22:31:00Z', leave_time: '2026-10-16T00:12:00Z', duration: 6060 }] };
    const sp = await Sync.sincronizarPeriodo({ de: '2026-10-01', ate: '2026-10-23' });
    ok(sp.encontradas === 2 && sp.novas === 1 && sp.avisos.length === 0, 'recuperar outubro: 2 ocorrencias, 1 nova', sp);
    ok(chamadas.filter((c) => /instances$/.test(c)).length === 2, 'consulta as duas reunioes cadastradas (meio e fim de semana)');
    await fila(31);
    const z0 = await prisma.zoomReuniao.findUnique({ where: { uuid: 'occ0==' }, include: { participantes: true } });
    ok(z0.topico === 'Reunião do meio de semana' && z0.duracaoMin === 102 && z0.participantes.length === 1, 'a reuniao antiga completa (detalhes e participantes)', z0);
    ok((await Sync.sincronizarPeriodo({ de: '2026-10-23', ate: '2026-10-01' })).erro === 400, 'periodo invertido recusado');

    console.log('o que o app le');
    let lista = await Sync.listar({});
    ok(lista.total === 3 && lista.reunioes[0].uuid === OCC2 && lista.reunioes[2].uuid === 'occ0==', 'lista da mais nova para a mais antiga', lista.reunioes.map((x) => x.uuid));
    lista = await Sync.listar({ busca: 'carlos' });
    ok(lista.total === 1 && lista.reunioes[0].uuid === OCC, 'busca pelo nome de quem participou');
    lista = await Sync.listar({ de: '2026-10-14', ate: '2026-10-16' });
    ok(lista.total === 1 && lista.reunioes[0].uuid === 'occ0==' && lista.reunioes[0].congregacao.data === '15/10/2026', 'filtro de datas');
    const d = await Sync.detalhe(z1.id);
    ok(d.congregacao.tipo === 'meio' && d.congregacao.data === '22/10/2026' && d.participantes.length === 3 && d.entradas === 4, 'detalhe: a reuniao da congregacao e as pessoas', d.congregacao);
    const anaNoDetalhe = d.participantes.find((p) => p.irmaoId === ana.id);
    ok(anaNoDetalhe.nome === 'Ana Sousa' && anaNoDetalhe.nomeZoom === 'iPhone de Ana Sousa' && anaNoDetalhe.entradas === 2 && anaNoDetalhe.duracaoSeg === 6360, 'detalhe: Ana pelo cadastro, com o nome do Zoom e as duas entradas', anaNoDetalhe);
    ok(!('resumoBruto' in d) && !('transcricao' in d) && d.temTranscricao, 'detalhe sem o bruto nem a transcricao (vem a parte)');
    ok((await Sync.transcricaoDe(z1.id)).texto === 'Ana Sousa: Bom dia, irmãos.', 'transcricao a parte');

    const assist = await prisma.assistenciaReuniao.upsert({ where: { data_tipo: { data: '22/10/2026', tipo: 'meio' } }, update: {}, create: { data: '22/10/2026', tipo: 'meio', presencial: 80, zoom: 12 } });
    await prisma.presencaZoom.deleteMany({ where: { assistenciaId: assist.id } });
    await prisma.presencaZoom.create({ data: { assistenciaId: assist.id, nome: 'Ana Sousa', irmaoId: ana.id, pessoas: 2, levantouMao: true } });
    const levar = await Sync.levarParaAssistencia(z1.id);
    const lista2 = await prisma.presencaZoom.findMany({ where: { assistenciaId: assist.id }, orderBy: { nome: 'asc' } });
    ok(levar.adicionados === 2 && levar.total === 3, 'assistencia: entram os que faltavam', levar);
    ok(lista2.find((p) => p.irmaoId === ana.id).pessoas === 2 && lista2.find((p) => p.irmaoId === ana.id).levantouMao === true, 'assistencia: quem ja estava fica como estava (pessoas e mao levantada)');
    ok(lista2.some((p) => p.nome === 'Carlos Mendes') && lista2.some((p) => p.nome === 'Visitante'), 'assistencia: Carlos pelo cadastro, visitante pelo nome do Zoom', lista2.map((p) => p.nome));

    console.log('importacao do relatorio (CSV)');
    const ZoomCsv = require('../src/services/ZoomCsvService');
    const CAB = 'Tópico,Tipo,ID,Nome do anfitrião,E-mail do anfitrião,Hora de início,Hora de fim,Participantes,Duração (minutos),Total de minutos do participante,Departamento,Grupo,Fonte,Visualizadores únicos,Máximo de visualizações simultâneas,Hora da criação,Nome (nome original),E-mail,Ingressar na hora,Hora de saída,Duração (minutos),Convidado,Registrando a resposta de isenção de responsabilidade,Na sala de espera';
    const reuniaoCsv = (id, ini, fim, pessoas) => [
        `Reunião,Reunião,${id},Congregação Teste,c@exemplo.com,"${ini}","${fim}",9,120,300,,,Zoom,-,-,"13/02/2022 02:27:40 PM",Congregação Teste (Host),c@exemplo.com,"${ini}","${fim}",120,Não,,Não`,
        ...pessoas.map(([nome, espera]) => `Reunião,Reunião,${id},Congregação Teste,c@exemplo.com,"${ini}","${fim}",9,120,300,,,Zoom,-,-,"13/02/2022 02:27:40 PM","${nome}",,"${ini}","${fim}",${espera ? 1 : 110},Sim,,${espera ? 'Sim' : 'Não'}`),
    ];
    const csv = Buffer.from('﻿' + [
        CAB,
        // quinta 08/10 (meio): sem contagem registrada na assistencia
        ...reuniaoCsv('823 4567 8901', '08/10/2026 07:13:00 PM', '08/10/2026 09:20:00 PM', [['Ana Sousa'], ['iPhone de Paulo Lima'], ['Lia ( Carlos Mendes )'], ['Visitante Um'], ['Visitante Dois'], ['Só Esperou', true]]),
        // domingo 25/10 (fim de semana): contagem ja registrada
        ...reuniaoCsv('855 1111 2222', '25/10/2026 08:41:00 AM', '25/10/2026 10:40:00 AM', [['Ana Sousa'], ['Paulo Exemplo Lima'], ['Visitante Um'], ['Visitante Dois'], ['Visitante Tres']]),
        // so a conta e uma pessoa: fica de fora
        ...reuniaoCsv('823 4567 8901', '26/07/2026 10:52:00 AM', '26/07/2026 11:03:00 AM', [['Visitante Um']]),
        // reuniao de outra coisa na mesma conta
        ...reuniaoCsv('999 888 777', '10/10/2026 03:00:00 PM', '10/10/2026 04:00:00 PM', [['A Um'], ['B Dois'], ['C Tres'], ['D Quatro'], ['E Cinco']]),
    ].join('\r\n'));
    await prisma.assistenciaReuniao.upsert({ where: { data_tipo: { data: '25/10/2026', tipo: 'fds' } }, update: {}, create: { data: '25/10/2026', tipo: 'fds', presencial: 70, zoom: 10 } });
    const totalAntes = await prisma.zoomReuniao.count();
    let imp = await ZoomCsv.importar([{ nome: 'outubro.csv', buffer: csv }]);
    ok(imp.reunioes.length === 2 && imp.ignoradas.length === 2 && imp.erros.length === 0, 'importa as 2 reunioes da congregacao; ignora a de 1 pessoa e a de outro numero', imp);
    ok(imp.ignoradas.map((i) => i.motivo).sort().join(' | ') === 'fora das reuniões de Ajustes › Zoom | poucos participantes', 'motivo de cada uma que ficou de fora', imp.ignoradas);
    const quinta = imp.reunioes.find((r) => r.data === '08/10/2026');
    const domingo = imp.reunioes.find((r) => r.data === '25/10/2026');
    ok(quinta.tipo === 'meio' && quinta.pessoas === 5 && quinta.doCadastro === 3 && quinta.assistencia === null, 'quinta: 5 pessoas, 3 do cadastro (inclusive pelo nome original), sem contagem: nao mexe na assistencia', quinta);
    ok(!(await prisma.assistenciaReuniao.findUnique({ where: { data_tipo: { data: '08/10/2026', tipo: 'meio' } } })), 'nao cria assistencia zerada (puxaria a media do mes)');
    ok(domingo.tipo === 'fds' && domingo.assistencia && domingo.assistencia.adicionados === 5, 'domingo: os 5 entram em quem assistiu pelo Zoom', domingo);
    const zQuinta = await prisma.zoomReuniao.findUnique({ where: { id: quinta.id }, include: { participantes: true } });
    ok(zQuinta.uuid.startsWith('csv:') && zQuinta.participantesQtd === 5 && zQuinta.participantes.length === 6 && zQuinta.participantes.some((p) => p.status === 'in_waiting_room'), 'gravada com as entradas (inclusive a da sala de espera) e 5 pessoas', zQuinta.participantesQtd);
    const contar = async () => [await prisma.zoomReuniao.count(), await prisma.zoomParticipante.count(), await prisma.presencaZoom.count()];
    const antesDeReimportar = await contar();
    imp = await ZoomCsv.importar([{ nome: 'outubro.csv', buffer: csv }]);
    ok(JSON.stringify(await contar()) === JSON.stringify(antesDeReimportar) && antesDeReimportar[0] === totalAntes + 2, 'importar o mesmo arquivo de novo nao duplica nada', [antesDeReimportar, await contar()]);
    const listaCsv = await Sync.listar({ de: '2026-10-08', ate: '2026-10-08' });
    ok(listaCsv.reunioes.length === 1 && listaCsv.reunioes[0].origem === 'csv' && listaCsv.reunioes[0].situacao === 'ok', 'na lista, marcada como vinda do relatorio');
    const erroCsv = await ZoomCsv.importar([{ nome: 'planilha.csv', buffer: Buffer.from('nome,idade\nx,1') }]);
    ok(erroCsv.reunioes.length === 0 && /Não parece o relatório/.test(erroCsv.erros[0]), 'arquivo que nao e o relatorio: erro claro');

    // As estatisticas do grupo contam o Zoom do relatorio, sem repetir o dia que tambem esta na assistencia.
    const carlos = await prisma.irmao.findUnique({ where: { nome: 'Carlos Mendes' } });
    const grupo = await prisma.grupoCampo.create({ data: { nome: 'Grupo Teste Zoom', numero: 77 } });
    await prisma.irmao.update({ where: { id: carlos.id }, data: { grupoId: grupo.id } });
    const adm = await prisma.usuario.create({ data: { nickname: 'admzoom', nome: 'admzoom', senha: 'x', isAdmin: true }, select: { id: true, isAdmin: true, escopos: true, irmaoId: true } });
    const Relatorio = require('../src/services/RelatorioCampoService');
    const det = await Relatorio.detalhe(adm, grupo.id, { periodo: 'ano' });
    const estCarlos = det.membros.find((m) => m.id === carlos.id).estatisticas;
    ok(estCarlos.zoom === 2, 'grupos: Carlos assistiu 2 reunioes pelo Zoom (22/10 na lista e no relatorio, 08/10 so no relatorio)', estCarlos);

    // Quando a API chegar, a ocorrencia importada vira a de verdade (sem duplicar).
    zoom.instancias['85511112222'] = [{ uuid: 'fds-real==', start_time: '2026-10-25T11:41:00Z' }];
    const adocao = await Sync.sincronizarPeriodo({ de: '2026-10-24', ate: '2026-10-26' });
    await ocioso();
    const adotada = await prisma.zoomReuniao.findUnique({ where: { id: domingo.id } });
    ok(adotada.uuid === 'fds-real==' && !(await prisma.zoomReuniao.findFirst({ where: { uuid: 'fds-real==', NOT: { id: domingo.id } } })), 'a reuniao do relatorio ganha o UUID da API, sem criar outra', [adocao, adotada.uuid]);

    const est = await Sync.estado();
    ok(est.api && est.webhook && typeof est.pendentes === 'number' && est.ultimoEvento, 'estado da integracao', est);

    globalThis.fetch = original;
    Sync.processarPendentes = processarDeVerdade;
    Sync.pararTimer();
    return falhas;
}

module.exports = { rodar };

if (require.main === module) {
    if (process.env.ZOOM_TESTE_BANCO !== '1') {
        console.error('Este teste grava e apaga dados. Rode so num banco descartavel: ZOOM_TESTE_BANCO=1 DATABASE_URL=... npm run verificar:zoom-banco');
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
