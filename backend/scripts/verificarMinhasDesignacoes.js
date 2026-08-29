/**
 * Verificacao do casamento de nomes e das datas de "Minhas Designacoes".
 *
 *   npm run verificar:designacoes
 *
 * Nao precisa de banco. O risco desta funcionalidade nao e deixar de mostrar um compromisso:
 * e mostrar ao irmao um compromisso que nao e dele. Por isso a maioria dos casos abaixo
 * verifica NAO-casamento.
 */
const S = require('../src/services/MinhasDesignacoesService');
const V = require('../src/services/VinculoIrmaoService');
const { mesmaPessoa, tokens, campoMenciona, datasDaSemana } = S._internos;

let falhas = 0;
const chk = (ok, m) => { console.log(`${ok ? '  OK  ' : ' FALHA'} ${m}`); if (!ok) falhas++; };
const sec = (t) => console.log(`\n=== ${t} ===`);
const iso = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : 'null');
const T = (n) => tokens(n);

sec('casamento de nomes: o que DEVE casar');
chk(mesmaPessoa(T('Cosmírio Carvalho'), 'Cosmirio Carvalho'), 'acento ignorado (a importacao grava sem acento)');
chk(mesmaPessoa(T('Henzel Almeida'), 'Henzel D. Almeida'), 'inicial no meio do nome');
chk(mesmaPessoa(T('José Santos'), 'jose  santos'), 'caixa e espaco duplo');

sec('casamento de nomes: o que NAO PODE casar');
chk(!mesmaPessoa(T('Marcelo Santana'), 'Marcelo Rodrigues'), 'orador visitante com o mesmo primeiro nome');
chk(!mesmaPessoa(T('Ricardo Carvalho'), 'José Ricardo'), 'primeiro nome de um e sobrenome do outro');
chk(!mesmaPessoa(T('Nicholas Santos'), 'Nicholas Silva'), 'mesmo primeiro nome, sobrenome diferente');
chk(!mesmaPessoa(T('Cosmírio Carvalho'), 'Jucimar Carvalho'), 'so o sobrenome em comum');
chk(!mesmaPessoa(T('Walney'), 'Walney Souza'), 'nome de uma palavra exige igualdade exata');

sec('campos com varios nomes');
chk(campoMenciona(T('Olga Pereira e Souza'), 'Olga Pereira e Souza / Maria de Lourdes'),
  '" e " nao e separador: faz parte do nome');
chk(campoMenciona(T('Maria de Lourdes'), 'Olga Pereira e Souza / Maria de Lourdes'), 'acha o segundo nome da dupla');
// O texto abaixo e uma linha de limpeza, mas a LIMPEZA ja nao passa por aqui: ela virou
// tarefa e casa por GRUPO (ver LimpezaGrupoService e verificarLimpezaGrupos.js). O caso
// continua valendo como teste de `campoMenciona` com "&" separando varios nomes, que e o
// formato de outros campos da programacao.
chk(campoMenciona(T('Átilas Santos'), 'Grupos 2 do Átilas Santos & Grupo 3 do Marcelo Santana'),
  '"&" separa: acha o nome do primeiro pedaco');
chk(!campoMenciona(T('José Santos'), 'Grupos 2 do Átilas Santos & Grupo 3 do Marcelo Santana'),
  'e nao acha quem nao esta em pedaco nenhum');

sec('valores que nao sao nome');
['-', '__DELETADO__', '', null, 'A definir', 'Sala B'].forEach(v =>
  chk(!campoMenciona(T('Fulano de Tal'), v), `ignora ${JSON.stringify(v)}`));

sec('datas da semana de reuniao');
let r = datasDaSemana({ faixaData: 'Julho 06 - 12', dataReuniao: '09/07/2026' });
chk(iso(r.meio) === '2026-07-09', `meio de semana = ${iso(r.meio)}`);
chk(iso(r.fds) === '2026-07-12' && r.fds.getDay() === 0, `fim de semana = domingo ${iso(r.fds)}`);

r = datasDaSemana({ faixaData: 'Junho 22 - 28', dataReuniao: '23/06/2026' });
chk(iso(r.fds) === '2026-06-28', 'domingo da mesma semana');

sec('reconciliacao com o rotulo da semana');
// A importacao de marco/2026 gravou o dia certo e o mes errado, decrescendo a cada semana.
r = datasDaSemana({ faixaData: 'Março 9 - 15', dataReuniao: '12/02/2026' });
chk(iso(r.meio) === '2026-03-12' && r.corrigida, `corrige 12/02 -> ${iso(r.meio)} e marca como corrigida`);
r = datasDaSemana({ faixaData: 'Março 16 - 22', dataReuniao: '19/01/2026' });
chk(iso(r.meio) === '2026-03-19', `corrige 19/01 -> ${iso(r.meio)}`);

// Faixas com DOIS meses sao ambiguas: corrigir por elas estraga a data em vez de consertar.
r = datasDaSemana({ faixaData: '29 Junho - 5 Julho', dataReuniao: '02/07/2026' });
chk(iso(r.meio) === '2026-07-02' && !r.corrigida, 'nao mexe em semana que atravessa o mes');
r = datasDaSemana({ faixaData: '27 Junho - 2 Agosto', dataReuniao: '30/07/2026' });
chk(iso(r.meio) === '2026-07-30' && !r.corrigida, 'nao mexe em faixa corrompida com dois meses');

// O dia tem de caber no rotulo para a correcao valer.
r = datasDaSemana({ faixaData: 'Março 9 - 15', dataReuniao: '25/02/2026' });
chk(iso(r.meio) === '2026-02-25' && !r.corrigida, 'dia fora do intervalo do rotulo: nao corrige');

r = datasDaSemana({ faixaData: null, dataReuniao: null });
chk(r.meio === null && r.fds === null, 'semana sem data nao quebra');

sec('sugestao de vinculo usuario -> irmao');
const irmaos = [
  { id: 1, nome: 'Ricardo Carvalho' }, { id: 2, nome: 'Henzel Almeida' },
  { id: 3, nome: 'Marcelo Santana' }, { id: 4, nome: 'Cosmírio Carvalho' },
];
chk(V.sugerirIrmao('Ricardo Carvalho', irmaos)?.confianca === 'exata', 'nome identico -> exata');
chk(V.sugerirIrmao('Henzel D. Almeida', irmaos)?.confianca === 'provavel', 'inicial extra -> provavel');
chk(V.sugerirIrmao('Helber Dias', irmaos) === null, 'quem nao e irmao nao recebe sugestao');
chk(V.sugerirIrmao('Carvalho', irmaos) === null, 'so sobrenome, e ambiguo entre dois -> sem sugestao');
chk(V.sugerirIrmao('Ricardo Carvalho', irmaos, new Set([1])) === null, 'irmao ja vinculado a outra conta nao e sugerido');

console.log(`\n${falhas === 0 ? '*** TODAS AS VERIFICACOES PASSARAM ***' : `*** ${falhas} FALHA(S) ***`}`);
process.exit(falhas === 0 ? 0 : 1);
