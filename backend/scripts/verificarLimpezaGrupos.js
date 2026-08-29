/**
 * Confere o casamento entre a linha "Limpeza:" da programacao e os grupos de campo.
 *
 *   npm run verificar:limpeza-grupos
 *
 * NAO PRECISA DE BANCO: os grupos e os textos abaixo sao os de verdade, copiados do
 * "Programação Norte de Itapuã" — inclusive com os defeitos que o documento tem de fato
 * ("Luis" por "Luiz", "Elvandy LIma" por "Elvandyr Lima", "Grupos" no plural, com e sem "do").
 *
 * Existe porque errar aqui nao levanta excecao nenhuma: um fragmento que nao casa apenas
 * deixa um grupo inteiro sem saber que a semana de limpeza e dele, e ninguem descobre ate o
 * salao ficar sujo.
 */
const Limpeza = require('../src/services/LimpezaGrupoService');

/** Os cinco grupos como estao no cadastro (ver scripts/seedGrupos.js). Sem numero ainda. */
const GRUPOS = [
    { id: 1, nome: 'Edilson Santos', numero: null },
    { id: 2, nome: 'Luiz Roberto', numero: null },
    { id: 3, nome: 'Elvandyr Lima', numero: null },
    { id: 4, nome: 'Átilas Santos', numero: null },
    { id: 5, nome: 'Marcelo Santana', numero: null },
];

/** As quatro semanas de Julho, como o PDF as escreve. */
const SEMANAS = [
    { texto: 'Grupos 5 do Luis Roberto & Grupo 1 Edilson Santos', espera: [2, 1] },
    { texto: 'Grupos 2 do Átilas Santos & Grupo 3 do Marcelo Santana', espera: [4, 5] },
    { texto: 'Grupo 4 Elvandy LIma & Grupo 5 Luiz Roberto', espera: [3, 2] },
    { texto: 'Grupo 1 Edilson Santos & Grupo 2 do Átilas Santos', espera: [1, 4] },
];

/** O numero que o documento da a cada grupo — que NAO e a ordem de exibicao do app. */
const NUMEROS_ESPERADOS = { 1: 1, 2: 5, 3: 4, 4: 2, 5: 3 };

let falhas = 0;
const ok = (condicao, descricao, detalhe) => {
    if (condicao) {
        console.log(`   ok   ${descricao}`);
    } else {
        falhas += 1;
        console.log(`   FALHA ${descricao}${detalhe ? `\n         ${detalhe}` : ''}`);
    }
};

const nomeDe = (id) => GRUPOS.find(g => g.id === id)?.nome ?? `#${id}`;

console.log('=== 1. As semanas de Julho casam com os grupos certos ===\n');
for (const { texto, espera } of SEMANAS) {
    const { grupos, naoCasados } = Limpeza.gruposDaSemana(texto, GRUPOS);
    const ids = grupos.map(g => g.grupo.id);
    ok(
        ids.length === espera.length && espera.every(id => ids.includes(id)),
        `"${texto}"\n        -> ${ids.map(nomeDe).join(' + ') || '(nenhum)'}`,
        `esperado ${espera.map(nomeDe).join(' + ')}`,
    );
    ok(naoCasados.length === 0, `   sem fragmento orfao`, JSON.stringify(naoCasados));
}

console.log('\n=== 2. O numero de cada grupo e aprendido do proprio documento ===\n');
const { aprendidos, conflitos } = Limpeza.aprenderNumeros(SEMANAS.map(s => s.texto), GRUPOS);
ok(conflitos.length === 0, 'nenhum conflito de numeracao', JSON.stringify(conflitos));
for (const [id, numeroEsperado] of Object.entries(NUMEROS_ESPERADOS)) {
    const achado = aprendidos.get(Number(id));
    ok(achado === numeroEsperado, `${nomeDe(Number(id))} = Grupo ${numeroEsperado}`, `veio ${achado}`);
}

console.log('\n=== 3. Com o numero gravado, o nome pode ate mudar ===\n');
const comNumero = GRUPOS.map(g => ({ ...g, numero: NUMEROS_ESPERADOS[g.id] }));
{
    // O grupo foi rebatizado no cadastro (trocou o dirigente), mas o documento ainda usa o
    // numero antigo. E exatamente para isto que o numero existe.
    const renomeados = comNumero.map(g => (g.id === 3 ? { ...g, nome: 'Josias Andrade' } : g));
    const { grupos } = Limpeza.gruposDaSemana('Grupo 4 Elvandy LIma & Grupo 5 Luiz Roberto', renomeados);
    const ids = grupos.map(g => g.grupo.id);
    ok(ids.includes(3), 'grupo renomeado ainda casa pelo numero', `veio ${ids.join(',')}`);
    ok(
        grupos.find(g => g.grupo.id === 3)?.criterio === 'numero',
        'e o criterio usado foi o numero',
    );
}

console.log('\n=== 4. O casamento recusa o que nao tem certeza ===\n');
{
    const doisAtilas = [...GRUPOS, { id: 9, nome: 'Átilas Santos Filho', numero: null }];
    const { grupos, naoCasados } = Limpeza.gruposDaSemana('Grupo 2 do Átilas Santos', doisAtilas);
    ok(grupos.length === 0, 'dois grupos plausiveis nao casam com nenhum');
    ok(naoCasados[0]?.ambiguo === true, 'e a ambiguidade e reportada');
}
{
    const { grupos } = Limpeza.gruposDaSemana('Grupo 1 Edmilson Souza', GRUPOS);
    ok(grupos.length === 0, '"Edmilson Souza" nao vira "Edilson Santos"');
}
{
    const { grupos } = Limpeza.gruposDaSemana('Grupo 1 Marcelo', GRUPOS);
    ok(grupos.length === 0, 'so o primeiro nome nao basta ("Marcelo")');
}
{
    const { grupos, naoCasados } = Limpeza.gruposDaSemana('A definir', GRUPOS);
    ok(grupos.length === 0 && naoCasados.length === 0, '"A definir" nao vira grupo nem aviso');
}
{
    const { grupos } = Limpeza.gruposDaSemana('', GRUPOS);
    ok(grupos.length === 0, 'semana sem limpeza nao escala ninguem');
}

console.log('\n=== 5. O prefixo tem freio ===\n');
ok(Limpeza._internos.mesmaPalavra('elvandy', 'elvandyr'), 'elvandy ~ elvandyr (o R cortado)');
ok(!Limpeza._internos.mesmaPalavra('mar', 'marcelo'), 'mar !~ marcelo (curto demais)');
ok(!Limpeza._internos.mesmaPalavra('marcelo', 'marciano'), 'marcelo !~ marciano');
ok(Limpeza._internos.mesmaPalavra('luis', 'luis'), 'luiz vira luis antes de comparar');

console.log(`\n${falhas === 0 ? 'TUDO OK' : `${falhas} FALHA(S)`}\n`);
process.exit(falhas === 0 ? 0 : 1);
