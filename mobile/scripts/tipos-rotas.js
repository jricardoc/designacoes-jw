/**
 * Gera os tipos das rotas (.expo/types/router.d.ts) sem subir o Metro, com o mesmo gerador do
 * expo-router: o arquivo sai igual ao do `expo start`. O `npm run typecheck` roda isto antes do
 * tsc, então rota nova não precisa de servidor aberto, e o CI (que não tem a pasta .expo) também
 * confere os tipos. Cria o expo-env.d.ts, que o Git não guarda.
 *
 * Usa um caminho interno do expo-router: numa atualização do Expo, conferir se ainda existe.
 */
const fs = require("fs");
const path = require("path");
const raiz = path.join(__dirname, "..");
const { getTypedRoutesDeclarationFile } = require(path.join(raiz, "node_modules/expo-router/build/typed-routes/generate"));
const app = path.join(raiz, "app");
const arquivos = [];
(function andar(dir) {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, n.name);
    if (n.isDirectory()) andar(p);
    else arquivos.push("./" + path.relative(app, p).split(path.sep).join("/"));
  }
})(app);
fs.mkdirSync(path.join(raiz, ".expo/types"), { recursive: true });
fs.writeFileSync(path.join(raiz, ".expo/types/router.d.ts"), getTypedRoutesDeclarationFile({ keys: () => arquivos }, {}));
const env = path.join(raiz, "expo-env.d.ts");
if (!fs.existsSync(env)) fs.writeFileSync(env, '/// <reference types="expo/types" />\n\n// NOTE: This file should not be edited and should be in your git ignore\n');
