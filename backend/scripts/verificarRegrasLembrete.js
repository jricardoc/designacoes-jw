/**
 * Verificacao da aritmetica das regras de antecedencia (RegrasLembrete).
 *
 *   npm run verificar:regras-lembrete
 *
 * Nao precisa de banco: o modulo e puro e recebe o "agora" de fora.
 *
 * Por que isto existe: lembrete na hora errada NAO gera erro. O push sai, chega tarde (ou
 * cedo demais) e ninguem descobre ate um irmao perder a designacao. Os casos abaixo fixam o
 * relogio e conferem os limites — sobretudo os :30, que um agendador de hora cheia erraria.
 */
const R = require('../src/services/RegrasLembrete');

let falhas = 0;
const chk = (ok, m) => { console.log(`${ok ? '  OK  ' : ' FALHA'} ${m}`); if (!ok) falhas++; };
const sec = (t) => console.log(`\n=== ${t} ===`);

const CONFIG = { horaMeioSemana: '19:30', horaFimDeSemana: '09:00' };
// 05/08/2026 e uma quarta-feira; 09/08/2026 e um domingo.
const QUARTA = '2026-08-05';
const DOMINGO = '2026-08-09';
const item = (dataISO, extra = {}) => ({ dataISO, tipo: 'designacao', ...extra });
const hhmm = (d) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
const iso = (d) => d.toISOString().slice(0, 10);

sec('horario do compromisso');
chk(R.horaDoCompromisso(item(QUARTA), CONFIG) === '19:30', 'quarta usa o horario de meio de semana');
chk(R.horaDoCompromisso(item(DOMINGO), CONFIG) === '09:00', 'domingo usa o horario de fim de semana');
chk(R.horaDoCompromisso(item('2026-08-08'), CONFIG) === '09:00', 'sabado tambem conta como fim de semana');
chk(R.horaDoCompromisso(item(QUARTA, { horario: '08:00' }), CONFIG) === '08:00',
    'saida de campo com horario proprio ganha do horario da reuniao');
chk(R.horaDoCompromisso(item(QUARTA), null) === '19:30',
    'sem Config gravada cai no padrao em vez de quebrar');

sec('dia sobre o qual cada regra fala');
chk(R.diaAlvo(QUARTA, R.regraPorId('1d')) === '2026-08-06', '1 dia antes: hoje fala do dia seguinte');
chk(R.diaAlvo(QUARTA, R.regraPorId('7d')) === '2026-08-12', '1 semana antes: hoje fala de daqui a 7 dias');
chk(R.diaAlvo(QUARTA, R.regraPorId('3h')) === QUARTA, 'regra por hora sempre fala do proprio dia');
chk(R.diaAlvo('2026-08-30', R.regraPorId('3d')) === '2026-09-02', 'a soma atravessa a virada do mes');
chk(R.diaAlvo('2028-02-27', R.regraPorId('3d')) === '2028-03-01', 'ano bissexto: 27/02 + 3 = 01/03');

sec('instante do disparo');
const alvo1d = R.instanteDoDisparo(QUARTA, R.regraPorId('1d'), [item(QUARTA)], CONFIG);
chk(iso(alvo1d) === '2026-08-04' && hhmm(alvo1d) === '19:00', '1 dia antes dispara as 19:00 da vespera');

const alvo7d = R.instanteDoDisparo(QUARTA, R.regraPorId('7d'), [item(QUARTA)], CONFIG);
chk(iso(alvo7d) === '2026-07-29' && hhmm(alvo7d) === '19:00',
    '1 semana antes dispara as 19:00 de 7 dias antes, atravessando o mes');

const alvo3h = R.instanteDoDisparo(QUARTA, R.regraPorId('3h'), [item(QUARTA)], CONFIG);
chk(iso(alvo3h) === QUARTA && hhmm(alvo3h) === '16:30',
    '3 horas antes de uma reuniao 19:30 cai as 16:30 — na MEIA hora, que e o que obriga o tique de 15 min');

