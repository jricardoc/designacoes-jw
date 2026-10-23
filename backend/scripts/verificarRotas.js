/**
 * Nenhuma rota fixa pode ficar escondida atras de uma com parametro registrada antes dela.
 *
 *   npm run verificar:rotas
 *
 * O Express pega a PRIMEIRA rota que casa: `PUT /grupos/:id` registrada antes de
 * `PUT /grupos/secretario` engolia a segunda (id = "secretario") e o app recebia "Erro ao
 * salvar o grupo". Teste chamando o controller direto nao ve isso; aqui o caminho passa pelo
 * roteador de verdade. Nao precisa de banco.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'so-para-carregar-as-rotas';
const routes = require('../src/routes');

const camadas = routes.stack.filter((l) => l.route);
let falhas = 0;
for (const l of camadas) {
    const caminho = l.route.path;
    if (typeof caminho !== 'string' || caminho.includes(':') || caminho.includes('*')) continue;
    for (const metodo of Object.keys(l.route.methods)) {
        const primeira = camadas.find((c) => c.route.methods[metodo] && c.match(caminho));
        if (primeira !== l) {
            falhas += 1;
            console.log(`   FALHA ${metodo.toUpperCase()} ${caminho} cai em ${primeira.route.path}`);
        }
    }
}
console.log(falhas ? `\n${falhas} rota(s) escondida(s).` : `   ok   ${camadas.length} rotas, nenhuma escondida\n\nTudo certo.`);
process.exit(falhas ? 1 : 0);
