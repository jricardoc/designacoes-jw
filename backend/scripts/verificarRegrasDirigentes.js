/**
 * Verificacao da REGRA DE OURO do rodizio (dirigentes e designacoes mecanicas).
 *
 *   npm run verificar:dirigentes
 *
 * Nao precisa de banco: o nucleo de decisao (EscalaDirigenteAlgoritmo.gerarEscala) e uma
 * funcao pura e o rodizio do quadro mecanico (AutoDesignacaoService.montarFilas/puxarDaFila)
 * tambem, entao os casos abaixo montam o universo na mao.
 *
 * A regra que estes casos protegem, na descricao do usuario: "primeiro voce distribui todos,
 * e quando todos ja estiverem distribuidos, vai distribuindo os seguintes que foram os
 * primeiros". Traduzindo em invariantes verificaveis:
 *
 *   (a) ninguem repete antes de todos terem servido uma vez;
 *   (b) quem nao pode servir num dia PULA E MANTEM A VEZ - nao perde o lugar na fila;
 *   (c) o segundo ciclo sai na mesma ordem em que o primeiro foi servido;
 *   (d) a fila do mes N comeca onde a do mes N-1 terminou.
 *
 * As RESTRICOES (vinculo com a saida, indisponibilidade na data, sobreposicao de horario)
 * continuam valendo por cima do rodizio e tem bloco proprio no fim.
 */
const { gerarEscala } = require('../src/services/EscalaDirigenteAlgoritmo');
const Auto = require('../src/services/AutoDirigenteService');
const AutoDesignacao = require('../src/services/AutoDesignacaoService');

let falhas = 0;
const chk = (ok, m) => { console.log(`${ok ? '  OK  ' : ' FALHA'} ${m}`); if (!ok) falhas++; };
const sec = (t) => console.log(`\n=== ${t} ===`);

// --------------------------------------------------------------------------
// Cenario principal: 6 irmaos, 12 turnos, e um deles so dirige na SEGUNDA.
// --------------------------------------------------------------------------
// Janeiro/2026: 05, 12, 19 e 26 caem na segunda-feira. Escolhemos as datas de modo que a
// SEXTA vaga e a DECIMA SEGUNDA caiam numa segunda: assim Harison passa cinco turnos seguidos
// sendo pulado e mesmo assim continua na frente da fila. E o caso da planilha, em que ele
// reaparece duas semanas depois sem ter servido no meio.
const DIAS = [
  ['06/01', 6, 'Terca'], ['07/01', 7, 'Quarta'], ['08/01', 8, 'Quinta'],
  ['09/01', 9, 'Sexta'], ['10/01', 10, 'Sabado'], ['12/01', 12, 'SEGUNDA'],
  ['13/01', 13, 'Terca'], ['14/01', 14, 'Quarta'], ['15/01', 15, 'Quinta'],
  ['16/01', 16, 'Sexta'], ['17/01', 17, 'Sabado'], ['19/01', 19, 'SEGUNDA'],
];

const SEGUNDAS = DIAS.filter(([, , nome]) => nome === 'SEGUNDA').map(([data]) => data);
const NAO_SEGUNDAS = DIAS.filter(([, , nome]) => nome !== 'SEGUNDA').map(([data]) => data);

const turnos12 = DIAS.map(([data, dia], i) => ({
  id: i + 1, data, dataObj: new Date(2026, 0, dia), saidaCampoId: 1, turno: 1, local: 'Casa A',
}));

// Harison nao aparece no historico -> "nunca serviu" -> frente da fila. Os outros cinco tem
// `ordem` explicita, entao a fila inicial e deterministicamente [Harison, Bruno..Fabio].
const CINCO = ['Bruno', 'Caio', 'Diego', 'Elias', 'Fabio'];
const historicoBase = {};
CINCO.forEach((nome, i) => { historicoBase[nome] = { designacoes: 1, ordem: i + 1 }; });

const seisIrmaos = [
  // "so dirige na segunda" e modelado como indisponibilidade em todas as outras datas.
  { nome: 'Harison', saidaCampoIds: [1], indisponiveis: NAO_SEGUNDAS },
  ...CINCO.map(nome => ({ nome, saidaCampoIds: [1], indisponiveis: [] })),
];

const r = gerarEscala({ vagasBase: turnos12, dirigentes: seisIrmaos, historico: historicoBase, regras: {} });
const escala = turnos12.map(t => r.atribuicoes.find(a => a.id === t.id).principal);