const alvo1hDom = R.instanteDoDisparo(DOMINGO, R.regraPorId('1h'), [item(DOMINGO)], CONFIG);
chk(iso(alvo1hDom) === DOMINGO && hhmm(alvo1hDom) === '08:00', '1 hora antes de um domingo 09:00 cai as 08:00');

const alvoSaida = R.instanteDoDisparo(DOMINGO, R.regraPorId('1h'), [item(DOMINGO, { horario: '07:30' })], CONFIG);
chk(hhmm(alvoSaida) === '06:30', 'a saida de campo das 07:30 manda no calculo, nao a reuniao das 09:00');

const doisItens = [item(DOMINGO), item(DOMINGO, { horario: '07:30' })];
chk(hhmm(R.instanteDoDisparo(DOMINGO, R.regraPorId('1h'), doisItens, CONFIG)) === '06:30',
    'com dois compromissos no dia vale o mais cedo — senao o lembrete chegaria depois do primeiro');

sec('janela de vencimento');
const GRACA = 6 * 60 * 60 * 1000;
const t = (dataISO, hora) => R.instanteDe(dataISO, hora);
chk(R.estaVencida(t(QUARTA, '16:30'), t(QUARTA, '16:30'), GRACA), 'vence no instante exato');
chk(R.estaVencida(t(QUARTA, '16:30'), t(QUARTA, '16:45'), GRACA), 'ainda vale 15 min depois (tique seguinte)');
chk(R.estaVencida(t(QUARTA, '16:30'), t(QUARTA, '22:00'), GRACA), 'ainda vale 5h30 depois (container reiniciou)');
chk(!R.estaVencida(t(QUARTA, '16:30'), t(QUARTA, '16:15'), GRACA), 'nao dispara antes da hora');
chk(!R.estaVencida(t(QUARTA, '16:30'), t('2026-08-06', '00:00'), GRACA),
    'passou da graca: nao dispara lembrete velho');
chk(!R.estaVencida(t('2026-07-29', '19:00'), t(QUARTA, '19:00'), GRACA),
    'ligar a regra "1 semana antes" hoje nao dispara de uma vez os alvos ja vencidos');

sec('preferencia');
const vazia = R.normalizarPreferencia({});
chk(vazia.antecedencias.join() === '1d', 'sem nada informado cai em "1 dia antes" (o comportamento antigo)');
chk(vazia.tipos.length === 3, 'sem nada informado todos os tipos ficam ligados');
chk(R.normalizarPreferencia({ antecedencias: ['1d', '9z'], tipos: ['designacao', 'xpto'] })
    .antecedencias.join() === '1d', 'id de regra inventado e descartado');
chk(R.normalizarPreferencia({ tipos: ['designacao', 'xpto'] }).tipos.join() === 'designacao',
    'tipo inventado e descartado');
chk(R.normalizarPreferencia({ antecedencias: ['1d', '1d'] }).antecedencias.length === 1,
    'repetido nao vira dois push');
chk(R.normalizarPreferencia({ antecedencias: [], tipos: [] }).antecedencias.length === 0,
    'lista vazia e respeitada: quem desliga tudo fica sem lembrete');

sec('catalogo');
chk(R.REGRAS.every(r => r.titulo && r.quando), 'toda regra tem titulo e texto de "quando" para o push');
chk(R.REGRAS.every(r => (r.dias && r.hora) || r.horasAntes),
    'toda regra sabe disparar: ou por dias+hora fixa, ou por horas antes da reuniao');
chk(new Set(R.REGRAS.map(r => r.id)).size === R.REGRAS.length, 'ids de regra sao unicos');

console.log(`\n${falhas === 0 ? '*** TODAS AS VERIFICACOES PASSARAM ***' : `*** ${falhas} FALHA(S) ***`}`);
process.exit(falhas === 0 ? 0 : 1);
