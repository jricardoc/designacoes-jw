/**
 * Verificacao das regras da Escala de Dirigentes.
 *
 *   npm run verificar:dirigentes
 *
 * Nao precisa de banco: o nucleo de decisao (EscalaDirigenteAlgoritmo) e uma funcao pura, e
 * estes casos montam o universo na mao. Rode depois de mexer nos pesos ou nas regras - cada
 * bloco corresponde a uma regra e falha alto se ela deixar de valer.
 */
const { gerarEscala } = require('../src/services/EscalaDirigenteAlgoritmo');
const Auto = require('../src/services/AutoDirigenteService');

let falhas = 0;
const chk = (ok, m) => { console.log(`${ok ? '  OK  ' : ' FALHA'} ${m}`); if (!ok) falhas++; };
const sec = (t) => console.log(`\n=== ${t} ===`);

// --------------------------------------------------------------------------
sec('resolverData: virada de ano e dias do mes anterior');
const c1 = Auto.resolverData('29/12', 1, 2026);
chk(c1.getFullYear() === 2025 && c1.getMonth() === 11 && c1.getDate() === 29,
  `"29/12" num quadro de JAN/2026 -> ${c1.toISOString().slice(0, 10)} (esperado 2025-12-29)`);
const c2 = Auto.resolverData('30/06', 7, 2026);
chk(c2.getFullYear() === 2026 && c2.getMonth() === 5 && c2.getDate() === 30,
  `"30/06" num quadro de JUL/2026 -> ${c2.toISOString().slice(0, 10)} (esperado 2026-06-30)`);
const c3 = Auto.resolverData('15/07', 7, 2026);
chk(c3.getMonth() === 6 && c3.getDate() === 15, `"15/07" em JUL/2026 -> ${c3.toISOString().slice(0, 10)}`);
chk(Auto.resolverData('lixo', 7, 2026) === null, 'data invalida devolve null em vez de Date invalido');

// --------------------------------------------------------------------------
sec('gerarDiasDoMes: janeiro comeca puxando dezembro');
const diasJan = Auto.gerarDiasDoMes(1, 2026);
chk(diasJan.some(d => d.data.endsWith('/12')), `janeiro/2026 puxa dias de dezembro: ${diasJan[0].data}`);
chk(diasJan.every(d => d.diaSemanaStr !== 'Domingo'), 'nenhum domingo na escala');

// --------------------------------------------------------------------------
sec('universo minimo / degenerado');
const vazio = gerarEscala({ vagasBase: [], dirigentes: [], historico: {}, regras: {} });
chk(vazio.atribuicoes.length === 0 && vazio.diagnostico.totalVagas === 0, 'sem vagas e sem dirigentes nao quebra');

const semDirigente = gerarEscala({
  vagasBase: [{ id: 1, data: '05/01', dataObj: new Date(2026, 0, 5), saidaCampoId: 1, turno: 1, local: 'X' }],
  dirigentes: [], historico: {}, regras: {},
});
chk(semDirigente.diagnostico.vagasVazias === 2, 'saida sem nenhum dirigente habilitado -> 2 vagas vazias');
chk(semDirigente.diagnostico.avisos.some(a => a.tipo === 'vaga_vazia'), 'avisa vaga vazia');

const umSo = gerarEscala({
  vagasBase: [{ id: 1, data: '05/01', dataObj: new Date(2026, 0, 5), saidaCampoId: 1, turno: 1, local: 'X' }],
  dirigentes: [{ nome: 'Unico', saidaCampoIds: [1], indisponiveis: [] }], historico: {}, regras: {},
});
chk(umSo.atribuicoes[0].principal === 'Unico' && umSo.atribuicoes[0].substituto === '',
  'um unico dirigente vira principal e o substituto fica vazio (nunca duplicado)');

