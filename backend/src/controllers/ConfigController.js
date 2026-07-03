const prisma = require('../prisma');

class ConfigController {
    async getConfig(req, res) {
        try {
            let config = await prisma.config.findFirst();

            if (!config) {
                // Seed inicial se não existir
                config = await prisma.config.create({
                    data: {
                        titulo: 'Quadro de Designações JANEIRO',
                        subtitulo: 'Congregação',
                        mes: 'JAN'
                    }
                });
            }

            return res.json(config);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async updateConfig(req, res) {
        try {
            const { titulo, subtitulo, mes } = req.body;
            const config = await prisma.config.findFirst();

            if (!config) {
                await prisma.config.create({
                    data: { titulo, subtitulo, mes }
                });
            } else {
                await prisma.config.update({
                    where: { id: config.id },
                    data: { titulo, subtitulo, mes }
                });
            }

            return res.json({ success: true });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async resetDatabase(req, res) {
        try {
            console.log('Iniciando reset do banco de dados...');

            // Deletar todos os dados em ordem (respeitando foreign keys), de forma atomica.
            // Cobre TODOS os modelos exceto Usuario (mantido para preservar o login).
            await prisma.$transaction([
                prisma.historico.deleteMany({}),
                prisma.designacao.deleteMany({}),
                prisma.quadro.deleteMany({}),
                prisma.escalaDirigente.deleteMany({}),
                prisma.quadroDirigente.deleteMany({}),
                prisma.dirigenteSaidaCampo.deleteMany({}),
                prisma.saidaCampo.deleteMany({}),
                prisma.semanaReuniao.deleteMany({}),
                prisma.reuniao.deleteMany({}),
                prisma.indisponibilidade.deleteMany({}),
                prisma.irmao.deleteMany({}),
                prisma.config.deleteMany({}),
            ]);

            console.log('Dados limpos. Executando seed...');

            // Executar seed novamente
            const SeedService = require('../services/SeedService');
            await SeedService.execute();

            console.log('Reset completo!');
            return res.json({ success: true, message: 'Banco de dados resetado com sucesso' });
        } catch (error) {
            console.error('Erro ao resetar banco:', error);
            return res.status(500).json({ error: 'Erro ao resetar banco de dados' });
        }
    }
}

module.exports = new ConfigController();
