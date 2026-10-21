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

const PROJETO = 'fb0e366c-d0bf-441a-8faa-b70bd7c34242';
const ID_IOS = '708578ed-aca9-42a3-9cb9-69511591fb34';
const ITMS = `itms-services://?action=download-manifest;url=https://api.expo.dev/v2/projects/${PROJETO}/builds/${ID_IOS}/manifest.plist`;
const APK = 'https://expo.dev/artifacts/eas/G0B9VdLUw0kUyBmFr-91X8T9wZkRDbTNeL5dRl5ehAA.apk';

const build = (mudar = {}) => ({
    id: ID_IOS,
    appId: PROJETO,
    platform: 'ios',
    status: 'finished',
    buildDetailsPageUrl: 'https://expo.dev/accounts/conta/projects/app/builds/abc',
    artifacts: { buildUrl: 'https://expo.dev/artifacts/eas/R3M8kpoww.ipa' },
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
eq(L.linkDoBuild(build()), { plataforma: 'ios', url: ITMS, versao: '2.12.0', em: '2026-10-21T11:13:36.519Z' }, 'iPhone: o instalador (itms-services do manifesto), nao a pagina');
eq(L.linkDoBuild(build({ platform: 'android', artifacts: { buildUrl: APK } })).url, APK, 'Android: o proprio APK');
eq(L.linkDoBuild(build({ platform: 'android', artifacts: { buildUrl: 'https://expo.dev/artifacts/eas/x.aab' } })), null, 'Android sem APK (aab) nao instala, nao vira link');
eq(L.linkDoBuild(build({ platform: 'android', artifacts: { buildUrl: 'https://golpe.com/app.apk' } })), null, 'APK fora do expo.dev nao');
eq(L.linkDoBuild(build({ appId: 'x' })), null, 'iPhone sem id de projeto valido nao');
eq(L.linkDoBuild(build({ status: 'in-progress' })), null, 'build rodando nao');
eq(L.linkDoBuild(build({ status: 'errored' })), null, 'build com erro nao');
eq(L.linkDoBuild(build({ metadata: { buildProfile: 'development' } })), null, 'build de desenvolvimento nao');
eq(L.linkDoBuild(build({ platform: 'web' })), null, 'plataforma desconhecida nao');

console.log('guardar');
const android = { url: 'https://expo.dev/a', versao: '2.12.0', em: '2026-10-21T10:00:00Z' };
const novo = L.linkDoBuild(build());
eq(L.juntar({ android }, novo), { android, ios: { url: novo.url, versao: '2.12.0', em: novo.em } }, 'mantem a outra plataforma');
eq(L.juntar(null, novo).ios.url, ITMS, 'comeca do zero');
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
