/**
 * Confere o casamento entre a linha "Limpeza:" da programacao e os grupos de campo.
 *
 *   npm run verificar:limpeza-grupos
 *
 * NAO PRECISA DE BANCO. Os grupos e os textos abaixo sao os DE PRODUCAO: as 19 semanas que
 * estavam importadas em 29/08/2026, copiadas da saida do `vincular:limpeza`, com todos os
 * defeitos que o documento tem de fato:
 *
 *   - separador ora "&", ora " e "        ("Grupo 2 ... e Grupo 5 ...")
 *   - "Grupos" no plural, com e sem "do"
 *   - Z por S                             ("Luis Roberto" / "Luiz Roberto")
 *   - nome cortado e caixa trocada        ("Elvandy LIma" por "Elvandyr Lima")
 *   - nome invertido                      ("Roberto Luiz" por "Luis Roberto")
 *   - espaco duplo                        ("Grupo 3  do Helber Dias")
 *   - um grupo EXTINTO                    (Helber Dias, que existia em Marco)
 *   - e a NUMERACAO ANTIGA de Marco, quando a congregacao tinha seis grupos
 *
 * Existe porque errar aqui nao levanta excecao nenhuma: um fragmento que nao casa apenas
 * deixa um grupo inteiro sem saber que a semana de limpeza e dele, e ninguem descobre ate o
 * salao ficar sujo. Foi assim que o " e " passou batido ate a primeira rodada em producao.
 */
const Limpeza = require('../src/services/LimpezaGrupoService');

/** Os cinco grupos como estao no cadastro (ver scripts/seedGrupos.js). Sem numero ainda. */
const GRUPOS = [
    { id: 1, nome: 'Edilson Santos', numero: null },
    { id: 2, nome: 'Luis Roberto', numero: null },
    { id: 3, nome: 'Elvandyr Lima', numero: null },
    { id: 4, nome: 'Átilas Santos', numero: null },
    { id: 5, nome: 'Marcelo Santana', numero: null },
];

/**
 * As 19 semanas de producao, em ordem cronologica.
 * `espera` sao os ids que devem casar; `orfaos` os fragmentos que devem sobrar de fora.
 */
const SEMANAS = [
    // --- Marco: SEIS grupos, numeracao antiga, e o Helber Dias que nao existe mais ---
    { quando: '2026-03-05', texto: 'Grupos 1 do Edilson Santos & Grupo 3  do Helber Dias', espera: [1], orfaos: 1 },
    { quando: '2026-03-12', texto: 'Grupo 2 do Átilas Santos e Grupo 5 do Elvandy Lima', espera: [4, 3], orfaos: 0 },
    { quando: '2026-03-19', texto: 'Grupo 4 Marcelo Santana e Grupo 6 Roberto Luiz', espera: [5, 2], orfaos: 0 },
    // --- Junho em diante: cinco grupos, numeracao atual ---
    { quando: '2026-06-04', texto: 'Grupos 2 do Átilas Santos & Grupo 3 do Marcelo Santana', espera: [4, 5], orfaos: 0 },
    { quando: '2026-06-11', texto: 'Grupo 4 do Elvandy Lima e Grupo 5 do Luis Roberto', espera: [3, 2], orfaos: 0 },
    { quando: '2026-06-18', texto: 'Grupo 1 Edilson Santos e Grupo 2 Átilas Santos', espera: [1, 4], orfaos: 0 },
    { quando: '2026-06-25', texto: 'Grupo 3 Marcelo Santana e Grupo 4 do Elvandy Lima', espera: [5, 3], orfaos: 0 },
    { quando: '2026-07-02', texto: 'Grupos 5 do Luis Roberto & Grupo 1 Edilson Santos', espera: [2, 1], orfaos: 0 },
    { quando: '2026-07-09', texto: 'Grupos 2 do Átilas Santos & Grupo 3 do Marcelo Santana', espera: [4, 5], orfaos: 0 },
    { quando: '2026-07-23', texto: 'Grupo 4 Elvandy LIma & Grupo 5 Luiz Roberto', espera: [3, 2], orfaos: 0 },
    { quando: '2026-07-30', texto: 'Grupo 1 Edilson Santos & Grupo 2 do Átilas Santos', espera: [1, 4], orfaos: 0 },
    { quando: '2026-08-06', texto: 'Grupos 3 Marcelo Santana & Grupo 4 Elvandy Lima', espera: [5, 3], orfaos: 0 },
    { quando: '2026-08-13', texto: 'Grupos 5 Luiz Roberto & Grupo 1 Edilson Santos', espera: [2, 1], orfaos: 0 },
    { quando: '2026-08-20', texto: 'Grupo 2 Átilas Santos & Grupo 3 Marcelo Santana', espera: [4, 5], orfaos: 0 },
    { quando: '2026-08-27', texto: 'Grupo 4 Elvandy Lima & Grupo 5 Luiz Roberto', espera: [3, 2], orfaos: 0 },
    { quando: '2026-09-03', texto: 'Grupos 1 Edilson Santos & Grupo 2 Átilas Santos', espera: [1, 4], orfaos: 0 },
    { quando: '2026-09-10', texto: 'Grupos 3 Marcelo Santana & Grupo 4 Elvandy Lima', espera: [5, 3], orfaos: 0 },
    { quando: '2026-09-17', texto: 'Grupo 5 Luiz Roberto & Grupo 1 Edilson Santos', espera: [2, 1], orfaos: 0 },
    { quando: '2026-09-24', texto: 'Grupo 2 Átilas Santos & Grupo 3 Marcelo Santana', espera: [4, 5], orfaos: 0 },
];

