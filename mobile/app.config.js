// Config dinâmica do Expo.
//
// Mantém todo o app.json e apenas resolve o google-services.json (que contém a
// API key do Firebase e NÃO deve ser versionado) a partir de um EAS file secret
// no build. Localmente cai no ./google-services.json (ignorado pelo git).
//
// Para o build na nuvem funcionar, crie o secret uma vez (na pasta mobile/):
//   eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ??
      config.android?.googleServicesFile ??
      "./google-services.json",
  },
});
