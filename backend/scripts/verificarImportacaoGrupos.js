/**
 * Verificacao do casamento de nomes da importacao dos grupos.
 *
 *   npm run verificar:importacao-grupos
 *
 * Nao precisa de banco: `acharPessoa` e pura e o cadastro e simulado aqui.
 *
 * Por que isto existe: este script MEXE NO CADASTRO de 128 pessoas. Casar errado nao gera
 * erro nenhum — gera um irmao duplicado (que ja aconteceu uma vez, com o Walney) ou, pior,
 * duas pessoas diferentes viradas numa so, misturando telefone e designacao. As duas listas
 * escrevem os nomes de formas diferentes de proposito: o documento abrevia ("Maria de Fatima
 * G. d. Silva") e o cadastro esta incompleto ("Marisol", "Olga").
 */
const { GRUPOS, APELIDOS, _internos } = require('./importarGrupos');
const { chaveNome, pedacos, acharPessoa, podeSerAbreviacao } = _internos;

let falhas = 0;
const chk = (ok, m) => { console.log(`${ok ? '  OK  ' : ' FALHA'} ${m}`); if (!ok) falhas++; };
const sec = (t) => console.log(`\n=== ${t} ===`);

/** Monta um "cadastro" a partir de nomes soltos. */
const cadastroDe = (nomes) =>
    nomes.map((n, i) => ({ id: i + 1, nome: n, chave: chaveNome(n), pedacos: pedacos(n) }));

// Nomes REAIS do cadastro, colhidos ao longo do trabalho (programacao importada, saidas dos
// scripts de migracao). Nao e a lista inteira, mas cobre os casos dificeis.
const CADASTRO = cadastroDe([
    'Edilson Santos', 'Átilas Santos', 'Marcelo Santana', 'Luiz Roberto', 'Elvandy Lima',
    'Walney Oliveira', 'José Ricardo', 'Miguel Alves', 'Jucélia dos Santos Gomes',
    'Maria Eduarda dos S. Gomes de Araújo', 'Edleuza Gomes de Souza', 'Dinalva Sousa Santana',
    'João Felipe Lima', 'Manoel Alves Neto', 'Harison Mendes', 'Jessé Gonçalves',
    'Henzel Almeida', 'Jucimar Carvalho', 'Aloísio Rodrigues', 'Kauã Elesbão',
    'Marisol', 'Olga', 'Raquel', 'Tânia', 'Tânia Assad', 'Zenaildes', 'Mônica Cêli Lima',
    'Fabiana Alvim Melo Moura', 'Cláudio da Silva Oliveira', 'Cosmírio Carvalho',
]);

sec('o cadastro incompleto casa com o documento completo');
[
    ['Walney Oliveira e Souza', 'Walney Oliveira'],
    ['Marisol Santos', 'Marisol'],
    ['Olga P. Souza', 'Olga'],
    ['Zenaildes P. Gonçalves', 'Zenaildes'],
    ['Harison Mendes de P. Araújo', 'Harison Mendes'],
    ['Manoel Alves da Silva Neto', 'Manoel Alves Neto'],
].forEach(([doDocumento, doCadastro]) => {
    const r = acharPessoa(doDocumento, CADASTRO);
    chk(r?.pessoa.nome === doCadastro, `"${doDocumento}" -> "${r?.pessoa.nome ?? 'NOVO'}"`);
});

sec('o documento abreviado casa com o cadastro por extenso');
[
    ['Maria Eduarda dos S. G. de Araújo', 'Maria Eduarda dos S. Gomes de Araújo'],
    ['Edleuza G. Souza', 'Edleuza Gomes de Souza'],
    ['Dinalva S. d. S. Santana', 'Dinalva Sousa Santana'],
    ['João Felipe C. Lima', 'João Felipe Lima'],
    ['Elvandy F. Lima', 'Elvandy Lima'],
].forEach(([doDocumento, doCadastro]) => {
    const r = acharPessoa(doDocumento, CADASTRO);
    chk(r?.pessoa.nome === doCadastro, `"${doDocumento}" -> "${r?.pessoa.nome ?? 'NOVO'}"`);
});

sec('Z e S sao a mesma letra em nome brasileiro');
chk(chaveNome('Luiz Roberto') === chaveNome('Luís Roberto'), 'Luiz = Luís');
chk(chaveNome('Souza') === chaveNome('Sousa'), 'Souza = Sousa');
chk(chaveNome('Izabel') === chaveNome('Isabel'), 'Izabel = Isabel');
// E o que faz o dirigente do quinto grupo achar o proprio registro: o documento diz
// "Luis R. L. Sampaio" e o cadastro "Luiz Roberto" — o atalho e pelo nome do grupo.
const grupo5 = GRUPOS.find((g) => g.nomesAnteriores?.includes('Luiz Roberto'));
chk(!!grupo5, 'o grupo com grafia corrigida declara as grafias anteriores');
chk(acharPessoa(grupo5.grupo, CADASTRO)?.pessoa.nome === 'Luiz Roberto',
    'o dirigente do quinto grupo e achado pelo nome do grupo');
// As tres grafias tem de cair na mesma chave, senao a busca do grupo cria um duplicado.
const chavesLuis = new Set(['Luiz Roberto', 'Luis Roberto', 'Luís Roberto'].map(chaveNome));
chk(chavesLuis.size === 1, `Luiz / Luis / Luís sao a mesma chave (${[...chavesLuis]})`);

