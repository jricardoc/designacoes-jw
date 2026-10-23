/**
 * Verificacao dos grupos de campo e do relatorio de servico de campo.
 *
 *   npm run verificar:grupos
 *
 * Nao precisa de banco nem do PDF: so as regras puras, com nomes inventados (o repositorio e
 * publico, a lista real dos grupos nunca entra aqui).
 */
const D = require('../src/services/DivisaoGruposService');
const R = require('../src/services/RelatorioCampoService')._internos;

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

console.log('cor do pioneiro');
eq(D._internos.ehVerde([84, 130, 53]), true, 'o verde da lista (#548235)');
eq(D._internos.ehVerde([0, 0, 0]), false, 'preto');
eq(D._internos.ehVerde([128, 128, 128]), false, 'cinza');

console.log('leitura da lista (duas colunas, y cresce para cima)');
const t = (texto, x, y, verde = false) => ({ texto, x, y, verde });
const lista = D.montarGrupos([
    t('GRUPOS DE CAMPO', 200, 780),
    t('GRUPO 01 (Salão)', 80, 700), t('DIRIGENTE: Paulo Lima', 50, 680), t('AJUDANTE: Rui Costa', 50, 665),
    t('Paulo E. Lima', 52, 650), t('Rui Costa Neto', 52, 638), t('Ana Souza', 52, 626, true),
    t('GRUPO 03', 80, 560), t('DIRIGENTE: Caio Mendes', 50, 540),
    t('Caio Mendes', 52, 520), t('Bia Prado', 52, 508),
    t('GRUPO 02 (Casa de Bia)', 350, 700), t('DIRIGENTE: Davi Rocha', 320, 680), t('AJUDANTE: Edu Alves', 320, 665),
    t('Davi Rocha', 322, 650), t('Edu Alves', 322, 638), t('Fabi Nunes', 322, 626, true),
]);
eq(lista.grupos.map((g) => [g.numero, g.local, g.dirigente, g.ajudante]), [
    [1, 'Salão', 'Paulo Lima', 'Rui Costa'],
    [2, 'Casa de Bia', 'Davi Rocha', 'Edu Alves'],
    [3, null, 'Caio Mendes', null],
], 'numero, local, dirigente e ajudante de cada coluna, em ordem de numero');
eq(lista.grupos[0].membros, [
    { nome: 'Paulo E. Lima', pioneiro: false }, { nome: 'Rui Costa Neto', pioneiro: false }, { nome: 'Ana Souza', pioneiro: true },
], 'membros de cima para baixo, com o verde virando pioneiro');
eq(lista.grupos[2].membros.map((m) => m.nome), ['Caio Mendes', 'Bia Prado'], 'o grupo de baixo da coluna fica com os seus');
eq(lista.avisos, ['O grupo de Caio Mendes está sem ajudante no documento.'], 'aviso de grupo sem ajudante');

console.log('casamento com o cadastro');
const cadastro = D._internos.prepararCadastro([
    { id: 1, nome: 'Paulo Exemplo Lima' }, { id: 2, nome: 'Rui Costa Neto' }, { id: 3, nome: 'Ana Sousa' },
    { id: 4, nome: 'Bia' }, { id: 5, nome: 'Bia Prado' }, { id: 6, nome: 'Matheus Prado' },
    { id: 7, nome: 'Maria Clara Barros' }, { id: 8, nome: 'Maria Clara Bastos' },
]);
const achar = (nome) => {
    const r = D._internos.acharPessoa(nome, cadastro);
    return r ? [r.pessoa.id, r.criterio] : null;
};
eq(achar('Ana Souza'), [3, 'nome igual'], 'acento e z/s nao atrapalham');
eq(achar('Paulo E. Lima'), [1, 'um nome contém o outro'], 'abreviado no documento');
eq(achar('Maria Clara'), null, 'dois candidatos: ninguem e escolhido');
eq(achar('Bia Fernandes'), null, 'cadastro de um nome so com outro comecando igual');
eq(D._internos.sugestoes('Maria Clara', cadastro).map((c) => c.id), [7, 8], 'o empate vira sugestao');
eq(D._internos.sugestoes('Matheuss Prado', cadastro).map((c) => c.id), [6], 'uma letra a mais no primeiro nome');
eq(D._internos.compativelPorIniciais('Paulo A. de Lima', 'Paulo Alves de Lima'), true, 'iniciais na ordem');
eq(D._internos.compativelPorIniciais('Paulo L. Alves', 'Paulo Alves de Lima'), false, 'iniciais fora de ordem');

