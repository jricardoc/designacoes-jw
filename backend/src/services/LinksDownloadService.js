const crypto = require('crypto');

/**
 * Os links de "baixar o app" (servirmais.site/download/android e /ios) moram no banco, em
 * Config.linksDownload, e quem os atualiza e o proprio EAS: a cada build, ele avisa o webhook
 * /webhooks/eas. Assim um build novo vale sozinho, sem PR nem deploy do site.
 *
 * Aqui ficam so as regras, sem banco nem Express, para dar para testar
 * (scripts/verificarLinksDownload.js).
 */

/** So o build deste perfil vira link de instalar. O de desenvolvimento nao abre sem o Metro. */
const PERFIL = 'preview';

const PLATAFORMAS = ['android', 'ios'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O link que INSTALA, e nao a pagina do build: no Android, o proprio APK; no iPhone, o
 * itms-services do manifesto do EAS (o mesmo do botao "Install" da pagina do build), que abre
 * direto o "Instalar?" do aparelho. `appId` no aviso do EAS e o id do projeto.
 */
function instalador(build) {
    if (build.platform === 'android') {
        const apk = String((build.artifacts && build.artifacts.buildUrl) || '');
        return /^https:\/\/expo\.dev\/artifacts\/eas\/[\w-]+\.apk$/.test(apk) ? apk : null;
    }
    if (!UUID.test(String(build.appId)) || !UUID.test(String(build.id))) return null;
    return `itms-services://?action=download-manifest;url=https://api.expo.dev/v2/projects/${build.appId}/builds/${build.id}/manifest.plist`;
}

/**
 * O EAS assina o corpo CRU com HMAC-SHA1 e manda em `expo-signature` como "sha1=<hex>".
 * Sem segredo configurado, nada passa: um webhook aberto deixaria qualquer um trocar o link.
 */
function assinaturaValida(corpoCru, assinatura, segredo) {
    if (!segredo || !assinatura || !Buffer.isBuffer(corpoCru)) return false;
    const esperada = Buffer.from('sha1=' + crypto.createHmac('sha1', segredo).update(corpoCru).digest('hex'));
    const recebida = Buffer.from(String(assinatura));
    return recebida.length === esperada.length && crypto.timingSafeEqual(recebida, esperada);
}

/**
 * Do aviso do EAS, o que guardar: { plataforma, url, versao, em }. Null quando o build nao
 * serve para instalar (ainda rodando, com erro, de outro perfil) ou quando nao da para montar
 * o instalador (APK fora do expo.dev, ids que nao sao do EAS).
 */
function linkDoBuild(build) {
    if (!build || build.status !== 'finished' || !PLATAFORMAS.includes(build.platform)) return null;
    const meta = build.metadata || {};
    if (meta.buildProfile !== PERFIL) return null;
    const url = instalador(build);
    if (!url) return null;
    return {
        plataforma: build.platform,
        url,
        versao: meta.appVersion || null,
        em: build.completedAt || build.updatedAt || null,
    };
}

/**
 * Junta o link novo aos guardados. Devolve null quando nao muda nada: um build mais antigo
 * que termina depois de um mais novo nao pode tomar o lugar dele.
 */
function juntar(guardados, link) {
    const atuais = guardados && typeof guardados === 'object' && !Array.isArray(guardados) ? guardados : {};
    const anterior = atuais[link.plataforma];
    if (anterior && anterior.em && link.em && new Date(link.em) < new Date(anterior.em)) return null;
    return { ...atuais, [link.plataforma]: { url: link.url, versao: link.versao, em: link.em } };
}

/** O endereco para onde mandar quem abre /download/:plataforma, ou null. */
function destino(guardados, plataforma) {
    if (!PLATAFORMAS.includes(plataforma) || !guardados || typeof guardados !== 'object') return null;
    const link = guardados[plataforma];
    return link && typeof link.url === 'string' ? link.url : null;
}

module.exports = { assinaturaValida, linkDoBuild, juntar, destino, PERFIL };
