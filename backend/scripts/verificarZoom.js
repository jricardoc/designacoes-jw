/**
 * Verificacao da integracao com o Zoom: assinatura do webhook, leitura dos eventos, regras da
 * fila, leitura do resumo e o cliente da API (token, renovacao, 429, paginas, transcricao).
 *
 *   npm run verificar:zoom
 *
 * Nao precisa de banco nem de conta no Zoom: o `fetch` e trocado por um falso. O fluxo com
 * banco (webhook -> fila -> gravacao -> telas) esta em verificarZoomBanco.js.
 */
const crypto = require('crypto');
const Zoom = require('../src/services/ZoomApiService');
const Sync = require('../src/services/ZoomSincronizacaoService');

const R = Sync._internos;
const A = Zoom._internos;

let falhas = 0;
const eq = (achado, esperado, descricao) => {
    const ok = JSON.stringify(achado) === JSON.stringify(esperado);
    if (ok) {
        console.log(`   ok   ${descricao}`);
    } else {
        falhas += 1;
        console.log(`   FALHA ${descricao}\n         esperado ${JSON.stringify(esperado)}\n         veio     ${JSON.stringify(achado)}`);
    }
};

/** O resumo de exemplo da documentacao do Zoom (GET /meetings/{id}/meeting_summary). */
const RESUMO_EXEMPLO = [
    '## Key takeaways',
    '- Mobile app performance issues are affecting user retention.',
    '- Need to prioritize accessibility improvements.',
    '',
    '## Discussed topics',
    '### Mobile App Performance',
    'Discussion of recent performance metrics and user complaints',
    '- **Details**',
    '    - Sarah (Product): Reports of app crashes increased 15% this month',
    '- **Conclusion**',
    '    - Implement performance monitoring tools',
    '    - Prioritize memory optimization in next sprint',
    '',
    '### Onboarding Flow',
    'Review of beta testing results for new user onboarding',
    '- **Details**',
    '    - Rachel (UX): 90% completion rate in beta testing',
    '- **Conclusion**',
    '    - Ready for full rollout next month',
    '',
    '## Challenges',
    '* Resource constraints for performance optimization',
    '',
    '## Action items',
    '- **Sarah**',
    '  - Prepare performance monitoring implementation plan',
    '- **Mike**',
    '  - Investigate memory leak fix',
    '  - Document performance optimization guidelines',
].join('\n');