console.log('lider do cabecalho');
const membros = lista.grupos[0].membros;
eq(D._internos.liderEntreMembros('Paulo Lima', membros), membros[0], 'dirigente escrito curto acha o membro');
eq(D._internos.liderEntreMembros('Rui Costa', membros), membros[1], 'ajudante tambem');
eq(D._internos.liderEntreMembros('Joao Lima', membros), null, 'ninguem com o primeiro nome');
const p = D.previa([lista.grupos[0]], cadastro)[0];
eq([p.dirigente.membro, p.membros.map((m) => m.irmao && m.irmao.id)], ['Paulo E. Lima', [1, 2, 3]], 'previa: lider pelo membro, membros pelo cadastro');
eq(D.rotuloDoGrupo('Paulo Exemplo Lima'), 'Grupo de Paulo', 'nome do grupo e o do dirigente');
eq(D.rotuloDoGrupo(null, 'Grupo 5'), 'Grupo 5', 'sem dirigente fica o nome guardado');

console.log('mes do relatorio');
eq(R.mesDeReferencia('2026-11-03'), '2026-10', 'em novembro se pede outubro');
eq(R.mesDeReferencia('2027-01-02'), '2026-12', 'virada do ano');
eq([R.nomeDoMes('2026-10'), R.nomeDoMes('2026-10', true)], ['outubro de 2026', 'outubro'], 'nome do mes');

console.log('relatorio de um irmao');
const pub = { pioneiroRegular: false };
eq(R.normalizarRelatorio({}, pub), { erro: 'Diga se o irmão participou no ministério.' }, 'publicador sem dizer se participou');
eq(R.normalizarRelatorio({ participou: true, estudos: '2', observacao: '  ok  ' }, pub).relatorio,
    { participou: true, estudos: 2, horas: null, pioneiroAuxiliar: false, pioneiroRegular: false, observacao: 'ok' }, 'publicador que participou');
eq(R.normalizarRelatorio({ participou: false, estudos: 2 }, pub).relatorio.estudos, 0, 'quem nao participou nao tem estudo');
eq(R.normalizarRelatorio({ participou: true, estudos: 101 }, pub).erro, 'Estudos bíblicos: informe um número entre 0 e 100.', 'estudos demais');
eq(R.normalizarRelatorio({ horas: 52.4, estudos: 3, pioneiroAuxiliar: true }, { pioneiroRegular: true }).relatorio,
    { participou: true, estudos: 3, horas: 52, pioneiroAuxiliar: false, pioneiroRegular: true, observacao: null }, 'regular: horas arredondadas, auxiliar ignorado');
eq(R.normalizarRelatorio({ pioneiroAuxiliar: true, horas: 'x' }, pub).erro, 'Horas: informe um número entre 0 e 400.', 'auxiliar sem horas');
eq(R.normalizarRelatorio({ pioneiroAuxiliar: true, horas: 0, estudos: 1 }, pub).relatorio.participou, false, 'auxiliar com zero horas nao participou');

