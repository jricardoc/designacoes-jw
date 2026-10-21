const { Prisma } = require('@prisma/client');
const prisma = require('../prisma');
const LinksDownload = require('../services/LinksDownloadService');

const CAMPOS_ZOOM = ['link', 'id', 'senha', 'salaAberta'];

/**
 * { meio: {link, id, senha, salaAberta}, fds: {...} } so com os campos conhecidos, aparados
 * e curtos. Reuniao sem nada preenchido some; tudo vazio vira null. undefined = invalido.
 */
function sanearZoom(valor) {
    if (valor === null) return null;
    if (typeof valor !== 'object' || Array.isArray(valor)) return undefined;
    const zoom = {};
    for (const tipo of ['meio', 'fds']) {
        const reuniao = {};
        for (const campo of CAMPOS_ZOOM) {
            const texto = String((valor[tipo] && valor[tipo][campo]) || '').trim().slice(0, 300);
            if (texto) reuniao[campo] = texto;
        }
        if (Object.keys(reuniao).length > 0) zoom[tipo] = reuniao;
    }
    return Object.keys(zoom).length > 0 ? zoom : null;
}

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
                    data: { titulo: 'Quadro de Designações', subtitulo: '', mes: 'JAN' }
                });
            }

            return res.json(config);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * GET /download/:plataforma — sem login: leva ao build mais recente do app. O link vem do
     * banco, posto ali pelo webhook do EAS; o site (servirmais.site/download/...) so aponta para ca.
     */
    async download(req, res) {
        try {
            const config = await prisma.config.findFirst({ select: { linksDownload: true } });
            const url = LinksDownload.destino(config && config.linksDownload, req.params.plataforma);
            if (!url) {
                return res.status(404).type('text/plain; charset=utf-8').send('Ainda não há uma versão do app para instalar por aqui.');
            }
            // Sem cache: o build seguinte troca o destino, e o navegador nao pode ficar no antigo.
            res.set('Cache-Control', 'no-store');
            return res.redirect(302, url);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * POST /webhooks/eas — o EAS avisa aqui a cada mudanca de build (`eas webhook:create`).
     * Quando um build de preview termina, o link dele vira o de download daquela plataforma.
     */
    async webhookEas(req, res) {
        try {
            if (!LinksDownload.assinaturaValida(req.body, req.get('expo-signature'), process.env.EAS_WEBHOOK_SECRET)) {
                return res.status(401).json({ error: 'Assinatura inválida' });
            }
            let build;
            try {
                build = JSON.parse(req.body.toString('utf8'));
            } catch {
                return res.status(400).json({ error: 'JSON inválido' });
            }
            const link = LinksDownload.linkDoBuild(build);
            const config = link ? await prisma.config.findFirst({ select: { id: true, linksDownload: true } }) : null;
            const links = config ? LinksDownload.juntar(config.linksDownload, link) : null;
            if (!links) return res.json({ ok: true, guardado: false });

            await prisma.config.update({ where: { id: config.id }, data: { linksDownload: links } });
            console.log(`[download] ${link.plataforma} agora leva a ${link.url}`);
            return res.json({ ok: true, guardado: true });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /** GET /config/publica — sem login: so o nome da congregacao, para a tela de entrada. */
    async publica(req, res) {
        try {
            const config = await prisma.config.findFirst({ select: { subtitulo: true } });
            return res.json({ congregacao: (config && config.subtitulo) || '' });
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
            const campos = {};
            if (horaMeioSemana !== undefined) campos.horaMeioSemana = normalizarHora(horaMeioSemana);
            if (horaFimDeSemana !== undefined) campos.horaFimDeSemana = normalizarHora(horaFimDeSemana);
            if (Object.values(campos).some(v => v === null)) {
                return res.status(400).json({ error: 'Horário deve estar no formato HH:MM' });
            }
            if (req.body.zoom !== undefined) {
                const zoom = sanearZoom(req.body.zoom);
                if (zoom === undefined) return res.status(400).json({ error: 'Dados do Zoom inválidos' });
                // Json nulo no Prisma e Prisma.DbNull; `null` cru e recusado.
                campos.zoom = zoom === null ? Prisma.DbNull : zoom;
            }

            if (!config) {
                await prisma.config.create({
                    data: { titulo, subtitulo, mes, ...campos }
                });
            } else {
                await prisma.config.update({
                    where: { id: config.id },
                    data: { titulo, subtitulo, mes, ...campos }
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
