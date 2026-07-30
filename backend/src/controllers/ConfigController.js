const prisma = require('../prisma');

/** "19:30" -> "19:30"; "9:5" -> "09:05"; qualquer outra coisa -> null (recusa o salvamento). */
function normalizarHora(valor) {
    const m = /^(\d{1,2}):(\d{1,2})$/.exec(String(valor ?? '').trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

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
            const { titulo, subtitulo, mes, horaMeioSemana, horaFimDeSemana } = req.body;
            const config = await prisma.config.findFirst();

            // Campo omitido mantem o valor; so entra no update o que veio no corpo. Sem isso,
            // a tela de configuracao antiga (que nao conhece os horarios) apagaria os dois
            // ao salvar o titulo, e os lembretes "3 horas antes" cairiam no horario errado.
            const horarios = {};
            if (horaMeioSemana !== undefined) horarios.horaMeioSemana = normalizarHora(horaMeioSemana);
            if (horaFimDeSemana !== undefined) horarios.horaFimDeSemana = normalizarHora(horaFimDeSemana);
            if (Object.values(horarios).some(v => v === null)) {
                return res.status(400).json({ error: 'Horário deve estar no formato HH:MM' });
            }

            if (!config) {
                await prisma.config.create({
                    data: { titulo, subtitulo, mes, ...horarios }
                });
            } else {
                await prisma.config.update({
                    where: { id: config.id },
                    data: { titulo, subtitulo, mes, ...horarios }
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