console.log('  fila inicial : ' + r.diagnostico.rodizio.filaInicial.join(' -> '));
DIAS.forEach(([data, , nome], i) => console.log(`  ${data} (${nome.padEnd(7)}) -> ${escala[i]}`));

sec('(a) ninguem repete antes de todos servirem');
const ciclo1 = escala.slice(0, 6);
const ciclo2 = escala.slice(6, 12);
chk(escala.every(Boolean), 'as 12 vagas foram preenchidas');
chk(new Set(ciclo1).size === 6, `os 6 primeiros turnos tem 6 nomes distintos: ${ciclo1.join(', ')}`);
chk(new Set(ciclo2).size === 6, `os 6 turnos seguintes tem 6 nomes distintos: ${ciclo2.join(', ')}`);

sec('(b) quem nao serve num dia MANTEM A VEZ');
// Harison e o primeiro da fila e e pulado nas cinco datas que nao sao segunda. Se ele
// perdesse a vez, cairia para o fim e so serviria muito depois - ou nunca.
chk(escala[5] === 'Harison',
  `Harison, primeiro da fila, e pulado em ${NAO_SEGUNDAS.slice(0, 5).join(', ')} e serve na primeira segunda (${SEGUNDAS[0]} -> ${escala[5]})`);
chk(escala.slice(0, 5).every(n => n !== 'Harison'), 'e nao foi forcado em nenhuma data em que nao dirige');
chk(escala.filter(n => n === 'Harison').length === 2,
  `serve exatamente nas 2 segundas do periodo (${escala.filter(n => n === 'Harison').length})`);
chk(escala[11] === 'Harison', `e reaparece na segunda seguinte (${SEGUNDAS[1]} -> ${escala[11]})`);

sec('(c) o segundo ciclo sai na mesma ordem do primeiro');
chk(ciclo1.join(' > ') === ciclo2.join(' > '),
  `ciclo 1 [${ciclo1.join(', ')}] == ciclo 2 [${ciclo2.join(', ')}]`);
chk(r.diagnostico.rodizio.ciclosCompletos === 2, `o diagnostico conta 2 ciclos fechados (${r.diagnostico.rodizio.ciclosCompletos})`);
chk(r.diagnostico.semDesignacao.length === 0, 'ninguem fica de fora do rodizio');

sec('rodizio puro: 6 irmaos sem nenhuma restricao');
// Sem restricao alguma o rodizio tem de ser a fila girando, sem surpresa.
const livres = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'].map(nome => ({ nome, saidaCampoIds: [1], indisponiveis: [] }));
const rLivre = gerarEscala({ vagasBase: turnos12, dirigentes: livres, historico: {}, regras: {} });
const escLivre = turnos12.map(t => rLivre.atribuicoes.find(a => a.id === t.id).principal);
chk(escLivre.slice(0, 6).join() === 'A1,A2,A3,A4,A5,A6',
  `sem historico a fila e alfabetica e gira na ordem: ${escLivre.slice(0, 6).join(' ')}`);
chk(escLivre.slice(0, 6).join() === escLivre.slice(6).join(), 'e o ciclo 2 repete o ciclo 1 exatamente');
const cargas = rLivre.diagnostico.porIrmao.map(p => p.designacoes);
chk(Math.max(...cargas) - Math.min(...cargas) === 0, `todos com a mesma carga (${cargas.join(',')})`);

sec('(d) a fila do mes N comeca onde a do mes N-1 terminou');
// `filaFinal` e o estado com que o mes fecha; o mes seguinte o recebe como `ordem` no historico.
const filaFinal = r.diagnostico.rodizio.filaFinal;
chk(filaFinal.length === 6, `filaFinal exposta para o proximo mes: ${filaFinal.join(' -> ')}`);
chk(filaFinal[filaFinal.length - 1] === escala[11], 'quem serviu por ultimo esta no FIM da fila final');

const historicoMes2 = {};
filaFinal.forEach((nome, i) => { historicoMes2[nome] = { designacoes: 2, ordem: i + 1 }; });
const turnosMes2 = turnos12.slice(0, 6).map((t, i) => ({ ...t, id: 100 + i }));
const rMes2 = gerarEscala({ vagasBase: turnosMes2, dirigentes: seisIrmaos, historico: historicoMes2, regras: {} });
chk(rMes2.diagnostico.rodizio.filaInicial.join() === filaFinal.join(),
  'o mes 2 abre com exatamente a fila com que o mes 1 fechou');