// --------------------------------------------------------------------------
sec('4 turnos de sabado na MESMA data (regra de duplicidade)');
const sabado = new Date(2026, 0, 3);
const vagasSab = [1, 2, 3, 4].map(t => ({ id: t, data: '03/01', dataObj: sabado, saidaCampoId: t, turno: t, local: `T${t}` }));
const oito = Array.from({ length: 8 }, (_, i) => ({ nome: `D${i + 1}`, saidaCampoIds: [1, 2, 3, 4], indisponiveis: [] }));
const rSab = gerarEscala({ vagasBase: vagasSab, dirigentes: oito, historico: {}, regras: {} });
const usados = rSab.atribuicoes.flatMap(a => [a.principal, a.substituto]).filter(Boolean);
chk(usados.length === 8, `8 vagas preenchidas (${usados.length})`);
chk(new Set(usados).size === 8, 'nenhum irmao repetido no mesmo sabado com 4 turnos');

// com apenas 5 dirigentes, e IMPOSSIVEL preencher 8 vagas sem repetir
const cinco = Array.from({ length: 5 }, (_, i) => ({ nome: `E${i + 1}`, saidaCampoIds: [1, 2, 3, 4], indisponiveis: [] }));
const rTight = gerarEscala({ vagasBase: vagasSab, dirigentes: cinco, historico: {}, regras: {} });
chk(rTight.diagnostico.regrasRelaxadas.evitarDuplicidadeNoDia > 0,
  `relaxa a duplicidade e REGISTRA (${rTight.diagnostico.regrasRelaxadas.evitarDuplicidadeNoDia} vezes) em vez de falhar em silencio`);
chk(rTight.atribuicoes.every(a => !a.principal || a.principal !== a.substituto),
  'mesmo relaxando, principal nunca e igual ao substituto da mesma saida');

// --------------------------------------------------------------------------
sec('conflito de horario: duas saidas na mesma data E no mesmo horario');
// Espelha os dados reais: sabado turno 1 e turno 3 sao AMBOS 08:45, em casas diferentes.
const mesmoHorario = [
  { id: 1, data: '03/01', dataObj: sabado, saidaCampoId: 1, turno: 1, local: 'Casa A', horario: '08:45' },
  { id: 2, data: '03/01', dataObj: sabado, saidaCampoId: 3, turno: 3, local: 'Casa B', horario: '08:45' },
  { id: 3, data: '03/01', dataObj: sabado, saidaCampoId: 2, turno: 2, local: 'Casa C', horario: '16:00' },
];
const doisIrmaos = ['P', 'Q'].map(n => ({ nome: n, saidaCampoIds: [1, 2, 3], indisponiveis: [] }));
const rHor = gerarEscala({ vagasBase: mesmoHorario, dirigentes: doisIrmaos, historico: {}, regras: {} });
const porHorario = {};
rHor.atribuicoes.forEach(a => {
  const b = mesmoHorario.find(v => v.id === a.id);
  [a.principal, a.substituto].filter(Boolean).forEach(n => {
    const k = `${b.data} ${b.horario} ${n}`;
    porHorario[k] = (porHorario[k] || 0) + 1;
  });
});
const sobrepostos = Object.entries(porHorario).filter(([, c]) => c > 1);
chk(sobrepostos.length === 0,
  `ninguem em dois lugares no mesmo horario, mesmo com so 2 irmaos para 6 vagas: ${sobrepostos.map(([k]) => k).join(', ') || 'nenhuma sobreposicao'}`);
chk(rHor.diagnostico.vagasVazias > 0, 'prefere deixar vaga vazia a criar sobreposicao fisica');

// --------------------------------------------------------------------------
sec('determinismo entre gerar e regerar (ids diferentes, mesma escala)');
// Na criacao o id da vaga e indice de array; na regeracao e o id do banco. A escala tem
// de ser a mesma nos dois casos.
const comoCriacao = vagasSab.map((v, i) => ({ ...v, id: i }));
const comoRegeracao = vagasSab.map((v, i) => ({ ...v, id: 5000 + i * 7 }));
const rc = gerarEscala({ vagasBase: comoCriacao, dirigentes: oito, historico: {}, regras: {}, seed: 'x' });
const rr = gerarEscala({ vagasBase: comoRegeracao, dirigentes: oito, historico: {}, regras: {}, seed: 'x' });
const porSaidaPapel = (r, base) => r.atribuicoes.map(a => {
  const b = base.find(v => v.id === a.id);
  return `${b.data}|${b.saidaCampoId}|${a.principal}|${a.substituto}`;
}).sort().join('\n');
chk(porSaidaPapel(rc, comoCriacao) === porSaidaPapel(rr, comoRegeracao),
  'gerar e regerar o mesmo mes com as mesmas regras produz escala identica');

