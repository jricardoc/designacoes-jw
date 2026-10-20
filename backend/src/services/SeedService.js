const crypto = require('crypto');
const prisma = require('../prisma');
const bcrypt = require('bcrypt');

/**
 * Carga inicial de uma instalacao nova: so o usuario `admin` e a configuracao em branco.
 *
 * Nada de dados da congregacao aqui — irmaos, saidas de campo, carrinho e grupos sao
 * cadastrados pelo app. Cada bloco so roda com a tabela vazia, entao num banco que ja tem
 * dados isto nao faz nada (alem do vinculo usuario-irmao, que e idempotente).
 */
class SeedService {
    async execute() {
        try {
            console.log('Checking seed...');

            if ((await prisma.usuario.count()) === 0) {
                // Sem ADMIN_SEED_PASSWORD, uma senha aleatoria — nunca uma fixa, que todo mundo
                // que lesse este repositorio publico conheceria. Ela sai no log UMA vez.
                const senhaInicial = process.env.ADMIN_SEED_PASSWORD || crypto.randomBytes(9).toString('base64url');
                await prisma.usuario.create({
                    data: {
                        nickname: 'admin',
                        senha: await bcrypt.hash(senhaInicial, 10),
                        nome: 'Administrador',
                        isAdmin: true
                    }
                });
                if (process.env.ADMIN_SEED_PASSWORD) {
                    console.log('Admin criado: nickname=admin, senha=ADMIN_SEED_PASSWORD (troque no primeiro acesso).');
                } else {
                    console.log(`>>> Admin criado: nickname=admin  senha=${senhaInicial}  (troque no primeiro acesso) <<<`);
                }
            }

            if ((await prisma.config.count()) === 0) {
                // O nome da congregacao fica vazio: o admin preenche em Ajustes.
                await prisma.config.create({
                    data: { titulo: 'Quadro de Designações', subtitulo: '', mes: 'JAN' }
                });
            }

            // Vincular contas de acesso ao cadastro de irmaos.
            // Roda a cada boot de proposito: e idempotente, so mexe em quem esta sem vinculo,
            // e assim uma conta criada antes do irmao existir acaba sendo ligada sozinha.
            const VinculoIrmaoService = require('./VinculoIrmaoService');
            await VinculoIrmaoService.sincronizarUsuarios();

            console.log('Seed verified.');
        } catch (error) {
            console.error('Seed failed:', error);
        }
    }
}

module.exports = new SeedService();
