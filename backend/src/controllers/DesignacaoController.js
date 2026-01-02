const prisma = require('../prisma');

class DesignacaoController {
    async index(req, res) {
        try {
            const designacoes = await prisma.designacao.findMany({
                orderBy: { id: 'asc' } // Mantendo ordem de inserção original basicamente
            });

            // Seeding inicial se vazio
            if (designacoes.length === 0) {
                const dadosIniciais = [
                    { data: "04/01", dia: "Domingo", funcao: "Microfone Volante", irmao1: "Benjamin", irmao2: "Claudio" },
                    { data: "04/01", dia: "Domingo", funcao: "Indicador", irmao1: "Edgar", irmao2: "Rudá" },
                    { data: "04/01", dia: "Domingo", funcao: "Áudio e Vídeo", irmao1: "Ricardo", irmao2: "João Felipe" },

                    { data: "08/01", dia: "Quinta", funcao: "Microfone Volante", irmao1: "Miguel", irmao2: "Kauã" },
                    { data: "08/01", dia: "Quinta", funcao: "Indicador", irmao1: "Aloisio", irmao2: "José Santos" },
                    { data: "08/01", dia: "Quinta", funcao: "Áudio e Vídeo", irmao1: "Everton", irmao2: "Matheus Lino" },

                    { data: "11/01", dia: "Domingo", funcao: "Microfone Volante", irmao1: "Domingos Neto", irmao2: "Leonardo" },
                    { data: "11/01", dia: "Domingo", funcao: "Indicador", irmao1: "Jucimar", irmao2: "José Santos" },
                    { data: "11/01", dia: "Domingo", funcao: "Áudio e Vídeo", irmao1: "Henzel", irmao2: "Erick Matheus" },

                    { data: "15/01", dia: "Quinta", funcao: "Microfone Volante", irmao1: "Ivo", irmao2: "Kauã" },
                    { data: "15/01", dia: "Quinta", funcao: "Indicador", irmao1: "Francisco", irmao2: "Cristian" },
                    { data: "15/01", dia: "Quinta", funcao: "Áudio e Vídeo", irmao1: "Everton", irmao2: "João Felipe" },

                    { data: "18/01", dia: "Domingo", funcao: "Microfone Volante", irmao1: "Lázaro", irmao2: "Nicholas" },
                    { data: "18/01", dia: "Domingo", funcao: "Indicador", irmao1: "Jucimar", irmao2: "Matheus Lino" },
                    { data: "18/01", dia: "Domingo", funcao: "Áudio e Vídeo", irmao1: "Cristiandley", irmao2: "Erick Matheus" },

                    { data: "22/01", dia: "Quinta", funcao: "Microfone Volante", irmao1: "Manoel", irmao2: "André Marques" },
                    { data: "22/01", dia: "Quinta", funcao: "Indicador", irmao1: "Miguel", irmao2: "Domingos Neto" },
                    { data: "22/01", dia: "Quinta", funcao: "Áudio e Vídeo", irmao1: "Everton", irmao2: "João Felipe" },

                    { data: "25/01", dia: "Domingo", funcao: "Microfone Volante", irmao1: "Reginaldo", irmao2: "Manoel" },
                    { data: "25/01", dia: "Domingo", funcao: "Indicador", irmao1: "Aloisio", irmao2: "Henzel" },
                    { data: "25/01", dia: "Domingo", funcao: "Áudio e Vídeo", irmao1: "Harisson", irmao2: "Matheus Lino" },

                    { data: "29/01", dia: "Quinta", funcao: "Microfone Volante", irmao1: "Cosmírio", irmao2: "Pedro" },
                    { data: "29/01", dia: "Quinta", funcao: "Indicador", irmao1: "Rudá", irmao2: "Francisco" },
                    { data: "29/01", dia: "Quinta", funcao: "Áudio e Vídeo", irmao1: "Matheus Lino", irmao2: "João Felipe" }
                ];

                // Bulk insert
                await prisma.designacao.createMany({
                    data: dadosIniciais
                });

                return res.json(await prisma.designacao.findMany({ orderBy: { id: 'asc' } }));
            }

            return res.json(designacoes);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async update(req, res) {
        // Atualiza um objeto completo pelo ID (usado se tiver frontend enviando objeto inteiro)
        // Mas nossa API antiga usava endpoints específicos. Vamos manter compatibilidade ou melhorar.
        // Vou implementar os métodos específicos para manter compatibilidade com o frontend atual.
        return res.status(405).json({ error: 'Method not implemented, use specific routes' });
    }

    async updateIrmao(req, res) {
        try {
            const { data, funcao, campo, valor } = req.body;

            // Encontrar a designação correspondente
            const designacao = await prisma.designacao.findFirst({
                where: { data, funcao }
            });

            if (!designacao) {
                return res.status(404).json({ error: 'Designacao not found' });
            }

            await prisma.designacao.update({
                where: { id: designacao.id },
                data: { [campo]: valor } // irmao1 ou irmao2
            });

            return res.json({ success: true });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async updateData(req, res) {
        try {
            const { dataAntiga } = req.params;
            const { novaData } = req.body;

            await prisma.designacao.updateMany({
                where: { data: dataAntiga },
                data: { data: novaData }
            });

            return res.json({ success: true });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async updateDia(req, res) {
        try {
            const { data } = req.params;
            const { dia } = req.body;

            await prisma.designacao.updateMany({
                where: { data },
                data: { dia }
            });

            return res.json({ success: true });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async reset(req, res) {
        try {
            // Limpar tudo
            await prisma.designacao.deleteMany();
            await prisma.config.deleteMany();

            // O seed ocorrerá na próxima chamada de GET

            return res.json({ success: true });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = new DesignacaoController();