// --------------------------------------------------------------------------
sec('indisponibilidade e restricao DURA (nunca relaxada)');
const rInd = gerarEscala({
  vagasBase: vagasSab,
  dirigentes: cinco.map(d => ({ ...d, indisponiveis: ['03/01'] })),
  historico: {}, regras: {},
});
chk(rInd.diagnostico.vagasPreenchidas === 0, 'todos indisponiveis -> nenhuma vaga preenchida (nao force ninguem)');
chk(!rInd.diagnostico.regrasRelaxadas.respeitarIndisponibilidades, 'indisponibilidade nunca aparece como relaxada');

// --------------------------------------------------------------------------
sec('preencherSubstituto = false');
const rSemSub = gerarEscala({ vagasBase: vagasSab, dirigentes: oito, historico: {}, regras: { preencherSubstituto: false } });
chk(rSemSub.atribuicoes.every(a => a.substituto === ''), 'nenhum substituto preenchido');
chk(rSemSub.diagnostico.totalVagas === 4, `totalVagas conta so os principais (${rSemSub.diagnostico.totalVagas})`);

// --------------------------------------------------------------------------
sec('determinismo');
const args = { vagasBase: vagasSab, dirigentes: oito, historico: {}, regras: {}, seed: 'abc' };
const a1 = JSON.stringify(gerarEscala(args).atribuicoes);
const a2 = JSON.stringify(gerarEscala(args).atribuicoes);
chk(a1 === a2, 'duas execucoes com a mesma seed produzem exatamente a mesma escala');
const a3 = JSON.stringify(gerarEscala({ ...args, seed: 'xyz' }).atribuicoes);
chk(a1 !== a3, 'seeds diferentes produzem escalas diferentes (sem vies de ordem do array)');

// --------------------------------------------------------------------------
sec('ponderacao: irmao escasso vs irmao abundante');
// A armadilha classica: a saida RARA acontece no COMECO do mes e tem poucas datas.
// O Escasso so cabe nela. Sem ponderacao, os abundantes - todos com contagem 0 no dia 1 -
// tomam essas vagas e o Escasso fica sem nada, porque quando o deficit dele aparece as
// oportunidades dele ja acabaram.
const vagasP = [];
let idp = 0;
[1, 2].forEach(dia => {
  vagasP.push({ id: idp++, data: `0${dia}/01`, dataObj: new Date(2026, 0, dia), saidaCampoId: 1, turno: 1, local: 'RARA' });
});
for (let dia = 3; dia <= 10; dia++) {
  vagasP.push({ id: idp++, data: `${String(dia).padStart(2, '0')}/01`, dataObj: new Date(2026, 0, dia), saidaCampoId: 2, turno: 1, local: 'COMUM' });
}
const dirsP = [
  { nome: 'Escasso', saidaCampoIds: [1], indisponiveis: [] },
  ...Array.from({ length: 6 }, (_, i) => ({ nome: `Abundante${i + 1}`, saidaCampoIds: [1, 2], indisponiveis: [] })),
];
const carga = (r, n) => r.diagnostico.porIrmao.find(p => p.nome === n)?.designacoes ?? 0;
const resumo = (r) => r.diagnostico.porIrmao.map(p => `${p.nome.replace('Abundante', 'A')}=${p.designacoes}`).join(' ');

const comPond = gerarEscala({ vagasBase: vagasP, dirigentes: dirsP, historico: {}, regras: {}, seed: 's' });
const semPond = gerarEscala({
  vagasBase: vagasP, dirigentes: dirsP, historico: {}, seed: 's',
  regras: { ponderarDisponibilidade: false, designarTodos: false, distribuicaoIgualitaria: false },
});
console.log(`  com todas as regras : ${resumo(comPond)}`);
console.log(`  sem as regras novas : ${resumo(semPond)}`);
chk(carga(comPond, 'Escasso') >= 2,
  `Escasso (so a saida RARA) recebe ${carga(comPond, 'Escasso')} com ponderacao vs ${carga(semPond, 'Escasso')} sem`);
