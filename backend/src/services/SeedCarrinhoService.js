'use strict';

const prisma = require('../prisma');

/**
 * Carga inicial do carrinho, transcrita das quatro planilhas da congregacao
 * (pasta /carrinho na raiz do repositorio).
 *
 * Roda uma vez: se ja houver qualquer ponto cadastrado, nao faz nada. A partir
 * dai a manutencao e toda pela tela, entao este arquivo nao volta a interferir
 * — inclusive se o usuario apagar um turno de proposito.
 *
 * Os turnos sao FIXOS e semanais. `diaSemana` segue Date.getDay(): 0 = domingo.
 */

const DOM = 0, SEG = 1, TER = 2, QUA = 3, QUI = 4, SEX = 5, SAB = 6;

const PONTOS = [
    {
        nome: 'Ex Combatentes',
        cor: '#D9822B',
        ordem: 1,
        turnos: [
            { dia: TER, de: '06:00', ate: '08:00', quem: ['Olga', 'Walney'] },
            { dia: QUA, de: '06:00', ate: '08:00', quem: ['Daiana', 'Raquel'] },
            { dia: QUI, de: '06:00', ate: '08:00', quem: ['Olga', 'Edilza'] },
            { dia: SEX, de: '06:00', ate: '08:00', quem: ['Olga', 'Helena Soares', 'Ana Ella'] },
            { dia: SAB, de: '06:00', ate: '08:00', quem: ['Daiana', 'Driele'] },

            { dia: TER, de: '08:00', ate: '10:00', quem: ['Fátima Lopes', 'Jucélia'] },
            { dia: QUI, de: '08:00', ate: '10:00', quem: ['Olga', 'Edilza'] },
            { dia: SEX, de: '08:00', ate: '10:00', quem: ['Olga', 'Helena Soares', 'Ana Ella'] },

            { dia: TER, de: '10:00', ate: '12:00', quem: ['Fátima Lopes', 'Jucélia'] },

            { dia: TER, de: '14:00', ate: '16:00', quem: ['Daiana', 'Driele', 'Raquel'] },
            { dia: QUI, de: '14:00', ate: '16:00', quem: ['Ana', 'Marinalva', 'Raquel'] },

            { dia: TER, de: '16:00', ate: '18:00', quem: ['Matilde', 'Márcia'] },
            { dia: QUI, de: '16:00', ate: '18:00', quem: ['Tânia Assad', 'Magna'] },
        ],
    },
    {
        nome: 'KM 17',
        cor: '#8064A2',
        ordem: 2,
        turnos: [
            { dia: TER, de: '14:00', ate: '16:00', quem: ['Marinalva', 'Ana'] },
        ],
    },
    {
        nome: 'Mussurunga - Edilson',
        cor: '#C0504D',
        ordem: 3,
        turnos: [
            { dia: SAB, de: '06:00', ate: '08:00', quem: ['Helena Rodrigues', 'Edileuza', 'Joana'] },
            { dia: QUA, de: '08:00', ate: '10:00', quem: ['Iasmin', 'Laura Leonídia'] },
            { dia: SEG, de: '16:00', ate: '18:00', quem: ['Mônica', 'Laura Leonídia', 'Celeste'] },
            { dia: SEX, de: '16:00', ate: '18:00', quem: ['Lourrany', 'Marisol'] },
            { dia: SEX, de: '18:00', ate: '20:00', quem: ['Lourrany', 'Marisol'] },
        ],
    },
    {
        nome: 'Mussurunga - Miguel',
        cor: '#77933C',
        ordem: 4,
        turnos: [
            { dia: DOM, de: '06:00', ate: '08:00', quem: ['Alexandra', 'Edileuza'] },
            { dia: SEG, de: '06:00', ate: '08:00', quem: ['Alexandra', 'Valdirene'] },
            { dia: TER, de: '06:00', ate: '08:00', quem: ['Alexandra', 'Valdirene'] },
            { dia: QUI, de: '06:00', ate: '08:00', quem: ['Alexandra', 'Valdirene'] },
            { dia: SEX, de: '06:00', ate: '08:00', quem: ['Alexandra', 'Valdirene'] },
            { dia: SAB, de: '06:00', ate: '08:00', quem: ['Joana', 'Edileuza'] },

            { dia: SEG, de: '14:00', ate: '16:00', quem: ['Alexandra', 'Cidinalva'] },
            { dia: TER, de: '14:00', ate: '16:00', quem: ['Alexandra', 'Maria José', 'Sidnalva'] },

            { dia: TER, de: '16:00', ate: '18:00', quem: ['Joana', 'Zenaildes', 'Ana Portela'] },
            { dia: QUI, de: '16:00', ate: '18:00', quem: ['Tânia', 'Ana'] },

            { dia: SEG, de: '20:00', ate: '21:00', quem: ['Alexandra', 'Edileuza', 'Joana'] },
            { dia: QUA, de: '20:00', ate: '21:00', quem: ['Alexandra', 'Edileuza', 'Joana'] },
            { dia: SEX, de: '20:00', ate: '21:00', quem: ['Alexandra', 'Edileuza', 'Joana'] },
        ],
    },
];

async function execute() {
    try {
        const jaTem = await prisma.carrinhoPonto.count();
        if (jaTem > 0) return;

        console.log('Seeding Carrinho...');

        // Uma pessoa aparece em varios pontos e turnos; o cadastro e unico por nome.
        const nomes = [...new Set(PONTOS.flatMap(p => p.turnos.flatMap(t => t.quem)))].sort();
        await prisma.carrinhoPublicador.createMany({
            data: nomes.map(nome => ({ nome })),
            skipDuplicates: true,
        });

        const publicadores = await prisma.carrinhoPublicador.findMany({
            select: { id: true, nome: true },
        });
        const idPorNome = new Map(publicadores.map(p => [p.nome, p.id]));

        for (const ponto of PONTOS) {
            const criado = await prisma.carrinhoPonto.create({
                data: { nome: ponto.nome, cor: ponto.cor, ordem: ponto.ordem },
            });

            for (const turno of ponto.turnos) {
                await prisma.carrinhoTurno.create({
                    data: {
                        pontoId: criado.id,
                        diaSemana: turno.dia,
                        horaInicio: turno.de,
                        horaFim: turno.ate,
                        escalas: {
                            create: turno.quem
                                .map(nome => idPorNome.get(nome))
                                .filter(Boolean)
                                .map(publicadorId => ({ publicadorId })),
                        },
                    },
                });
            }
        }

        const totalTurnos = PONTOS.reduce((soma, p) => soma + p.turnos.length, 0);
        console.log(
            `Carrinho: ${PONTOS.length} pontos, ${totalTurnos} turnos e ${nomes.length} publicadores cadastrados.`
        );
    } catch (error) {
        console.error('Seed do carrinho falhou:', error);
    }
}

module.exports = { execute, PONTOS };