const primeiroMes2 = turnosMes2.map(t => rMes2.atribuicoes.find(a => a.id === t.id).principal)[0];
chk(primeiroMes2 !== escala[11],
  `quem fechou o mes 1 (${escala[11]}) nao abre o mes 2 (${primeiroMes2}) - sem historico ele abriria servindo de novo`);

sec('sem historico, quem nunca serviu vem antes de quem ja serviu');
const rNovato = gerarEscala({
  vagasBase: turnos12.slice(0, 3),
  dirigentes: [
    { nome: 'Veterano', saidaCampoIds: [1], indisponiveis: [] },
    { nome: 'Zeca', saidaCampoIds: [1], indisponiveis: [] }, // nunca serviu, e ultimo no alfabeto
  ],
  historico: { Veterano: { designacoes: 30, ordem: 999 } },
  regras: {},
});
chk(rNovato.diagnostico.rodizio.filaInicial[0] === 'Zeca',
  `quem nunca serviu fica na frente de todos, mesmo perdendo no alfabeto: ${rNovato.diagnostico.rodizio.filaInicial.join(' -> ')}`);

sec('determinismo (o rodizio nao usa sorteio)');
const args = { vagasBase: turnos12, dirigentes: seisIrmaos, historico: historicoBase, regras: {} };
chk(JSON.stringify(gerarEscala(args).atribuicoes) === JSON.stringify(gerarEscala(args).atribuicoes),
  'duas execucoes com a mesma entrada produzem exatamente a mesma escala');
// Na criacao o id da vaga e indice de array; na regeracao e o id do banco. A escala tem de ser
// a mesma nos dois casos - o id nao pode influenciar a escolha.
const comoRegeracao = turnos12.map((v, i) => ({ ...v, id: 5000 + i * 7 }));
const rReg = gerarEscala({ ...args, vagasBase: comoRegeracao });
chk(comoRegeracao.map(t => rReg.atribuicoes.find(a => a.id === t.id).principal).join() === escala.join(),
  'gerar e regerar o mesmo mes produz escala identica, com ids diferentes');

// --------------------------------------------------------------------------
sec('RESTRICAO: vinculo com a saida de campo');
const rVinculo = gerarEscala({
  vagasBase: [
    { id: 1, data: '05/01', dataObj: new Date(2026, 0, 5), saidaCampoId: 1, turno: 1, local: 'A' },
    { id: 2, data: '06/01', dataObj: new Date(2026, 0, 6), saidaCampoId: 2, turno: 1, local: 'B' },
  ],
  dirigentes: [{ nome: 'SoNaA', saidaCampoIds: [1], indisponiveis: [] }],
  historico: {}, regras: {},
});
chk(rVinculo.atribuicoes.find(a => a.id === 1).principal === 'SoNaA', 'dirige a saida a que esta vinculado');
chk(rVinculo.atribuicoes.find(a => a.id === 2).principal === '', 'e a saida a que NAO esta vinculado fica vazia');

sec('RESTRICAO: indisponibilidade na data e dura (nunca relaxada)');
const rInd = gerarEscala({
  vagasBase: turnos12.slice(0, 4),
  dirigentes: seisIrmaos.map(d => ({ ...d, indisponiveis: DIAS.map(([data]) => data) })),
  historico: historicoBase, regras: {},
});
chk(rInd.diagnostico.vagasPreenchidas === 0, 'todos indisponiveis -> nenhuma vaga preenchida (nao force ninguem)');
chk(!rInd.diagnostico.regrasRelaxadas.respeitarIndisponibilidades, 'indisponibilidade nunca aparece como relaxada');
chk(rInd.diagnostico.avisos.some(a => a.tipo === 'vaga_vazia'), 'avisa cada vaga que ficou vazia');

