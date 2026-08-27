/**
 * Verificacao do rotulo da semana (`faixaData`) na importacao da programacao.
 *
 *   npm run verificar:semana-reuniao
 *
 * Nao precisa de banco: `reconciliarSemanas` e puro.
 *
 * Por que isto existe: o PDF de SETEMBRO/2026 chegou com a primeira semana sem a faixa de
 * datas ao lado do cabecalho. Como `faixaData` e NOT NULL, o `createMany` da importacao
 * morria com "Argument `faixaData` is missing" e o MES INTEIRO era recusado — por causa de
 * um titulo, com todas as designacoes ja lidas corretamente. O invariante testado aqui e
 * simples: nenhuma semana sai de `reconciliarSemanas` sem `faixaData` utilizavel.
 */
const R = require('../src/utils/semanaReuniao');

let falhas = 0;
const chk = (ok, m) => { console.log(`${ok ? '  OK  ' : ' FALHA'} ${m}`); if (!ok) falhas++; };
const sec = (t) => console.log(`
=== ${t} ===`);

sec('rotulo reconstruido a partir da data da reuniao');
// 10/09/2026 e uma quinta; a semana vai de segunda 07 a domingo 13.
chk(R.rotuloDaSemana('10/09/2026') === '07 - 13 de Setembro',
    'semana dentro do mes sai no mesmo formato do arquivo ("07 - 13 de Setembro")');
chk(R.rotuloDaSemana('03/09/2026') === '31 de Agosto - 06 de Setembro',
    'semana que atravessa o mes cita os dois meses');
chk(R.rotuloDaSemana('30/12/2026') === '28 de Dezembro - 03 de Janeiro',
    'semana que atravessa o ano nao quebra');
chk(R.rotuloDaSemana('13/09/2026') === '07 - 13 de Setembro',
    'reuniao no proprio domingo continua na semana que fecha nele');
chk(R.rotuloDaSemana('04/03/2026') === '02 - 08 de Março',
    'mes com cedilha sai acentuado (o rotulo vai para a tela)');
chk(R.rotuloDaSemana(null) === null && R.rotuloDaSemana('sem data') === null,
    'data ilegivel devolve null em vez de inventar rotulo');

sec('semana sem rotulo no arquivo (o caso de setembro/2026)');
const setembro = R.reconciliarSemanas([
    { faixaData: null, dataReuniao: '03/09/2026', presidente: 'Edilson Santos' },
    { faixaData: '07 - 13 de Setembro', dataReuniao: '10/09/2026' },
]);
chk(setembro.semanas[0].faixaData === '31 de Agosto - 06 de Setembro',
    'a semana sem faixa ganha o rotulo derivado da data');
chk(setembro.semanas[0].presidente === 'Edilson Santos',
    'o resto da semana passa intacto');
chk(setembro.semanas[1].faixaData === '07 - 13 de Setembro',
    'semana que ja tinha rotulo nao e reescrita');
chk(setembro.avisos.some(a => a.includes('31 de Agosto - 06 de Setembro')),
    'quem importou e avisado de qual rotulo foi usado');
chk(setembro.avisos.length === 1, 'so a semana afetada gera aviso');

sec('invariante: nunca sai faixaData vazia para o banco');
const limite = R.reconciliarSemanas([
    { faixaData: null, dataReuniao: null },
    { faixaData: '   ', dataReuniao: '17/09/2026' },
    { faixaData: undefined, dataReuniao: 'data quebrada' },
]);
chk(limite.semanas.every(s => typeof s.faixaData === 'string' && s.faixaData.trim() !== ''),
    'toda semana sai com faixaData string e nao vazia (a coluna e NOT NULL)');
chk(limite.semanas[0].faixaData === R.SEM_ROTULO && limite.semanas[2].faixaData === R.SEM_ROTULO,
    'sem data legivel cai no rotulo generico em vez de derrubar a importacao');
chk(limite.semanas[1].faixaData === '14 - 20 de Setembro',
    'faixa so com espacos conta como ausente');
chk(R.reconciliarSemanas([]).semanas.length === 0 && R.reconciliarSemanas(null).semanas.length === 0,
    'lista vazia ou nula nao quebra');

sec('regressao: a reconciliacao de data continua valendo');
// Caso real da planilha de marco/2026: dia certo, mes errado.
const marco = R.reconciliarSemanas([{ faixaData: 'Março 9 - 15', dataReuniao: '12/02/2026' }]);
chk(marco.semanas[0].dataReuniao === '12/03/2026', 'data com mes divergente do rotulo e corrigida');
chk(marco.avisos.length === 1, 'a correcao de data continua avisando');
chk(marco.semanas[0].faixaData === 'Março 9 - 15', 'rotulo existente sobrevive a correcao de data');

// Faixa derivada de semana que atravessa o mes cita dois meses de proposito: precisa ser
// ambigua para `faixaInequivoca` NAO usa-la para "corrigir" a data que a gerou.
chk(R.faixaInequivoca(R.rotuloDaSemana('03/09/2026')) === null,
    'rotulo derivado que atravessa o mes nao e usado para reescrever a data de origem');
const semDeriva = R.reconciliarSemanas([{ faixaData: null, dataReuniao: '03/09/2026' }]);
chk(semDeriva.semanas[0].dataReuniao === '03/09/2026',
    'derivar o rotulo nao mexe na data da reuniao');

console.log(`
${falhas === 0 ? '*** TODAS AS VERIFICACOES PASSARAM ***' : `*** ${falhas} FALHA(S) ***`}`);
process.exit(falhas === 0 ? 0 : 1);
