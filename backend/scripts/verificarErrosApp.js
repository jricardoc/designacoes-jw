/**
 * Verificacao das regras dos erros do app (o que o celular manda e quando dois sao o mesmo).
 *
 *   npm run verificar:erros-app
 *
 * Nao precisa de banco. O fluxo com banco esta em verificarErrosAppBanco.js.
 */
const E = require('../src/services/ErroAppService')._internos;

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

console.log('o que o celular manda');
eq(E.normalizar({ mensagem: '  ' }), null, 'sem mensagem: nao e erro');
eq(E.normalizar(null), null, 'nada: nao e erro');
const n = E.normalizar({ mensagem: ' x is undefined ', tela: '/estudo', fatal: true, plataforma: 'ios', extra: 'fora' });
eq([n.mensagem, n.tela, n.fatal, n.plataforma, n.pilha, 'extra' in n], ['x is undefined', '/estudo', true, 'ios', null, false], 'apara, guarda so os campos conhecidos');
eq(E.normalizar({ mensagem: 'a'.repeat(900), pilha: 'b'.repeat(9000) }).mensagem.length, 500, 'mensagem longa: 500 caracteres');
eq(E.normalizar({ mensagem: 'x', pilha: 'b'.repeat(9000) }).pilha.length, 4000, 'pilha longa: 4000 caracteres');
eq(E.normalizar({ mensagem: 'x', fatal: 'sim' }).fatal, false, 'fatal so com true');

console.log('quando dois erros sao o mesmo');
const base = { mensagem: 'TypeError: x is undefined', tela: '/estudo', updateId: 'u1', pilha: 'TypeError: x is undefined\n    at Hoje (index.bundle:1:200)\n    at outra (index.bundle:1:300)' };
const a = E.assinatura(base);
eq(E.assinatura({ ...base, pilha: 'TypeError: x is undefined\n    at Hoje (index.bundle:1:200)\n    at mudou (index.bundle:1:999)' }), a, 'mesma primeira linha "at": o mesmo erro');
eq(E.assinatura({ ...base, tela: '/ministerio' }) === a, false, 'outra tela: outro erro');
eq(E.assinatura({ ...base, updateId: 'u2' }) === a, false, 'outra atualizacao: outro erro');
eq(E.assinatura({ ...base, pilha: 'TypeError: x is undefined\n    at Leitura (index.bundle:1:50)' }) === a, false, 'outro lugar do codigo: outro erro');
eq(E.assinatura({ mensagem: 'x' }).length, 40, 'sem pilha nem tela tambem tem assinatura');

console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