chk(carga(comPond, 'Escasso') > carga(semPond, 'Escasso'),
  'a ponderacao de disponibilidade melhora de fato a situacao do irmao escasso');
chk(comPond.diagnostico.semDesignacao.length === 0, 'ninguem fica sem designacao');

// --------------------------------------------------------------------------
sec('gargalos sao detectados e reportados');
chk(rTight.diagnostico.gargalos.some(g => g.escopo === 'data'),
  `detecta o gargalo de DATA (varios turnos no mesmo dia): ${rTight.diagnostico.gargalos.filter(g => g.escopo === 'data').map(g => `${g.data}: ${g.candidatos} irmaos p/ ${g.vagas} vagas`).join(', ')}`);
chk(rTight.diagnostico.avisos.some(a => a.tipo === 'dia_com_poucos_dirigentes'), 'gera aviso legivel do gargalo de dia');
// Replica o caso real da terca: 5 datas (10 vagas) e so 3 dirigentes habilitados,
// enquanto as outras saidas tem gente de sobra.
const vagasG = [];
let idg = 0;
for (let dia = 5; dia <= 9; dia++) {
  const dataObj = new Date(2026, 0, dia);
  const data = `0${dia}/01`;
  vagasG.push({ id: idg++, data, dataObj, saidaCampoId: 1, turno: 1, local: 'TERCA APERTADA' });
  vagasG.push({ id: idg++, data, dataObj, saidaCampoId: 2, turno: 2, local: 'FOLGADA' });
}
const dirsG = [
  ...['T1', 'T2', 'T3'].map(n => ({ nome: n, saidaCampoIds: [1], indisponiveis: [] })),
  ...Array.from({ length: 12 }, (_, i) => ({ nome: `F${i + 1}`, saidaCampoIds: [2], indisponiveis: [] })),
];
const rG = gerarEscala({ vagasBase: vagasG, dirigentes: dirsG, historico: {}, regras: {}, seed: 'g' });
const gSaida = rG.diagnostico.gargalos.filter(g => g.escopo === 'saida');
chk(gSaida.length > 0,
  `detecta o gargalo de SAIDA: ${gSaida.map(g => `${g.local} (${g.candidatos} dirigentes p/ ${g.vagas} vagas -> ${g.cargaForcada}x cada)`).join(', ')}`);
chk(rG.diagnostico.avisos.some(a => a.tipo === 'saida_com_poucos_dirigentes'), 'gera aviso acionavel de cadastro');

// A cota tem de ser ATINGIVEL, e nao a media global. Os 3 presos na saida apertada sao
// obrigados a ~3.3 cada; os 12 da folgada nao chegam perto disso. Uma cota unica (20/15=1.33)
// mentiria para os dois grupos - era esse o defeito do water-filling sobre capacidade.
const cotaDe = (n) => rG.diagnostico.porIrmao.find(p => p.nome === n).cota;
const cargaDe = (n) => rG.diagnostico.porIrmao.find(p => p.nome === n).designacoes;
const cotasApertada = ['T1', 'T2', 'T3'].map(cotaDe);
const cotasFolgada = Array.from({ length: 12 }, (_, i) => cotaDe(`F${i + 1}`));
console.log(`  cota dos presos na apertada: ${cotasApertada.join(', ')} | cota dos folgados: ${cotasFolgada.join(', ')}`);
chk(Math.min(...cotasApertada) > Math.max(...cotasFolgada),
  'a cota reconhece o gargalo: quem esta preso na saida apertada recebe cota MAIOR');
chk(cotasApertada.reduce((a, b) => a + b, 0) === 10,
  `as 10 vagas da saida apertada estao integralmente na cota dos 3 (soma=${cotasApertada.reduce((a, b) => a + b, 0)})`);
chk(['T1', 'T2', 'T3'].every(n => cargaDe(n) === cotaDe(n)),
  'e a escala entrega exatamente a cota deles (aproveitamento 1.00, sem mentir no painel)');
