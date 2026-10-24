const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * A impressao do codigo do servidor: um hash curto de src/ e do schema do Prisma. Muda a cada
 * mudanca no servidor e e igual em qualquer maquina com o mesmo codigo. O /health mostra, entao
 * para saber se um merge ja subiu basta comparar com o da main:
 *
 *   node -p "require('./src/versao').versao"
 *
 * `iniciadoEm` diz quando o processo subiu (um redeploy reinicia).
 */
function impressao(raiz = path.join(__dirname, '..')) {
    const arquivos = [];
    (function andar(dir) {
        for (const nome of fs.readdirSync(dir).sort()) {
            const p = path.join(dir, nome);
            if (fs.statSync(p).isDirectory()) andar(p);
            else arquivos.push(p);
        }
    })(path.join(raiz, 'src'));
    arquivos.push(path.join(raiz, 'prisma', 'schema.prisma'));
    const hash = crypto.createHash('sha1');
    for (const a of arquivos) hash.update(path.relative(raiz, a).split(path.sep).join('/')).update(fs.readFileSync(a));
    return hash.digest('hex').slice(0, 7);
}

module.exports = { versao: impressao(), iniciadoEm: new Date().toISOString() };
