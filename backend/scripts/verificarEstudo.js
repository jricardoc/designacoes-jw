/**
 * Verificacao das regras do estudo pessoal.
 *
 *   npm run verificar:estudo
 *
 * Nao precisa de banco: so as regras de EstudoService. O fluxo com banco esta em
 * verificarEstudoBanco.js.
 */
const E = require('../src/services/EstudoService')._internos;

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

console.log('links: so jw.org e a Biblioteca On-line');
eq(E.linkDoJw('https://www.jw.org/pt/biblioteca/revistas/'), 'https://www.jw.org/pt/biblioteca/revistas/', 'jw.org passa');
eq(E.linkDoJw(' https://wol.jw.org/pt/wol/h/r5/lp-t '), 'https://wol.jw.org/pt/wol/h/r5/lp-t', 'wol passa, sem os espacos');
eq([E.linkDoJw(''), E.linkDoJw(null)], [null, null], 'vazio: sem link');
eq(
    [E.linkDoJw('http://www.jw.org/pt/'), E.linkDoJw('https://jw.org.exemplo.com/'), E.linkDoJw('https://exemplo.com/?u=jw.org'), E.linkDoJw('jw.org')],
    [false, false, false, false],
    'http, outro dominio, jw.org no meio e sem https: recusados',
);
eq(E.linkDoJw(`https://www.jw.org/${'a'.repeat(500)}`), false, 'link enorme: recusado');

console.log('perfil');
eq(E.normalizarPerfil({ plano: 'jw', opcao: 'cat:10', ritmo: 2, inicio: '2026-10-24' }).dados, { plano: 'jw', opcao: 'cat:10', inicio: '2026-10-24', ritmo: 2 }, 'programa, categoria, ritmo e inicio');
eq(E.normalizarPerfil({ planoB: '21:30' }).dados, { planoB: '21:30' }, 'plano B');
eq(
    [E.normalizarPerfil({ plano: 'outro' }).erro, E.normalizarPerfil({ opcao: 'cat:11' }).erro, E.normalizarPerfil({ ritmo: 4 }).erro, E.normalizarPerfil({ planoB: '21:10' }).erro],
    ['Programa de leitura inválido.', 'Opção do programa inválida.', 'Ritmo de 1, 2 ou 3 dias por trecho.', 'Horário do plano B inválido.'],
    'programa, categoria, ritmo e plano B fora do lugar',
);
eq(E.normalizarPerfil({}).dados, {}, 'nada veio, nada muda');

console.log('rotina');
eq(E.normalizarRotina({ tipo: 'estudo', dias: [4, 2, 2, 9], hora: '20:00', avisoMin: 15 }).dados, { tipo: 'estudo', dias: [2, 4], hora: '20:00', avisoMin: 15 }, 'dias sem repetir e em ordem; dia 9 sai');
eq(E.normalizarRotina({ tipo: 'leitura', dias: [0], hora: '06:30' }).dados.avisoMin, null, 'sem aviso');
eq(
    [E.normalizarRotina({ tipo: 'outro', dias: [1], hora: '20:00' }).erro, E.normalizarRotina({ tipo: 'estudo', dias: [], hora: '20:00' }).erro, E.normalizarRotina({ tipo: 'estudo', dias: [1], hora: '20:10' }).erro, E.normalizarRotina({ tipo: 'estudo', dias: [1], hora: '20:00', avisoMin: 5 }).erro],
    ['Tipo de rotina inválido.', 'Escolha pelo menos um dia da semana.', 'Horário de 15 em 15 minutos.', 'Aviso de 0, 15, 30 ou 60 minutos antes.'],
    'tipo, dia, hora fora do quarto de hora e aviso',
);

console.log('assunto');
eq(E.normalizarAssunto({ titulo: '  A oração de Ana  ', tipo: 'oracao', link: '' }).dados, { titulo: 'A oração de Ana', tipo: 'oracao', link: null, nota: null }, 'assunto limpo, sem link');
eq(E.normalizarAssunto({ titulo: 'x', link: 'https://exemplo.com/' }).erro, 'Só links do jw.org ou da Biblioteca On-line.', 'link de fora: recusado');
eq(E.normalizarAssunto({ titulo: '' }).erro, 'Escreva o assunto.', 'sem titulo');
eq(E.normalizarAssunto({ nota: 'ok' }, { parcial: true }).dados, { nota: 'ok' }, 'parcial: so o que veio');

console.log('aviso da rotina (janela de 30 minutos, dois tiques)');
const m = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
eq(E.venceu('20:00', 15, m('19:45')), true, 'no tique das 19:45, o estudo das 20:00 com 15 min');
eq(E.venceu('20:00', 15, m('20:00')), true, 'um tique perdido ainda avisa no seguinte');
eq(E.venceu('20:00', 15, m('20:15')), false, 'passada a janela, nao avisa mais');
eq(E.venceu('20:00', 15, m('19:30')), false, 'antes da hora, nao');
eq(E.venceu('00:00', 15, m('00:00')), false, 'alvo antes da meia-noite fica sem aviso');
eq(E.venceu('06:30', 0, m('06:30')), true, 'aviso na hora');
eq(E.avisoDaRotina({ tipo: 'estudo', hora: '20:00' }), { titulo: 'Hora do estudo pessoal', corpo: 'Às 20:00. Sem vontade? Comece com 10 minutos.' }, 'aviso do estudo com a dica dos 10 minutos');
eq(E.avisoDaRotina({ tipo: 'estudo', hora: '20:00' }, 'A oração de Ana').corpo, 'Às 20:00. Assunto: A oração de Ana. Sem vontade? Comece com 10 minutos.', 'e com o assunto da vez');
// O relogio da congregacao vem de RegrasLembrete; aqui basta um instante dele e o dia da semana certo.
const { relogioDaCongregacao } = require('../src/services/RegrasLembrete');
const noRelogio = (dia, hora) => {
    const base = new Date(`${dia}T${hora}:00Z`);
    return new Date(base.getTime() - (relogioDaCongregacao(base).getTime() - base.getTime()));
};
eq(
    [E.avisoDeHojePassou([2], '20:00', 15, noRelogio('2026-11-03', '19:50')), E.avisoDeHojePassou([2], '20:00', 15, noRelogio('2026-11-03', '19:40')), E.avisoDeHojePassou([4], '20:00', 15, noRelogio('2026-11-03', '19:50'))],
    [true, false, false],
    'salvar depois do aviso de hoje: conta como dado; antes, ou em outro dia, nao',
);

console.log('trechos');
eq(E.CAPITULOS.length === 66 && E.CAPITULOS.reduce((a, b) => a + b, 0), 1189, '66 livros, 1.189 capitulos');
eq([E.ehCapitulo('43:3'), E.ehCapitulo('19:150'), E.ehCapitulo('66:22')], [true, true, true], 'capitulos de verdade');
eq([E.ehCapitulo('99:1'), E.ehCapitulo('19:151'), E.ehCapitulo('1:0'), E.ehCapitulo('1:4-7')], [false, false, false, false], 'livro 99, Salmo 151, capitulo 0 e faixa: recusados');
eq(['1:4-7', '19:116-119.63', 'noe', '2026-10-19', '43:3'].every(E.ehItem), true, 'ids dos quatro programas');
eq([E.ehItem(''), E.ehItem('a b'), E.ehItem('<x>'), E.ehItem('x'.repeat(31))], [false, false, false, false], 'vazio, espaco, simbolo e longo demais');

if (falhas > 0) {
    console.log(`\n${falhas} falha(s).`);
    process.exit(1);
}
console.log('\nTudo certo.');
