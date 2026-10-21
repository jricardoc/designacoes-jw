/**
 * Verificacao dos links de download guardados pelo webhook do EAS.
 *
 *   npm run verificar:links-download
 *
 * Nao precisa de banco nem de internet.
 *
 * Por que isto existe: um erro aqui passa despercebido ate alguem tentar instalar. Uma
 * assinatura mal conferida deixa qualquer um trocar o link; um filtro frouxo troca o link de
 * instalar por um build de desenvolvimento, que nao abre sem o computador ligado.
 */
const crypto = require('crypto');
const L = require('../src/services/LinksDownloadService');

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

const SEGREDO = 'segredo-de-teste';
const assinar = (corpo, segredo = SEGREDO) =>
    'sha1=' + crypto.createHmac('sha1', segredo).update(corpo).digest('hex');

const build = (mudar = {}) => ({
    platform: 'ios',
    status: 'finished',
    buildDetailsPageUrl: 'https://expo.dev/accounts/conta/projects/app/builds/abc',
    completedAt: '2026-10-21T11:13:36.519Z',
    metadata: { buildProfile: 'preview', appVersion: '2.12.0' },
    ...mudar,
});

console.log('assinatura');
const corpo = Buffer.from(JSON.stringify(build()));
eq(L.assinaturaValida(corpo, assinar(corpo), SEGREDO), true, 'aceita a assinatura certa');
eq(L.assinaturaValida(corpo, assinar(corpo, 'outro'), SEGREDO), false, 'recusa segredo errado');
eq(L.assinaturaValida(Buffer.from(corpo + ' '), assinar(corpo), SEGREDO), false, 'recusa corpo alterado');
eq(L.assinaturaValida(corpo, assinar(corpo), ''), false, 'sem segredo configurado, nada passa');
eq(L.assinaturaValida(corpo, undefined, SEGREDO), false, 'sem cabecalho, recusa');
eq(L.assinaturaValida(corpo, 'sha1=curta', SEGREDO), false, 'tamanho diferente nao estoura');

console.log('qual build vira link');
eq(L.linkDoBuild(build()), { plataforma: 'ios', url: 'https://expo.dev/accounts/conta/projects/app/builds/abc', versao: '2.12.0', em: '2026-10-21T11:13:36.519Z' }, 'preview terminado vira link');
eq(L.linkDoBuild(build({ status: 'in-progress' })), null, 'build rodando nao');
eq(L.linkDoBuild(build({ status: 'errored' })), null, 'build com erro nao');
eq(L.linkDoBuild(build({ metadata: { buildProfile: 'development' } })), null, 'build de desenvolvimento nao');
eq(L.linkDoBuild(build({ platform: 'web' })), null, 'plataforma desconhecida nao');
eq(L.linkDoBuild(build({ buildDetailsPageUrl: 'https://golpe.com/app.ipa' })), null, 'link fora do expo.dev nao');

console.log('guardar');
const android = { url: 'https://expo.dev/a', versao: '2.12.0', em: '2026-10-21T10:00:00Z' };
const novo = L.linkDoBuild(build());
eq(L.juntar({ android }, novo), { android, ios: { url: novo.url, versao: '2.12.0', em: novo.em } }, 'mantem a outra plataforma');
eq(L.juntar(null, novo).ios.url, novo.url, 'comeca do zero');
eq(L.juntar({ ios: { url: 'x', em: '2026-10-22T00:00:00Z' } }, novo), null, 'build mais antigo nao substitui o mais novo');

console.log('redirecionar');
eq(L.destino({ android }, 'android'), 'https://expo.dev/a', 'leva ao link guardado');
eq(L.destino({ android }, 'ios'), null, 'sem link da plataforma, nada');
eq(L.destino({ android }, 'windows'), null, 'plataforma desconhecida, nada');
eq(L.destino(null, 'android'), null, 'sem nada guardado, nada');

if (falhas > 0) {
    console.log(`\n${falhas} falha(s).`);
    process.exit(1);
}
console.log('\nTudo certo.');
