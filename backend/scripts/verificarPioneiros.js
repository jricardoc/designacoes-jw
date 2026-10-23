/**
 * Verificacao das regras da area de pioneiros.
 *
 *   npm run verificar:pioneiros
 *
 * Nao precisa de banco: so as regras de PioneiroService. O fluxo com banco esta em
 * verificarPioneirosBanco.js.
 */
const P = require('../src/services/PioneiroService')._internos;

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

console.log('ano de servico');
eq(P.mesesDoAnoDeServico('2026-10'), ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08'], 'outubro: de setembro a agosto');
eq([P.mesesDoAnoDeServico('2027-08')[0], P.mesesDoAnoDeServico('2026-09')[0], P.mesesDoAnoDeServico('2026-03')[0]], ['2026-09', '2026-09', '2025-09'], 'agosto fecha, setembro abre, marco e do ano anterior');

console.log('cronometro');
const agora = new Date('2026-10-23T15:00:00Z');
eq(P.segundosDoCronometro({ cronometroInicio: null, cronometroSeg: 600 }, agora), 600, 'pausado: so o acumulado');
eq(P.segundosDoCronometro({ cronometroInicio: new Date('2026-10-23T14:30:00Z'), cronometroSeg: 600 }, agora), 2400, 'rodando: acumulado + o trecho atual');
eq(P.segundosDoCronometro({ cronometroInicio: new Date('2026-10-23T15:05:00Z'), cronometroSeg: 0 }, agora), 0, 'relogio do aparelho adiantado nao da tempo negativo');

console.log('horas a mao');
const hoje = '2026-10-23';
eq(P.normalizarHoras({ data: '2026-10-22', minutos: 90.4, observacao: '  carrinho ' }, hoje), { horas: { data: '2026-10-22', minutos: 90, observacao: 'carrinho' } }, 'ontem, 1h30');
eq(P.normalizarHoras({ data: '2026-10-24', minutos: 60 }, hoje).erro, 'Escolha um dia até hoje.', 'dia no futuro');
eq(P.normalizarHoras({ data: '2025-01-01', minutos: 60 }, hoje).erro, 'Só dá para lançar horas do último ano.', 'muito antigo');
eq([P.normalizarHoras({ data: hoje, minutos: 0 }, hoje).erro, P.normalizarHoras({ data: hoje, minutos: 1441 }, hoje).erro], ['Informe de 1 minuto a 24 horas.', 'Informe de 1 minuto a 24 horas.'], 'de 1 minuto a 24 horas');

console.log('revisitas');
eq(P.normalizarRevisita({ nome: '  ' }).erro, 'Informe o nome.', 'nome obrigatorio');
const nova = P.normalizarRevisita({ nome: ' Maria ', endereco: 'Rua A, 10', estudo: true, lat: -12.95, lng: -38.36, proximaVisita: '2026-10-25T13:00:00Z' }).revisita;
eq([nova.nome, nova.estudo, nova.lat, nova.proximaVisita.toISOString(), nova.lembreteEm], ['Maria', true, -12.95, '2026-10-25T13:00:00.000Z', null], 'nova, com posicao e visita marcada');
eq(P.normalizarRevisita({ nome: 'X', lat: 200, lng: 10 }).revisita.lat, null, 'coordenada impossivel fica sem posicao');
eq(P.normalizarRevisita({ telefone: '71 9999' }, { parcial: true }).revisita, { telefone: '71 9999' }, 'edicao parcial: so o que veio (o nome nao e exigido)');
eq(P.normalizarRevisita({ proximaVisita: 'amanha' }, { parcial: true }).erro, 'Data da próxima visita inválida.', 'data ilegivel');
eq(P.normalizarRevisita({ proximaVisita: null }, { parcial: true }).revisita, { proximaVisita: null, lembreteEm: null }, 'tirar a visita marcada');

console.log('aviso da visita');
const marcada = (iso, extra = {}) => ({ ativa: true, lembreteEm: null, proximaVisita: new Date(iso), ...extra });
eq([
    P.devoAvisar(marcada('2026-10-23T15:45:00Z'), agora),
    P.devoAvisar(marcada('2026-10-23T16:30:00Z'), agora),
    P.devoAvisar(marcada('2026-10-23T13:30:00Z'), agora),
    P.devoAvisar(marcada('2026-10-23T12:30:00Z'), agora),
    P.devoAvisar(marcada('2026-10-23T15:45:00Z', { lembreteEm: agora }), agora),
    P.devoAvisar(marcada('2026-10-23T15:45:00Z', { ativa: false }), agora),
], [true, false, true, false, false, false], 'avisa ate 1 h antes (e ate 2 h depois, se o servidor esteve fora); uma vez so; arquivada nao');
eq(P.horaDaCongregacao('2026-10-23T18:30:00Z'), '15:30', 'hora no relogio da congregacao');

console.log('contatos');
const sit = (iso) => P.situacaoDoContato({ proximaVisita: iso ? new Date(iso) : null }, '2026-10-23');
eq([sit(null), sit('2026-10-23T02:00:00Z'), sit('2026-10-23T18:00:00Z'), sit('2026-10-25T13:00:00Z'), sit('2026-10-30T13:00:00Z')], ['semData', 'atrasada', 'hoje', 'breve', 'marcada'], 'situacao: 23h de ontem (no relogio da congregacao) ja e atrasada; ate 3 dias e breve');
eq(P.inicioDoDia('2026-10-23').toISOString(), '2026-10-23T03:00:00.000Z', 'meia-noite da congregacao em UTC');

console.log('emblemas');
eq([P.nivelDe(0, [1, 3, 6]), P.nivelDe(3, [1, 3, 6]), P.nivelDe(7, [1, 3, 6])], [
    { nivel: null, proximo: { nivel: 'bronze', falta: 1 } },
    { nivel: 'prata', proximo: { nivel: 'ouro', falta: 3 } },
    { nivel: 'ouro', proximo: null },
], 'nivel e o que falta para o proximo');
const constancia = (meses) => P.emblemas({ mesesComMeta: meses, visitas: 0, estudos: 0, dias: 0 })[0].valor;
eq([constancia([true, true, true, false]), constancia([false, true, true, true]), constancia([true, false, false]), constancia([true, true, false, true, true])], [3, 3, 0, 2],
    'meses seguidos com a meta: o mes atual so conta quando ja bateu; o anterior sem meta quebra');
const todos = P.emblemas({ mesesComMeta: [true], visitas: 16, estudos: 2, dias: 12 });
eq(todos.map((e) => [e.id, e.nivel]), [['constancia', 'bronze'], ['regando', 'prata'], ['estudos', 'bronze'], ['pronto', 'ouro']], 'os quatro emblemas');
eq([P.statusDoMes({ mes: '2026-11', minutos: 0, meta: 50, mesAtual: '2026-10' }), P.statusDoMes({ mes: '2026-09', minutos: 3000, meta: 50, mesAtual: '2026-10' }), P.statusDoMes({ mes: '2026-10', minutos: 600, meta: 50, mesAtual: '2026-10' }), P.statusDoMes({ mes: '2026-08', minutos: 0, meta: 50, mesAtual: '2026-10' })],
    ['futuro', 'meta', 'parcial', 'vazio'], 'status por mes');

console.log('agenda e viagens');
eq(P.normalizarPlano({ data: '2026-10-24', hora: '09:30', duracaoMin: 120, local: ' Praça ' }, '2026-10-23'), { plano: { data: '2026-10-24', hora: '09:30', duracaoMin: 120, local: 'Praça', nota: null } }, 'plano de sabado');
eq([P.normalizarPlano({ data: '2026-10-22', hora: '09:30' }, '2026-10-23').erro, P.normalizarPlano({ data: '2026-10-24', hora: '9h' }, '2026-10-23').erro, P.normalizarPlano({ data: '2026-10-24', hora: '09:30', duracaoMin: 5 }, '2026-10-23').erro],
    ['Escolha um dia de hoje em diante.', 'Hora inválida.', 'Duração de 15 minutos a 12 horas.'], 'plano no passado, hora ruim, duracao curta');
eq(P.normalizarViagem({ data: '2026-10-23', km: '12,5', custo: '14,7' }, '2026-10-23'), { viagem: { data: '2026-10-23', km: 12.5, custo: 14.7, nota: null } }, 'viagem com virgula decimal');
eq([P.normalizarViagem({ data: '2026-10-24', km: 10 }, '2026-10-23').erro, P.normalizarViagem({ data: '2026-10-23', km: 0 }, '2026-10-23').erro], ['Escolha um dia até hoje.', 'Informe a distância em km.'], 'viagem no futuro, sem km');

console.log('calendario');
const ics = P.montarIcs([{ uid: 'plano-1', inicio: '2026-10-24T12:30:00Z', fim: '2026-10-24T14:30:00Z', titulo: 'Ministério', local: 'Praça, 10; fundos', descricao: `${'x'.repeat(100)} 🙂` }], { agora });
const linhasIcs = ics.split('\r\n');
eq([linhasIcs[0], linhasIcs.includes('DTSTART:20261024T123000Z'), linhasIcs.includes('LOCATION:Praça\\, 10\\; fundos'), ics.endsWith('END:VCALENDAR\r\n')], ['BEGIN:VCALENDAR', true, true, true], 'evento em UTC, texto escapado, linhas com CRLF');
eq([linhasIcs.every((l) => Array.from(l).length <= 75), linhasIcs.some((l) => l.startsWith(' x')), ics.includes('🙂')], [true, true, true], 'linha longa dobrada, sem partir o emoji');

if (falhas > 0) {
    console.log(`\n${falhas} falha(s).`);
    process.exit(1);
}
console.log('\nTudo certo.');