async function principal() {
    console.log('assinatura do webhook');
    const segredo = 'segredo-de-teste';
    const corpo = Buffer.from('{"event":"meeting.ended","payload":{"object":{"uuid":"abc=="}},"event_ts":1700000000000}');
    const ts = '1700000000';
    const assinatura = `v0=${crypto.createHmac('sha256', segredo).update(`v0:${ts}:${corpo.toString()}`).digest('hex')}`;
    eq(R.assinaturaValida(corpo, ts, assinatura, segredo), true, 'assinatura do Zoom confere');
    eq(R.assinaturaValida(Buffer.from(corpo.toString().replace('ended', 'started')), ts, assinatura, segredo), false, 'corpo alterado nao passa');
    eq(R.assinaturaValida(corpo, '1700000001', assinatura, segredo), false, 'outro timestamp nao passa');
    eq(R.assinaturaValida(corpo, ts, assinatura, 'outro-segredo'), false, 'outro segredo nao passa');
    eq(R.assinaturaValida(corpo, ts, undefined, segredo), false, 'sem cabecalho nao passa');
    eq(R.respostaValidacao('qgg8vlvZRS6UYooatFL8Aw', segredo), {
        plainToken: 'qgg8vlvZRS6UYooatFL8Aw',
        encryptedToken: crypto.createHmac('sha256', segredo).update('qgg8vlvZRS6UYooatFL8Aw').digest('hex'),
    }, 'resposta do desafio endpoint.url_validation');

    console.log('eventos');
    const fim = R.interpretarEvento({
        event: 'meeting.ended',
        event_ts: 1761255000000,
        payload: { account_id: 'conta', object: { id: '82345678901', uuid: 'u1==', host_id: 'h', host_email: 'a@b.c', topic: 'Reunião', start_time: '2026-10-22T22:30:00Z', end_time: '2026-10-23T00:15:00Z', timezone: 'America/Bahia' } },
    });
    eq([fim.conhecido, fim.uuid, fim.meetingId, fim.chave, fim.dados.duracaoMin, fim.dados.topico], [true, 'u1==', '82345678901', 'meeting.ended|u1==|1761255000000', 105, 'Reunião'], 'fim da reuniao: ocorrencia, numero, chave e duracao');
    const resumo = R.interpretarEvento({ event: 'meeting.summary_completed', event_ts: 2, payload: { object: { meeting_id: 82345678901, meeting_uuid: 'u1==', meeting_topic: 'Reunião' } } });
    eq([resumo.uuid, resumo.meetingId, resumo.dados.topico], ['u1==', '82345678901', 'Reunião'], 'resumo pronto: os campos meeting_* tambem servem');
    eq(R.interpretarEvento({ event: 'meeting.started', payload: { object: { uuid: 'x' } } }).conhecido, false, 'evento que nao interessa');
    eq(Object.keys(Sync.EVENTOS).sort(), ['meeting.aic_transcript_completed', 'meeting.ended', 'meeting.summary_completed', 'meeting.summary_updated'], 'eventos tratados');

    console.log('fila');
    eq([R.proximaEspera(1), R.proximaEspera(2), R.proximaEspera(4), R.proximaEspera(20)], [60000, 120000, 480000, 21600000], 'espera crescente, ate 6 horas');
    const erro = (status, codigo, temporario = false) => new Zoom.ErroZoom('x', { status, codigo, temporario });
    eq([
        R.classificar(erro(429, null, true)),
        R.classificar(erro(404, 3001)),
        R.classificar(erro(400, 3000)),
        R.classificar(erro(403, 2305)),
        R.classificar(erro(400, 4711)),
        R.classificar(new Zoom.ErroZoom('x', { codigo: 'NAO_CONFIGURADO' })),
        R.classificar(new Error('banco caiu')),
    ], ['temporario', 'aguardando', 'indisponivel', 'indisponivel', 'erro', 'erro', 'temporario'], '429 tenta de novo, 404 espera, resumo desligado indisponivel, escopo faltando e erro');
    eq([R.situacaoDe([{ status: 'ok' }, { status: 'pendente' }]), R.situacaoDe([{ status: 'ok' }, { status: 'erro' }]), R.situacaoDe([{ status: 'ok' }, { status: 'indisponivel' }])], ['sincronizando', 'erro', 'ok'], 'situacao da reuniao');

    console.log('resumo do AI Companion');
    const x = R.extrairDoResumo({ summary_content: RESUMO_EXEMPLO });
    eq(x.topicos.map((t) => [t.titulo, t.descricao, t.itens.length, t.conclusoes.length]), [
        ['Mobile App Performance', 'Discussion of recent performance metrics and user complaints', 1, 2],
        ['Onboarding Flow', 'Review of beta testing results for new user onboarding', 1, 1],
    ], 'topicos com descricao, detalhes e conclusoes');
    eq(x.decisoes, ['Implement performance monitoring tools', 'Prioritize memory optimization in next sprint', 'Ready for full rollout next month'], 'decisoes: as conclusoes dos topicos');
    eq(x.proximosPassos, ['Sarah: Prepare performance monitoring implementation plan', 'Mike: Investigate memory leak fix', 'Mike: Document performance optimization guidelines'], 'proximos passos com o responsavel');
    const pt = R.extrairDoResumo({ summary_content: '## Principais conclusões\n- A reunião teve boa participação.\n\n## Decisões\n- Manter o horário de 19h30.\n\n## Próximas etapas\n- Enviar o convite do Zoom no grupo.' });
    eq([pt.decisoes, pt.proximosPassos], [['Manter o horário de 19h30.'], ['Enviar o convite do Zoom no grupo.']], 'resumo em portugues: "Principais conclusoes" nao vira decisao');
    eq(R.extrairDoResumo({ summary_content: '', next_steps: ['Passo antigo'] }).proximosPassos, ['Passo antigo'], 'sem Markdown, o next_steps antigo');

    console.log('participantes e assistencia');
    eq(['iPhone de Carlos', 'Ana Souza (celular)', "Carlos's iPhone", 'Galaxy A52 de Maria'].map(R.limparNomeZoom), ['Carlos', 'Ana Souza', 'Carlos', 'Maria'], 'nome sem o aparelho');
    const juntos = R.consolidarParticipantes([
        { nome: 'Ana', participanteId: 'p1', entrada: new Date('2026-10-22T22:30:00Z'), saida: new Date('2026-10-22T23:00:00Z'), duracaoSeg: 1800 },
        { nome: 'Ana', participanteId: 'p1', entrada: new Date('2026-10-22T23:05:00Z'), saida: new Date('2026-10-23T00:10:00Z'), duracaoSeg: 3900 },
        { nome: 'Visitante', entrada: new Date('2026-10-22T22:40:00Z'), saida: new Date('2026-10-22T22:50:00Z'), duracaoSeg: 600, status: 'in_waiting_room' },
    ]);
    eq(juntos.map((p) => [p.nome, p.entradas, p.duracaoSeg, p.saida.toISOString().slice(11, 16), p.naSala]), [['Ana', 2, 5700, '00:10', true], ['Visitante', 1, 600, '22:50', false]], 'quem saiu e voltou vira uma pessoa so');
    const cfg = { meio: { id: '823 4567 8901' }, fds: { id: '855 1111 2222' } };
    eq(R.reuniaoDaCongregacao({ inicio: '2026-10-22T22:30:00Z', meetingId: '82345678901' }, cfg), { tipo: 'meio', data: '22/10/2026' }, 'quinta 19h30 (Brasilia) pelo numero do meio de semana');
    eq(R.reuniaoDaCongregacao({ inicio: '2026-10-23T01:00:00Z', meetingId: '85511112222' }, cfg), { tipo: 'fds', data: '22/10/2026' }, 'o dia e o da congregacao (22h de quinta), o tipo pelo numero');
    eq(R.reuniaoDaCongregacao({ inicio: '2026-10-25T12:00:00Z', meetingId: '1' }, { meio: { id: '9' }, fds: { id: '9' } }), { tipo: 'fds', data: '25/10/2026' }, 'mesmo numero para as duas: pelo dia da semana');

    console.log('cliente da API');
    eq([A.codificarUuid('abc+def=='), A.codificarUuid('/ajXp112QmuoKj4854875=='), A.codificarUuid('a//b')], ['abc%2Bdef%3D%3D', '%252FajXp112QmuoKj4854875%253D%253D', 'a%252F%252Fb'], 'UUID codificado (duas vezes com "/" no comeco ou "//")');
    eq([A.esperaDoRetryAfter('5'), A.esperaDoRetryAfter(new Date(Date.now() + 60000).toUTCString()) > 55000, A.esperaDoRetryAfter('lixo')], [5000, true, null], 'Retry-After em segundos ou data');
    eq(A.textoDoVtt('WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\nAna: Bom dia, irmãos.\n\n2\n00:00:05.000 --> 00:00:07.000\nPaulo: Bom dia!\n'), 'Ana: Bom dia, irmãos.\nPaulo: Bom dia!', 'transcricao sem marcas de tempo');

    const original = globalThis.fetch;
    const chamadas = [];
    let roteiro = [];
    globalThis.fetch = async (url, opcoes = {}) => {
        const u = new URL(String(url));
        chamadas.push({ caminho: u.pathname, query: Object.fromEntries(u.searchParams), auth: (opcoes.headers || {}).Authorization || '' });
        const resposta = roteiro.shift();
        if (!resposta) throw new Error(`chamada inesperada: ${u.pathname}`);
        return new Response(typeof resposta.corpo === 'string' ? resposta.corpo : JSON.stringify(resposta.corpo || {}), { status: resposta.status || 200, headers: resposta.headers || {} });
    };
    const tok = (n) => ({ corpo: { access_token: `token-${n}`, expires_in: 3600 } });

    delete process.env.ZOOM_ACCOUNT_ID;
    Zoom.invalidarToken();
    let falhou = null;
    try {
        await Zoom.resumo('u');
    } catch (e) {
        falhou = e.codigo;
    }
    eq(falhou, 'NAO_CONFIGURADO', 'sem credenciais: erro claro, sem chamar o Zoom');

    Object.assign(process.env, { ZOOM_ACCOUNT_ID: 'conta', ZOOM_CLIENT_ID: 'cliente', ZOOM_CLIENT_SECRET: 'segredo' });
    roteiro = [tok(1), { corpo: { summary_title: 'R1' } }, { corpo: { summary_title: 'R2' } }];
    chamadas.length = 0;
    const r1 = await Zoom.resumo('u1==');
    const r2 = await Zoom.resumo('u2==');
    eq([r1.summary_title, r2.summary_title, chamadas.filter((c) => c.caminho === '/oauth/token').length], ['R1', 'R2', 1], 'o token vale para as duas chamadas');
    eq([chamadas[0].query, chamadas[0].auth.startsWith('Basic '), chamadas[1].auth], [{ grant_type: 'account_credentials', account_id: 'conta' }, true, 'Bearer token-1'], 'token pelo account_credentials, com Basic; API com Bearer');

    roteiro = [{ status: 401, corpo: { code: 124, message: 'Invalid access token.' } }, tok(2), { corpo: { summary_title: 'R3' } }];
    chamadas.length = 0;
    eq([(await Zoom.resumo('u3')).summary_title, chamadas.map((c) => c.auth.split(' ')[1] || '').filter((t) => t.startsWith('token'))], ['R3', ['token-1', 'token-2']], '401: token novo e a mesma chamada de novo');

    roteiro = [{ status: 429, headers: { 'retry-after': '0' }, corpo: { code: 429, message: 'You have reached the maximum per-second rate limit' } }, { corpo: { summary_title: 'R4' } }];
    eq((await Zoom.resumo('u4')).summary_title, 'R4', '429 com Retry-After: espera e tenta de novo');

    roteiro = [{ status: 429, headers: { 'retry-after': '3600' }, corpo: { code: 429, message: 'daily limit' } }];
    let longo = null;
    try {
        await Zoom.resumo('u5');
    } catch (e) {
        longo = [e.temporario, e.esperaMs];
    }
    eq(longo, [true, 3600000], 'limite diario: nao espera na chamada, devolve a espera para a fila');

    roteiro = [{ status: 404, corpo: { code: 3001, message: 'Meeting does not exist' } }];
    let nao = null;
    try {
        await Zoom.resumo('u6');
    } catch (e) {
        nao = [e.status, e.codigo, e.temporario];
    }
    eq(nao, [404, 3001, false], '404 nao fica tentando dentro da chamada');

    roteiro = [{ corpo: { participants: [{ name: 'A' }, { name: 'B' }], next_page_token: 'p2' } }, { corpo: { participants: [{ name: 'C' }], next_page_token: '' } }];
    chamadas.length = 0;
    const lista = await Zoom.participantes('/abc==');
    eq([lista.map((p) => p.name), chamadas[0].caminho, chamadas[1].query], [['A', 'B', 'C'], '/v2/report/meetings/%252Fabc%253D%253D/participants', { page_size: '300', next_page_token: 'p2' }], 'participantes: todas as paginas, UUID codificado');

    roteiro = [
        { corpo: { can_download: true, download_url: 'https://zoom.us/rec/meeting/transcript/download/abc' } },
        { corpo: 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nAna: Olá' },
    ];
    eq((await Zoom.transcricao('u7')).texto, 'Ana: Olá', 'transcricao: metadados e download com o token');
    roteiro = [{ corpo: { can_download: true, download_url: 'https://exemplo.com/roubo' } }];
    let fora = null;
    try {
        await Zoom.transcricao('u8');
    } catch (e) {
        fora = e.message;
    }
    eq(fora, 'Link de download da transcrição fora do Zoom: não baixado.', 'o token nunca vai para endereco fora do Zoom');
    roteiro = [{ corpo: { can_download: false, download_restriction_reason: 'NOT_READY' } }];
    eq((await Zoom.transcricao('u9')).texto, null, 'transcricao ainda nao pronta');

    globalThis.fetch = original;
    Sync.pararTimer();

    if (falhas > 0) {
        console.log(`\n${falhas} falha(s).`);
        process.exit(1);
    }
    console.log('\nTudo certo.');
}

principal().catch((e) => {
    console.error(e);
    process.exit(1);
});
