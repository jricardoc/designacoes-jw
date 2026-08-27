/**
 * Verificacao das datas geradas pelo preview de indisponibilidade da importacao.
 *
 *   npm run verificar:indisponibilidade-import
 *
 * Nao precisa de banco: buildIndisponibilidadePreview e puro.
 *
 * Por que isto existe: o arquivo importado traz UMA data por semana, a do meio de semana.
 * O fim de semana nao tem data no arquivo — e o domingo que fecha aquela mesma semana. O
 * preview usava a data do meio de semana para TUDO, entao quem so servia no domingo era
 * marcado como ocupado na quinta: o dia errado ficava bloqueado no quadro e o dia em que o
 * irmao realmente serve continuava livre para o gerador escalar de novo.
 */
const { buildIndisponibilidadePreview, CAMPOS, formatarDiaMes } = require('../src/services/MatchIrmaosService');
const { CAMPOS_REUNIAO } = require('../src/services/MinhasDesignacoesService');

let falhas = 0;
const chk = (ok, m) => { console.log(`${ok ? '  OK  ' : ' FALHA'} ${m}`); if (!ok) falhas++; };
const sec = (t) => console.log(`\n=== ${t} ===`);

// 03/09/2026 e uma quinta; o domingo que fecha essa semana e 06/09.
const IRMAOS = [
    { id: 1, nome: 'Edilson Santos' },
    { id: 2, nome: 'José Santos' },
    { id: 3, nome: 'Miguel Alves' },
];
const preview = (semanas) => buildIndisponibilidadePreview(semanas, IRMAOS);
const datasDe = (p, irmaoId) => {
    const e = p.confirmados.find(c => c.irmaoId === irmaoId);
    return e ? e.datas.map(d => d.data) : [];
};
const partesEm = (p, irmaoId, data) => {
    const e = p.confirmados.find(c => c.irmaoId === irmaoId);
    const d = e && e.datas.find(x => x.data === data);
    return d ? d.partes : [];
};

sec('parte de meio de semana x parte de fim de semana');
const p1 = preview([{
    dataReuniao: '03/09/2026',
    presidente: 'Edilson Santos',
    fds_presidente: 'José Santos',
    fds_leitor: 'Miguel Alves',
}]);
chk(datasDe(p1, 1).join() === '03/09', 'parte de meio de semana marca a quinta');
chk(datasDe(p1, 2).join() === '06/09', 'presidente do fim de semana marca o DOMINGO, nao a quinta');
chk(datasDe(p1, 3).join() === '06/09', 'leitor de A Sentinela marca o domingo');

sec('mesmo irmao servindo nos dois dias da semana');
const p2 = preview([{
    dataReuniao: '03/09/2026',
    presidente: 'Edilson Santos',
    oracaoInicial: 'Edilson Santos',
    fds_leitor: 'Edilson Santos',
}]);
chk(datasDe(p2, 1).join() === '03/09,06/09',
    'vira DUAS datas — era o bug: as duas partes caiam na mesma quinta');
chk(partesEm(p2, 1, '03/09').length === 2, 'as duas partes de meio de semana continuam agrupadas no mesmo dia');
chk(partesEm(p2, 1, '06/09').join() === 'Leitor da Sentinela', 'o domingo leva so a parte do fim de semana');

sec('o domingo pode cair no mes seguinte');
// 30/09/2026 e uma quarta; o domingo que fecha a semana e 04/10 — mes seguinte. Por isso a
// data do fim de semana sai de aritmetica de Date, e nao do mes da Reuniao.
const p3 = preview([{ dataReuniao: '30/09/2026', fds_orador: 'José Santos' }]);
chk(datasDe(p3, 2).join() === '04/10', 'semana que atravessa o mes marca o domingo de outubro');
// 30/12/2026 e uma quarta; fecha em 03/01/2027.
const p4 = preview([{ dataReuniao: '30/12/2026', fds_orador: 'José Santos' }]);
chk(datasDe(p4, 2).join() === '03/01', 'semana que atravessa o ano nao quebra');

sec('reuniao no proprio domingo e datas ilegiveis');
const p5 = preview([{ dataReuniao: '06/09/2026', presidente: 'Edilson Santos', fds_presidente: 'José Santos' }]);
chk(datasDe(p5, 1).join() === '06/09' && datasDe(p5, 2).join() === '06/09',
    'se a data ja for domingo, os dois momentos caem nela');
const p6 = preview([{ dataReuniao: null, presidente: 'Edilson Santos', fds_presidente: 'José Santos' }]);
chk(p6.confirmados.length === 0, 'semana sem data nao inventa indisponibilidade');
chk(preview([]).confirmados.length === 0, 'lista vazia nao quebra');

sec('formato da data (o mesmo do quadro e da tabela Indisponibilidade)');
chk(formatarDiaMes('3/9/2026') === '03/09', 'dia e mes saem com dois digitos');
chk(formatarDiaMes(new Date(2026, 8, 6)) === '06/09', 'aceita Date tambem');
chk(formatarDiaMes(null) === null && formatarDiaMes('quinta') === null, 'valor ilegivel devolve null');
chk(formatarDiaMes(new Date('nao e data')) === null, 'Date invalido devolve null');

sec('as duas listas de campos concordam sobre o dia de cada parte');
// MatchIrmaosService (importacao) e MinhasDesignacoesService (agenda do irmao) tem listas
// separadas de proposito — os rotulos sao diferentes — mas se discordarem do `momento`, o
// irmao ve a designacao num dia e fica bloqueado em outro.
const momentoNaAgenda = new Map(CAMPOS_REUNIAO.map(c => [c.campo, c.momento]));
const divergentes = CAMPOS.filter(c => momentoNaAgenda.get(c.campo) !== c.momento);
chk(divergentes.length === 0,
    `nenhum campo com momento divergente${divergentes.length ? ': ' + divergentes.map(c => c.campo).join(', ') : ''}`);
chk(CAMPOS.every(c => momentoNaAgenda.has(c.campo)),
    'todo campo do preview existe na lista da agenda');
chk(CAMPOS.every(c => c.momento === 'meio' || c.momento === 'fds'),
    'todo campo do preview tem um dia proprio (o preview nao marca parte de "semana inteira")');
chk(CAMPOS.filter(c => c.momento === 'fds').length === 3,
    'as tres partes de fim de semana do arquivo estao cobertas');

console.log(`\n${falhas === 0 ? '*** TODAS AS VERIFICACOES PASSARAM ***' : `*** ${falhas} FALHA(S) ***`}`);
process.exit(falhas === 0 ? 0 : 1);
