/**
 * Verificacao das regras da assistencia.
 *
 *   npm run verificar:assistencia
 *
 * Nao precisa de banco: so as regras de AssistenciaService.
 */
const A = require('../src/services/AssistenciaService');

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

console.log('reuniao');
eq(A.erroDaReuniao('16/10/2026', 'meio'), null, 'data e tipo certos');
eq(A.erroDaReuniao('2026-10-16', 'meio'), 'Data inválida. Use o formato dd/MM/yyyy.', 'formato errado');
eq(A.erroDaReuniao('31/02/2026', 'fds'), 'Data inexistente no calendário.', '31 de fevereiro');
eq(A.erroDaReuniao('16/10/2026', 'domingo'), 'Tipo inválido. Use "meio" ou "fds".', 'tipo desconhecido');

console.log('lista do Zoom');
eq(A.normalizarPresencas('x'), null, 'nao e lista');
eq(A.normalizarPresencas(Array.from({ length: 301 }, (_, i) => ({ nome: `n${i}` }))), null, 'mais de 300 conexoes');
eq(A.normalizarPresencas([
    { nome: '  Ana   Souza ', irmaoId: 7, pessoas: 3, levantouMao: true },
    { nome: 'iPhone de Carlos', pessoas: 0 },
    { nome: '', pessoas: 2 },
    { nome: 'ANA SOUZA', levantouMao: false },
    { nome: 'Família Lima', irmaoId: 'x', pessoas: 99, levantouMao: 'sim' },
]), [
    { nome: 'Ana Souza', irmaoId: 7, pessoas: 3, levantouMao: true },
    { nome: 'iPhone de Carlos', irmaoId: null, pessoas: 1, levantouMao: false },
    { nome: 'Família Lima', irmaoId: null, pessoas: 30, levantouMao: false },
], 'apara nomes, junta repetidos, limita pessoas a 1..30, mao so com true, descarta sem nome');
eq(A.normalizarPresencas([{ nome: 'Ana' }, { nome: 'ana', levantouMao: true }])[0].levantouMao, true,
    'mao levantada numa repeticao vale');

console.log('resumo');
eq(A.resumoZoom([{ pessoas: 3, levantouMao: true }, { pessoas: 1, levantouMao: false }]),
    { zoomConexoes: 2, zoomPessoas: 4, maos: 1 }, 'conexoes, pessoas e maos');
eq(A.resumoZoom([]), { zoomConexoes: 0, zoomPessoas: 0, maos: 0 }, 'lista vazia');

if (falhas > 0) {
    console.log(`\n${falhas} falha(s).`);
    process.exit(1);
}
console.log('\nTudo certo.');
