/* global __dirname */
// Config dinâmica do Expo.
//
// O app.json traz só padrões genéricos. O que é de cada congregação vem de variáveis de
// ambiente — do arquivo mobile/.env (copie o .env.example) ou das "Environment variables"
// do projeto no expo.dev. Assim o repositório público não carrega a conta de ninguém, e cada
// um aponta o app para o próprio servidor e a própria conta do Expo. Ver docs/APP.md.
//
// O .env é carregado aqui mesmo porque o EAS CLI não o lê ao resolver esta config — e é ela
// que diz ao `eas build` qual projeto do expo.dev usar.
const fs = require("fs");
const path = require("path");

try {
  require("@expo/env").load(__dirname, { silent: true });
} catch {
  // Sem @expo/env (não deveria acontecer: vem com o expo), valem só as variáveis do sistema.
}

module.exports = ({ config }) => {
  const env = process.env;
  const projectId = env.EAS_PROJECT_ID;
  const appId = env.APP_ID || config.ios.bundleIdentifier;
  // Push no Android precisa do google-services.json do Firebase. Sem ele o app funciona,
  // só não recebe notificação — por isso é opcional, e não quebra o build.
  const googleServices =
    env.GOOGLE_SERVICES_JSON ||
    (fs.existsSync(path.join(__dirname, "google-services.json"))
      ? "./google-services.json"
      : undefined);

  return {
    ...config,
    name: env.APP_NAME || config.name,
    ...(env.EXPO_OWNER && { owner: env.EXPO_OWNER }),
    ios: { ...config.ios, bundleIdentifier: appId },
    android: {
      ...config.android,
      package: appId,
      ...(googleServices && { googleServicesFile: googleServices }),
    },
    ...(projectId && { updates: { ...config.updates, url: `https://u.expo.dev/${projectId}` } }),
    extra: {
      ...config.extra,
      apiUrl: env.EXPO_PUBLIC_API_URL || config.extra?.apiUrl,
      ...(projectId && { eas: { projectId } }),
    },
  };
};