const somaCotas = rG.diagnostico.porIrmao.reduce((s, p) => s + p.cota, 0);
chk(somaCotas === rG.diagnostico.totalVagas,
  `a soma das cotas fecha com o total de vagas (${somaCotas} de ${rG.diagnostico.totalVagas})`);

// --------------------------------------------------------------------------
sec('equilibrio principal x substituto');
// Cenario que produz o problema: 2 saidas no mesmo dia, um grupo com muitas oportunidades
// (urgencia baixa, perde sempre a rodada dos principais) e um grupo escasso.
const vagasPap = [];
let idpap = 0;
for (let dia = 5; dia <= 12; dia++) {
  const dataObj = new Date(2026, 0, dia);
  const data = `${String(dia).padStart(2, '0')}/01`;
  vagasPap.push({ id: idpap++, data, dataObj, saidaCampoId: 1, turno: 1, local: 'A', horario: '08:45' });
  vagasPap.push({ id: idpap++, data, dataObj, saidaCampoId: 2, turno: 2, local: 'B', horario: '16:00' });
}
const dirsPap = [
  ...Array.from({ length: 4 }, (_, i) => ({ nome: `Amplo${i + 1}`, saidaCampoIds: [1, 2], indisponiveis: [] })),
  ...Array.from({ length: 4 }, (_, i) => ({ nome: `Restrito${i + 1}`, saidaCampoIds: [1], indisponiveis: [] })),
];
const rPap = gerarEscala({ vagasBase: vagasPap, dirigentes: dirsPap, historico: {}, regras: {}, seed: 'p' });
console.log('  ' + rPap.diagnostico.porIrmao.map(p => `${p.nome}=${p.principais}P/${p.substitutos}S`).join(' '));
const nuncaDirige = rPap.diagnostico.porIrmao.filter(p => p.designacoes >= 2 && p.principais === 0);
chk(nuncaDirige.length === 0,
  `ninguem aparece varias vezes na escala sem nunca dirigir: ${nuncaDirige.map(p => p.nome).join(', ') || 'nenhum'}`);
const piorDesvio = Math.max(...rPap.diagnostico.porIrmao.map(p => Math.abs(p.principais - p.substitutos)));
chk(piorDesvio <= 1, `desvio maximo entre papeis e ${piorDesvio} (minimo possivel para cargas impares)`);
const rSemPap = gerarEscala({ vagasBase: vagasPap, dirigentes: dirsPap, historico: {}, regras: { equilibrarPapeis: false }, seed: 'p' });
chk(
  Math.max(...rSemPap.diagnostico.porIrmao.map(p => Math.abs(p.principais - p.substitutos))) > piorDesvio,
  'e o toggle equilibrarPapeis faz diferenca de fato (desligado, o desvio piora)',
);
// o passe de papeis nao pode mexer na carga de ninguem
const cargasCom = rPap.diagnostico.porIrmao.map(p => `${p.nome}:${p.designacoes}`).sort().join(',');
const cargasSem = rSemPap.diagnostico.porIrmao.map(p => `${p.nome}:${p.designacoes}`).sort().join(',');
chk(cargasCom === cargasSem, 'equilibrar papeis nao altera a carga de ninguem (so quem dirige e quem e reserva)');

// --------------------------------------------------------------------------
sec('mes anterior influencia sem zerar ninguem');
const hist = { Abundante1: { designacoes: 10, ultimaDataObj: new Date(2025, 11, 30) } };
const comHist = gerarEscala({ vagasBase: vagasP, dirigentes: dirsP, historico: hist, regras: {} });
chk(carga(comHist, 'Abundante1') >= 1, `quem serviu muito no mes passado ainda serve (${carga(comHist, 'Abundante1')}x), so com prioridade menor`);
chk(carga(comHist, 'Abundante1') <= carga(comPond, 'Abundante1'), 'mas serve menos ou igual a quando nao havia historico');

console.log(`\n${falhas === 0 ? '*** TODOS OS CASOS DE BORDA PASSARAM ***' : `*** ${falhas} FALHA(S) ***`}`);
process.exit(falhas === 0 ? 0 : 1);
