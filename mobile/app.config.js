/* global __dirname */
// Config dinâmica do Expo.
//
// O app.json traz só padrões genéricos. O que é de cada congregação vem de variáveis de
// ambiente — do arquivo mobile/.env (copie o .env.example) ou das "Environment variables"
// do projeto no expo.dev. Assim o repositório público não carrega a conta de ninguém, e cada
// um aponta o app para o próprio servidor e a própria conta do Expo. Ver docs/APP.md.
//
// O .env é lido aqui mesmo, à mão: o EAS CLI resolve esta config com EXPO_NO_DOTENV=1, e o
// carregador do Expo obedece. Sem isto o `eas build` montava o app genérico
// (com.exemplo.servirmais) — e o EAS gerava uma chave de assinatura nova para ele.
// Variável já definida (painel do expo.dev, terminal) vence o arquivo.
const fs = require("fs");
const path = require("path");

const arquivoEnv = path.join(__dirname, ".env");
if (fs.existsSync(arquivoEnv)) {
  for (const linha of fs.readFileSync(arquivoEnv, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i.exec(linha);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

module.exports = ({ config }) => {
  const env = process.env;
  const projectId = env.EAS_PROJECT_ID;
  const appId = env.APP_ID || config.ios.bundleIdentifier;
  // Push no Android precisa do google-services.json do Firebase. Sem ele o app funciona,
  // só não recebe notificação — por isso é opcional, e não quebra o build.
  // Google Maps dentro do app. Android: sem a chave o Google Maps não abre, e o app mostra o
  // território sem o mapa. iPhone: sem a chave, vale o mapa da Apple.
  const mapsAndroid = env.GOOGLE_MAPS_ANDROID_KEY;
  const mapsIos = env.GOOGLE_MAPS_IOS_KEY;
  const googleServices =
    env.GOOGLE_SERVICES_JSON ||
    (fs.existsSync(path.join(__dirname, "google-services.json"))
      ? "./google-services.json"
      : undefined);

  return {
    ...config,
    name: env.APP_NAME || config.name,
    ...(env.EXPO_OWNER && { owner: env.EXPO_OWNER }),
    ios: {
      ...config.ios,
      bundleIdentifier: appId,
      ...(mapsIos && { config: { ...config.ios?.config, googleMapsApiKey: mapsIos } }),
    },
    android: {
      ...config.android,
      package: appId,
      ...(googleServices && { googleServicesFile: googleServices }),
      ...(mapsAndroid && { config: { ...config.android?.config, googleMaps: { apiKey: mapsAndroid } } }),
    },
    ...(projectId && { updates: { ...config.updates, url: `https://u.expo.dev/${projectId}` } }),
    extra: {
      ...config.extra,
      apiUrl: env.EXPO_PUBLIC_API_URL || config.extra?.apiUrl,
      // Só o "tem ou não tem" vai para o app; a chave fica na configuração nativa.
      mapaGoogle: { android: !!mapsAndroid, ios: !!mapsIos },
      ...(projectId && { eas: { projectId } }),
    },
  };
};
