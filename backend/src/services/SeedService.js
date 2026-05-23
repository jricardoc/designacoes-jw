const prisma = require('../prisma');
const bcrypt = require('bcrypt');

const MESES = ['', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

class SeedService {
    async execute() {
        try {
            console.log('Checking seed...');

            // 1. Usuario Admin Seed
            const usuarioCount = await prisma.usuario.count();
            let adminUser;
            if (usuarioCount === 0) {
                console.log('Seeding Usuario admin...');
                const senhaHash = await bcrypt.hash('jw1010', 10);
                adminUser = await prisma.usuario.create({
                    data: {
                        nickname: 'admin',
                        senha: senhaHash,
                        nome: 'Administrador',
                        isAdmin: true
                    }
                });
                console.log('Admin criado: nickname=admin, senha=jw1010');
            } else {
                adminUser = await prisma.usuario.findFirst();
            }

            // 2. Config Seed
            const configCount = await prisma.config.count();
            if (configCount === 0) {
                console.log('Seeding Config...');
                await prisma.config.create({
                    data: {
                        titulo: 'Quadro de Designações',
                        subtitulo: 'Congregação Norte de Itapuã',
                        mes: 'JAN'
                    }
                });
            }

            // 3. Irmãos Seed
            const irmaoCount = await prisma.irmao.count();
            if (irmaoCount === 0) {
                console.log('Seeding Irmãos...');
                const irmaos = [
                    { nome: "Benjamin", funcoes: ["microfone"] },
                    { nome: "Claudio", funcoes: ["microfone"] },
                    { nome: "Miguel", funcoes: ["microfone", "indicador"] },
                    { nome: "Ivo", funcoes: ["microfone"] },
                    { nome: "Kauã", funcoes: ["microfone"] },
                    { nome: "Cristian", funcoes: ["microfone", "indicador"] },
                    { nome: "Domingos Neto", funcoes: ["microfone", "indicador"] },
                    { nome: "Leonardo", funcoes: ["microfone"] },
                    { nome: "Jessé", funcoes: ["microfone"] },
                    { nome: "Lázaro", funcoes: ["microfone"] },
                    { nome: "Manoel", funcoes: ["microfone"] },
                    { nome: "André Marques", funcoes: ["microfone", "indicador"] },
                    { nome: "Reginaldo", funcoes: ["microfone", "indicador"] },
                    { nome: "Cosmírio", funcoes: ["microfone", "indicador"] },
                    { nome: "Pedro", funcoes: ["microfone"] },
                    { nome: "Nicholas", funcoes: ["microfone"] },
                    { nome: "Edgar", funcoes: ["indicador"] },
                    { nome: "Jucimar", funcoes: ["indicador"] },
                    { nome: "Rudá", funcoes: ["indicador"] },
                    { nome: "Aloísio", funcoes: ["indicador"] },
                    { nome: "Francisco", funcoes: ["indicador"] },
                    { nome: "José Santos", funcoes: ["indicador"] },
                    // Audio/Video - Experientes
                    { nome: "Henzel", funcoes: ["indicador", "audioVideo"], nivelAudioVideo: "experiente" },
                    { nome: "Ricardo", funcoes: ["audioVideo", "indicador"], nivelAudioVideo: "experiente" },
                    { nome: "Harison", funcoes: ["audioVideo"], nivelAudioVideo: "experiente" },
                    { nome: "Cristiandley", funcoes: ["audioVideo"], nivelAudioVideo: "experiente" },
                    // Audio/Video - Treinando
                    { nome: "Matheus Lino", funcoes: ["indicador", "audioVideo"], nivelAudioVideo: "treinando" },
                    { nome: "Erick Matheus", funcoes: ["audioVideo"], nivelAudioVideo: "treinando" },
                    { nome: "Everton", funcoes: ["audioVideo"], nivelAudioVideo: "treinando" },
                    { nome: "João Felipe", funcoes: ["microfone", "audioVideo"], nivelAudioVideo: "treinando" }
                ];

                await prisma.irmao.createMany({ data: irmaos });

                // 4. Indisponibilidades de Janeiro 2026
                console.log('Seeding Indisponibilidades Janeiro 2026...');
                const irmaosDB = await prisma.irmao.findMany();
                const getIrmaoId = (nome) => irmaosDB.find(i => i.nome === nome)?.id;

                const indisponibilidades = [
                    // Dia 04/01
                    { irmaoId: getIrmaoId("Matheus Lino"), data: "04/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Miguel"), data: "04/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Jucimar"), data: "04/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Ricardo"), data: "04/01", motivo: "Outra designação" },

                    // Dia 08/01
                    { irmaoId: getIrmaoId("Henzel"), data: "08/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Claudio"), data: "08/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Ivo"), data: "08/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("João Felipe"), data: "08/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Rudá"), data: "08/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Erick Matheus"), data: "08/01", motivo: "Outra designação" },

                    // Dia 11/01
                    { irmaoId: getIrmaoId("Harison"), data: "11/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Rudá"), data: "11/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Everton"), data: "11/01", motivo: "Outra designação" },

                    // Dia 15/01
                    { irmaoId: getIrmaoId("Henzel"), data: "15/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Jessé"), data: "15/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Manoel"), data: "15/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Reginaldo"), data: "15/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Ricardo"), data: "15/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Cristiandley"), data: "15/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Miguel"), data: "15/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Domingos Neto"), data: "15/01", motivo: "Outra designação" },

                    // Dia 18/01
                    { irmaoId: getIrmaoId("Jessé"), data: "18/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Harison"), data: "18/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("Henzel"), data: "18/01", motivo: "Outra designação" },

                    // Dia 25/01
                    { irmaoId: getIrmaoId("Ricardo"), data: "25/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("João Felipe"), data: "25/01", motivo: "Outra designação" },
                    { irmaoId: getIrmaoId("José Santos"), data: "25/01", motivo: "Outra designação" }
                ].filter(i => i.irmaoId);

                if (indisponibilidades.length > 0) {
                    await prisma.indisponibilidade.createMany({
                        data: indisponibilidades
                    });
                    console.log(`Criadas ${indisponibilidades.length} indisponibilidades`);
                }
            }

            // 5. Saídas de Campo e Dirigentes (Seed)
            const saidaCount = await prisma.saidaCampo.count();
            if (saidaCount === 0) {
                console.log('Seeding Saídas de Campo...');
                const saidasData = [
                    { diaSemana: 'segunda', turno: 1, local: 'Ex-Combatentes - Casa dos irmãos Walney e Olga', horario: '08:45', dirigentes: ['Walney', 'Harison', 'Kaique', 'Ricardo', 'André', 'Miguel'] },
                    { diaSemana: 'terca', turno: 1, local: 'Tokaia - Casa do Irmão Edilson', horario: '08:45', dirigentes: ['José', 'Ricardo', 'Aloísio', 'Edgar'] },
                    { diaSemana: 'quarta', turno: 1, local: 'Ex-Combatentes - Casa da irmã Fátima Lopes', horario: '08:45', dirigentes: ['Manoel', 'José', 'Edgar', 'Neto', 'André'] },
                    { diaSemana: 'quinta', turno: 1, local: 'KM 17 - Casa da irmã Jucélia', horario: '08:45', dirigentes: ['Edgar', 'Breno', 'José', 'Cosmírio', 'Kaique'] },
                    { diaSemana: 'sexta', turno: 1, local: 'Tokaia - Casa do Irmão Edilson', horario: '08:45', dirigentes: ['José', 'Edgar', 'Aloísio', 'Breno'] },
                    { diaSemana: 'sabado', turno: 1, local: 'Ex-Combatentes - Casa dos irmãos Walney e Olga', horario: '08:45', dirigentes: ['Matheus Lino', 'Kaique', 'Elesbão', 'André', 'Cristian', 'Cristiandley'] },
                    { diaSemana: 'sabado', turno: 2, local: 'KM 17 - Casa da irmã Jucélia', horario: '16:00', dirigentes: ['João', 'Matheus Lino', 'Kaique', 'Elvandy', 'Cosmírio', 'Cristiandley'] },
                    { diaSemana: 'sabado', turno: 3, local: 'Tokaia - Casa do Irmão Edilson', horario: '08:45', dirigentes: ['José', 'Edgar', 'Aloísio', 'Ricardo'] },
                    { diaSemana: 'sabado', turno: 4, local: 'Tokaia - Casa do Irmão Edilson', horario: '16:00', dirigentes: ['Marcelo', 'Ricardo', 'Everton', 'Manoel', 'Miguel', 'Aloísio'] },
                ];

                for (const s of saidasData) {
                    const novaSaida = await prisma.saidaCampo.create({
                        data: {
                            diaSemana: s.diaSemana,
                            turno: s.turno,
                            local: s.local,
                            horario: s.horario,
                            ativo: true
                        }
                    });

                    // Garantir que os irmãos existam e associar
                    for (const nomeIrmao of s.dirigentes) {
                        let irmaoObj = await prisma.irmao.findUnique({ where: { nome: nomeIrmao } });
                        if (!irmaoObj) {
                            irmaoObj = await prisma.irmao.create({
                                data: {
                                    nome: nomeIrmao,
                                    funcoes: ['dirigente']
                                }
                            });
                        } else {
                            if (!irmaoObj.funcoes.includes('dirigente')) {
                                await prisma.irmao.update({
                                    where: { id: irmaoObj.id },
                                    data: { funcoes: [...irmaoObj.funcoes, 'dirigente'] }
                                });
                            }
                        }

                        // Criar associação
                        await prisma.dirigenteSaidaCampo.create({
                            data: {
                                irmaoId: irmaoObj.id,
                                saidaCampoId: novaSaida.id
                            }
                        });
                    }
                }
                console.log('Saídas de Campo e Dirigentes configurados com sucesso.');
            }

            console.log('Seed verified.');
        } catch (error) {
            console.error('Seed failed:', error);
        }
    }
}

module.exports = new SeedService();