sec('RESTRICAO: ninguem em dois lugares no mesmo horario');
// Espelha os dados reais: sabado turno 1 e turno 3 sao AMBOS 08:45, em casas diferentes.
const sabado = new Date(2026, 0, 3);
const mesmoHorario = [
  { id: 1, data: '03/01', dataObj: sabado, saidaCampoId: 1, turno: 1, local: 'Casa A', horario: '08:45' },
  { id: 2, data: '03/01', dataObj: sabado, saidaCampoId: 3, turno: 3, local: 'Casa B', horario: '08:45' },
  { id: 3, data: '03/01', dataObj: sabado, saidaCampoId: 2, turno: 2, local: 'Casa C', horario: '16:00' },
];
const rHor = gerarEscala({
  vagasBase: mesmoHorario,
  dirigentes: ['P', 'Q'].map(n => ({ nome: n, saidaCampoIds: [1, 2, 3], indisponiveis: [] })),
  historico: {}, regras: {},
});
const porHorario = {};
rHor.atribuicoes.filter(a => a.principal).forEach(a => {
  const b = mesmoHorario.find(v => v.id === a.id);
  const k = `${b.data} ${b.horario} ${a.principal}`;
  porHorario[k] = (porHorario[k] || 0) + 1;
});
chk(Object.values(porHorario).every(c => c === 1),
  `ninguem em dois lugares no mesmo horario: ${Object.entries(porHorario).filter(([, c]) => c > 1).map(([k]) => k).join(', ') || 'nenhuma sobreposicao'}`);
chk(rHor.diagnostico.vagasVazias === 0,
  'com 2 irmaos as 3 vagas fecham: o das 16:00 sobra para quem ja dirigiu as 08:45');

// Agora o caso em que preencher SO seria possivel duplicando o horario: 1 irmao, 2 saidas
// as 08:45 na mesma data. A duplicidade no dia chega a ser relaxada, mas a sobreposicao de
// horario nao - entao a segunda vaga tem de ficar vazia.
const rHorImpossivel = gerarEscala({
  vagasBase: mesmoHorario.filter(v => v.horario === '08:45'),
  dirigentes: [{ nome: 'Unico', saidaCampoIds: [1, 3], indisponiveis: [] }],
  historico: {}, regras: {},
});
chk(rHorImpossivel.diagnostico.vagasPreenchidas === 1 && rHorImpossivel.diagnostico.vagasVazias === 1,
  'prefere deixar vaga vazia a criar sobreposicao fisica (1 de 2 vagas as 08:45 preenchida)');

sec('DEGRADACAO: repetir no mesmo dia e o unico alivio, e fica registrado');
const vagasSab = [1, 2, 3, 4].map(t => ({ id: t, data: '03/01', dataObj: sabado, saidaCampoId: t, turno: t, local: `T${t}` }));
const rFolga = gerarEscala({
  vagasBase: vagasSab,
  dirigentes: Array.from({ length: 6 }, (_, i) => ({ nome: `D${i + 1}`, saidaCampoIds: [1, 2, 3, 4], indisponiveis: [] })),
  historico: {}, regras: {},
});
const usadosSab = rFolga.atribuicoes.map(a => a.principal).filter(Boolean);
chk(usadosSab.length === 4 && new Set(usadosSab).size === 4,
  `com folga, 4 turnos no mesmo sabado recebem 4 irmaos distintos: ${usadosSab.join(', ')}`);

const rAperto = gerarEscala({
  vagasBase: vagasSab,
  dirigentes: Array.from({ length: 3 }, (_, i) => ({ nome: `E${i + 1}`, saidaCampoIds: [1, 2, 3, 4], indisponiveis: [] })),
  historico: {}, regras: {},
});
chk(rAperto.diagnostico.regrasRelaxadas.evitarDuplicidadeNoDia > 0,
  `3 irmaos para 4 turnos no mesmo dia: relaxa e REGISTRA (${rAperto.diagnostico.regrasRelaxadas.evitarDuplicidadeNoDia}x) em vez de falhar em silencio`);
chk(rAperto.diagnostico.vagasVazias === 0, 'e ainda assim preenche tudo');

sec('universo degenerado nao quebra');
const vazio = gerarEscala({ vagasBase: [], dirigentes: [], historico: {}, regras: {} });
chk(vazio.atribuicoes.length === 0 && vazio.diagnostico.totalVagas === 0, 'sem vagas e sem dirigentes');
const semNinguem = gerarEscala({ vagasBase: turnos12.slice(0, 1), dirigentes: [], historico: {}, regras: {} });
chk(semNinguem.diagnostico.vagasVazias === 1 && semNinguem.diagnostico.avisos.some(a => a.motivo === 'sem_dirigente_habilitado'),
  'vaga sem nenhum dirigente habilitado fica vazia, com motivo explicito');