console.log('total da congregacao');
eq(R.resumir([
    { participou: true, estudos: 1 }, { participou: true, estudos: 0 }, { participou: false, estudos: 0 },
    { participou: true, estudos: 2, horas: 30, pioneiroAuxiliar: true },
    { participou: true, estudos: 4, horas: 55, pioneiroRegular: true }, { participou: true, estudos: 1, horas: 50, pioneiroRegular: true },
]), {
    publicadores: { quantidade: 2, estudos: 1 },
    auxiliares: { quantidade: 1, horas: 30, estudos: 2 },
    regulares: { quantidade: 2, horas: 105, estudos: 5 },
    naoParticiparam: 1,
    entregues: 6,
}, 'publicadores, auxiliares, regulares e quem nao participou');

console.log('periodo das estatisticas');
eq(R.periodo('mes', '2026-10-23'), { inicioISO: '2026-10-01', fimISO: '2026-10-23' }, 'este mes');
eq(R.periodo('3m', '2026-10-23').inicioISO, '2026-08-01', '3 meses');
eq(R.periodo('3m', '2026-01-15').inicioISO, '2025-11-01', '3 meses na virada do ano');
eq(R.periodo('ano', '2026-10-23').inicioISO, '2026-09-01', 'ano de servico comeca em setembro');
eq(R.periodo('ano', '2026-03-10').inicioISO, '2025-09-01', 'ano de servico do ano anterior');
eq([R.isoDeBR('16/10/2026'), R.isoDeBR('x')], ['2026-10-16', null], 'data do Zoom');

console.log('o que cada um fez');
eq(R.estatisticas([
    { tipo: 'designacao', dataISO: '2026-09-03' }, { tipo: 'designacao', dataISO: '2026-07-30' },
    { tipo: 'designacao', dataISO: '2026-11-05' }, { tipo: 'reuniao', dataISO: '2026-10-01' },
    { tipo: 'dirigente', dataISO: '2026-10-04' }, { tipo: 'dirigente', dataISO: '2026-10-04' }, { tipo: 'dirigente', dataISO: null },
], ['2026-09-10', '2026-06-01', null], { inicioISO: '2026-08-01', fimISO: '2026-10-23' }),
{ mecanicas: 1, reuniao: 1, dirigente: 1, zoom: 1, designacoes: 3 }, 'so o que caiu no periodo; a mesma saida conta uma vez');

console.log('ficha do irmao');
eq([R.somarMeses('2026-10', 3), R.somarMeses('2026-01', -1), R.somarMeses('2026-10', -11)], ['2027-01', '2025-12', '2025-11'], 'somar meses');
const hist = R.historicoDeRelatorios([
    { mes: '2026-10', participou: true, estudos: 2, horas: null, pioneiroAuxiliar: false, pioneiroRegular: false },
    { mes: '2026-12', participou: false, estudos: 0, horas: null, pioneiroAuxiliar: false, pioneiroRegular: false },
], '2027-01', 12);
eq([hist.meses.length, hist.meses[0].mes, hist.meses[11].mes, hist.meses[0].antesDoApp, hist.meses[8].mes, hist.meses[8].antesDoApp], [12, '2026-02', '2027-01', true, '2026-10', false], '12 meses ate o de referencia; antes de outubro/2026 foi no papel');
eq([hist.mesesNoApp, hist.comRelatorio, hist.participou], [4, 2, 1], 'conta so os meses do app: 4 meses, 2 relatorios, 1 participou');

console.log('pedido no WhatsApp');
const grupo = R.textoDoPedido({ grupo: 'Grupo de Paulo', mes: '2026-10' });
eq([grupo.startsWith('Olá, irmãos do grupo de Paulo!'), grupo.includes('*outubro*')], [true, true], 'mensagem para o grupo');
const um = R.textoDoPedido({ mes: '2026-10', nome: 'Ana Sousa', pioneiro: true });
eq([um.startsWith('Olá, Ana!'), um.includes('Quantas horas')], [true, true], 'mensagem para um pioneiro');

if (falhas > 0) {
    console.log(`\n${falhas} falha(s).`);
    process.exit(1);
}
console.log('\nTudo certo.');