/** A numeracao ATUAL (a de Junho em diante), que e a que deve ser aprendida. */
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

console.log('=== 1. As 19 semanas de producao casam com os grupos certos ===\n');
let totalOrfaos = 0;
for (const { texto, espera, orfaos } of SEMANAS) {
    const { grupos, naoCasados } = Limpeza.gruposDaSemana(texto, GRUPOS);
    const ids = grupos.map(g => g.grupo.id);
    totalOrfaos += naoCasados.length;
    ok(
        ids.length === espera.length && espera.every(id => ids.includes(id)),
        `"${texto}"\n        -> ${ids.map(nomeDe).join(' + ') || '(nenhum)'}`,
        `esperado ${espera.map(nomeDe).join(' + ') || '(nenhum)'}`,
    );
    ok(naoCasados.length === orfaos, `   ${orfaos} fragmento(s) de fora, como esperado`,
        JSON.stringify(naoCasados.map(f => f.bruto)));
}
ok(totalOrfaos === 1, 'no total, so o "Helber Dias" (grupo extinto) fica sem casar');

console.log('\n=== 2. " e " separa grupos, mas nao parte nomes ===\n');
{
    // O defeito que producao revelou: com " e " fora dos separadores, a linha virava um
    // fragmento so, batia com DOIS grupos e o criterio conservador recusava os dois — de
    // modo que a semana inteira ficava sem ninguem avisado.
    const { grupos } = Limpeza.gruposDaSemana('Grupo 2 do Átilas Santos e Grupo 5 do Elvandy Lima', GRUPOS);
    ok(grupos.length === 2, '" e " entre dois grupos separa os dois', JSON.stringify(grupos.map(g => g.grupo.nome)));
}
{
    // E o motivo de " e " nao poder virar separador solto: ele mora dentro de nomes reais.
    const comOlga = [...GRUPOS, { id: 8, nome: 'Olga Pereira e Souza', numero: null }];
    const { grupos } = Limpeza.gruposDaSemana('Grupo 1 Olga Pereira e Souza', comOlga);
    ok(grupos.length === 1 && grupos[0].grupo.id === 8, '" e " DENTRO do nome nao parte a pessoa ao meio');
}
{
    const { grupos } = Limpeza.gruposDaSemana('Grupo 1 Edilson Santos,Grupo 2 Átilas Santos', GRUPOS);
    ok(grupos.length === 2, 'virgula tambem separa');
}
{
    const { grupos } = Limpeza.gruposDaSemana('Grupo 1 Edilson Santos Grupo 2 Átilas Santos', GRUPOS);
    ok(grupos.length === 2, 'e ate sem separador nenhum, porque o corte e antes de "Grupo"');
}

console.log('\n=== 3. Nome invertido, cortado e com Z ===\n');
{
    const { grupos } = Limpeza.gruposDaSemana('Grupo 6 Roberto Luiz', GRUPOS);
    ok(grupos[0]?.grupo.nome === 'Luis Roberto', '"Roberto Luiz" e o "Luis Roberto" de cabeca para baixo');
}
ok(Limpeza._internos.mesmaPalavra('elvandy', 'elvandyr'), 'elvandy ~ elvandyr (o R cortado)');
ok(!Limpeza._internos.mesmaPalavra('mar', 'marcelo'), 'mar !~ marcelo (curto demais)');
ok(!Limpeza._internos.mesmaPalavra('marcelo', 'marciano'), 'marcelo !~ marciano');

