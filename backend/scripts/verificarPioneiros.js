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

if (falhas > 0) {
    console.log(`\n${falhas} falha(s).`);
    process.exit(1);
}
console.log('\nTudo certo.');