sec('pares que so quem convive com a congregacao sabe');
Object.entries(APELIDOS).forEach(([doDocumento, doCadastro]) => {
    const r = acharPessoa(doDocumento, CADASTRO);
    chk(r?.pessoa.nome === doCadastro && r.criterio === 'par confirmado a mao',
        `"${doDocumento}" = "${doCadastro}"`);
});

sec('a inicial do documento levanta suspeita, mas nunca casa sozinha');
// So AVISA. As duplicatas que escapam sao as do tipo "Edgar B. d. Santos" x "Edgar Bispo":
// o sobrenome do cadastro esta no documento, abreviado. Nenhum criterio de casamento pega
// isso, e nem deve — 'A.' serve para Alvim, Assad, Andrade e Araujo.
[
    ['Edgar B. d. Santos', 'Edgar Bispo', true],
    ['Ana Lúcia P. S. Rodrigues', 'Ana Portela', true],
    // Aqui a inicial nao cai em cima de nada: sao pessoas diferentes mesmo.
    ['Laura Bispo D. Santos', 'Laura Leonídia', false],
    ['Maria Cristiane S. de Souza', 'Maria José', false],
    ['Marcia Vieira Santos', 'Márcia Nunes', false],
    ['Ana Lúcia P. S. Rodrigues', 'Ana Cristina', false],
    // Nome inteiro contido no outro nao e caso de inicial — o casamento normal ja pega.
    ['Lourrany Alves dos Santos', 'Lourrany Alves', false],
    // Registro de um nome so tem tratamento proprio em acharPessoa; aqui nao entra.
    ['Tânia Maria A. de Mello', 'Tânia', false],
].forEach(([doDocumento, doCadastro, esperado]) => {
    chk(podeSerAbreviacao(doDocumento, doCadastro) === esperado,
        `"${doDocumento}" x "${doCadastro}" ${esperado ? 'levanta suspeita' : 'nao levanta'}`);
});
// A suspeita nao pode virar casamento: o Edgar continua sendo criado, e nao fundido.
chk(acharPessoa('Edgar B. d. Santos', cadastroDe(['Edgar Bispo'])) === null,
    'suspeitar nao e casar: "Edgar B. d. Santos" segue como pessoa nova');

sec('o que NAO pode casar');
// Sobrenome em comum nao e a mesma pessoa.
chk(acharPessoa('Maria Helena S. Santos', cadastroDe(['Maria Helena G. S. Santana'])) === null,
    'duas "Maria Helena" com sobrenome diferente ficam separadas');
chk(acharPessoa('José dos Santos Cruz', CADASTRO) === null,
    '"José dos Santos Cruz" nao vira o "José Ricardo" do cadastro');
chk(acharPessoa('Marcia Vieira Santos', cadastroDe(['Marcia Nunes de Jesus'])) === null,
    'duas Marcias diferentes ficam separadas');
// Empate nunca escolhe.
chk(acharPessoa('Tânia Maria A. de Mello', cadastroDe(['Tânia', 'Tânia Assad'])) === null,
    'com dois "Tânia" no cadastro, ninguem e escolhido');

sec('nenhum nome do documento casa com DOIS do cadastro');
// O criterio recusa empate, mas empate frequente seria sinal de criterio frouxo demais.
const todosDoDocumento = GRUPOS.flatMap((g) => [
    g.dirigente[0], g.ajudante[0], ...g.membros.map(([n]) => n),
]);
chk(todosDoDocumento.length === 128, `a lista tem ${todosDoDocumento.length} pessoas`);
chk(new Set(todosDoDocumento.map(chaveNome)).size === 128,
    'nenhum nome se repete entre os grupos (nem depois do z->s)');

// Cruzando a lista inteira contra ela mesma: dois nomes DIFERENTES do documento nao podem
// virar a mesma chave, senao a segunda pessoa seria engolida pela primeira na hora de criar.
const porChave = new Map();
todosDoDocumento.forEach((n) => {
    const k = chaveNome(n);
    porChave.set(k, [...(porChave.get(k) ?? []), n]);
});
const colisoes = [...porChave.values()].filter((v) => v.length > 1);
chk(colisoes.length === 0,
    `o z->s nao juntou nomes diferentes${colisoes.length ? ': ' + JSON.stringify(colisoes) : ''}`);

sec('todo mundo tem tratamento');
const semTratamento = GRUPOS.flatMap((g) =>
    [g.dirigente, g.ajudante, ...g.membros].filter(([, gen]) => gen !== 'irmao' && gen !== 'irma'),
);
chk(semTratamento.length === 0,
    `nenhuma pessoa sem 'irmao'/'irma'${semTratamento.length ? ': ' + JSON.stringify(semTratamento) : ''}`);
chk(GRUPOS.length === 5, 'os cinco grupos estao declarados');
chk(GRUPOS.every((g) => g.dirigente && g.ajudante), 'todo grupo tem dirigente e ajudante');

console.log(`\n${falhas === 0 ? '*** TODAS AS VERIFICACOES PASSARAM ***' : `*** ${falhas} FALHA(S) ***`}`);
process.exit(falhas === 0 ? 0 : 1);