console.log('\n=== 4. A numeracao aprendida e a ATUAL, nao a de Marco ===\n');
{
    const { aprendidos, conflitos } = Limpeza.aprenderNumeros(SEMANAS, GRUPOS);
    for (const [id, esperado] of Object.entries(NUMEROS_ESPERADOS)) {
        const achado = aprendidos.get(Number(id));
        ok(achado === esperado, `${nomeDe(Number(id))} = Grupo ${esperado}`, `veio ${achado}`);
    }

    // Marco chamava Marcelo de 4, Elvandyr de 5 e Luis de 6. Os tres tem de aparecer como
    // divergencia RESOLVIDA — decidida a favor do presente, mas nunca em silencio.
    const resolvidos = conflitos.filter(c => c.resolvido).map(c => c.grupoId).sort();
    ok(JSON.stringify(resolvidos) === JSON.stringify([2, 3, 5]),
        'os tres grupos renumerados aparecem como divergencia resolvida',
        JSON.stringify(conflitos));
    ok(conflitos.every(c => c.resolvido), 'e nenhum ficou sem decisao');
}
{
    // A ordem da lista nao pode importar: o que decide e o `quando`.
    const embaralhadas = [...SEMANAS].reverse();
    const { aprendidos } = Limpeza.aprenderNumeros(embaralhadas, GRUPOS);
    ok(aprendidos.get(5) === 3, 'lista fora de ordem chega no mesmo numero (manda a data)');
}
{
    // Um erro de digitacao na semana mais nova NAO pode renumerar o grupo sozinho.
    const comErro = [
        { quando: '2026-06-04', texto: 'Grupo 3 Marcelo Santana' },
        { quando: '2026-07-04', texto: 'Grupo 3 Marcelo Santana' },
        { quando: '2026-08-04', texto: 'Grupo 9 Marcelo Santana' },
    ];
    const { aprendidos, conflitos } = Limpeza.aprenderNumeros(comErro, GRUPOS);
    ok(aprendidos.get(5) === undefined, 'numero novo que aparece UMA vez so nao grava nada');
    ok(conflitos[0]?.resolvido === false, 'e fica registrado como conflito em aberto');
}
{
    // Mas uma renumeracao de verdade, confirmada por duas semanas, passa a valer.
    const renumerado = [
        { quando: '2026-06-04', texto: 'Grupo 3 Marcelo Santana' },
        { quando: '2026-07-04', texto: 'Grupo 3 Marcelo Santana' },
        { quando: '2026-08-04', texto: 'Grupo 2 Marcelo Santana' },
        { quando: '2026-08-11', texto: 'Grupo 2 Marcelo Santana' },
    ];
    const { aprendidos, conflitos } = Limpeza.aprenderNumeros(renumerado, GRUPOS);
    ok(aprendidos.get(5) === 2, 'renumeracao confirmada por duas semanas passa a valer');
    ok(conflitos[0]?.descartados.join() === '3', 'e o numero antigo aparece como descartado');
}

console.log('\n=== 5. Com o numero gravado, o nome pode ate mudar ===\n');
{
    const comNumero = GRUPOS.map(g => ({ ...g, numero: NUMEROS_ESPERADOS[g.id] }));
    // O grupo foi rebatizado no cadastro (trocou o dirigente), mas o documento ainda usa o
    // numero. E exatamente para isto que o numero existe.
    const renomeados = comNumero.map(g => (g.id === 3 ? { ...g, nome: 'Josias Andrade' } : g));
    const { grupos } = Limpeza.gruposDaSemana('Grupo 4 Elvandy LIma & Grupo 5 Luiz Roberto', renomeados);
    ok(grupos.some(g => g.grupo.id === 3), 'grupo renomeado ainda casa pelo numero');
    ok(grupos.find(g => g.grupo.id === 3)?.criterio === 'numero', 'e o criterio usado foi o numero');
}

console.log('\n=== 6. O casamento recusa o que nao tem certeza ===\n');
{
    const doisAtilas = [...GRUPOS, { id: 9, nome: 'Átilas Santos Filho', numero: null }];
    const { grupos, naoCasados } = Limpeza.gruposDaSemana('Grupo 2 do Átilas Santos', doisAtilas);
    ok(grupos.length === 0, 'dois grupos plausiveis nao casam com nenhum');
    ok(naoCasados[0]?.ambiguo === true, 'e a ambiguidade e reportada');
}
ok(Limpeza.gruposDaSemana('Grupo 1 Edmilson Souza', GRUPOS).grupos.length === 0,
    '"Edmilson Souza" nao vira "Edilson Santos"');
ok(Limpeza.gruposDaSemana('Grupo 1 Marcelo', GRUPOS).grupos.length === 0,
    'so o primeiro nome nao basta ("Marcelo")');
{
    const { grupos, naoCasados } = Limpeza.gruposDaSemana('A definir', GRUPOS);
    ok(grupos.length === 0 && naoCasados.length === 0, '"A definir" nao vira grupo nem aviso');
}
ok(Limpeza.gruposDaSemana('', GRUPOS).grupos.length === 0, 'semana sem limpeza nao escala ninguem');

console.log(`\n${falhas === 0 ? 'TUDO OK' : `${falhas} FALHA(S)`}\n`);
process.exit(falhas === 0 ? 0 : 1);