// --------------------------------------------------------------------------
sec('datas: virada de ano e dias do mes anterior');
const c1 = Auto.resolverData('29/12', 1, 2026);
chk(c1.getFullYear() === 2025 && c1.getMonth() === 11 && c1.getDate() === 29,
  `"29/12" num quadro de JAN/2026 -> ${c1.toISOString().slice(0, 10)} (esperado 2025-12-29)`);
const c2 = Auto.resolverData('30/06', 7, 2026);
chk(c2.getFullYear() === 2026 && c2.getMonth() === 5 && c2.getDate() === 30,
  `"30/06" num quadro de JUL/2026 -> ${c2.toISOString().slice(0, 10)} (esperado 2026-06-30)`);
chk(Auto.resolverData('lixo', 7, 2026) === null, 'data invalida devolve null em vez de Date invalido');
const diasJan = Auto.gerarDiasDoMes(1, 2026);
chk(diasJan.some(d => d.data.endsWith('/12')), `janeiro/2026 puxa dias de dezembro: ${diasJan[0].data}`);
chk(diasJan.every(d => d.diaSemanaStr !== 'Domingo'), 'nenhum domingo na escala');

// --------------------------------------------------------------------------
// A MESMA regra no quadro de designacoes mecanicas. Ali a fila e POR FUNCAO, mas o mecanismo
// (`puxarDaFila`) e identico: pega o primeiro que serve e manda para o fim.
sec('designacoes mecanicas: a mesma regra de ouro, uma fila por funcao');
const filaMec = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'].map(nome => ({ nome }));
const saiu = [];
for (let i = 0; i < 12; i++) {
  saiu.push(AutoDesignacao.puxarDaFila(filaMec, () => true).nome);
}
chk(new Set(saiu.slice(0, 6)).size === 6, `os 6 primeiros sao distintos: ${saiu.slice(0, 6).join(', ')}`);
chk(saiu.slice(0, 6).join() === saiu.slice(6).join(), 'e o segundo ciclo repete a ordem do primeiro');

// Quem nao pode servir mantem a vez: M1 e bloqueado duas vezes e ainda assim continua na frente.
const filaPula = ['M1', 'M2', 'M3'].map(nome => ({ nome }));
const bloqueiaM1 = (i) => i.nome !== 'M1';
chk(AutoDesignacao.puxarDaFila(filaPula, bloqueiaM1).nome === 'M2', 'M1 bloqueado -> sai M2');
chk(AutoDesignacao.puxarDaFila(filaPula, bloqueiaM1).nome === 'M3', 'M1 bloqueado de novo -> sai M3');
chk(filaPula[0].nome === 'M1', 'M1 continua na FRENTE da fila (nao perdeu a vez)');
chk(AutoDesignacao.puxarDaFila(filaPula, () => true).nome === 'M1', 'e assume o proximo turno compativel');
chk(AutoDesignacao.puxarDaFila([], () => true) === null, 'fila vazia devolve null em vez de quebrar');

sec('designacoes mecanicas: a fila inicial sai do historico');
const irmaosMec = [
  { nome: 'Zeca', funcoes: ['indicador'] },          // nunca serviu
  { nome: 'Bruno', funcoes: ['indicador'] },         // serviu ha mais tempo
  { nome: 'Ana', funcoes: ['indicador', 'microfone'] }, // serviu por ultimo
  { nome: 'Carlos', funcoes: ['microfone'] },
];
const filasMec = AutoDesignacao.montarFilas(irmaosMec, {
  indicador: { Bruno: new Date(2026, 0, 5).getTime(), Ana: new Date(2026, 0, 20).getTime() },
  microfone: {},
});
chk(filasMec.indicador.map(i => i.nome).join() === 'Zeca,Bruno,Ana',
  `quem nunca serviu na frente, depois quem serviu ha mais tempo: ${filasMec.indicador.map(i => i.nome).join(' -> ')}`);
chk(filasMec.microfone.map(i => i.nome).join() === 'Ana,Carlos',
  `a fila e POR FUNCAO: em microfone Ana volta para a frente (${filasMec.microfone.map(i => i.nome).join(' -> ')})`);
chk(!filasMec.indicador.some(i => i.nome === 'Carlos'), 'quem nao tem a funcao nao entra na fila dela');

console.log(`\n${falhas === 0 ? '*** TODOS OS CASOS DA REGRA DE OURO PASSARAM ***' : `*** ${falhas} FALHA(S) ***`}`);
process.exit(falhas === 0 ? 0 : 1);
