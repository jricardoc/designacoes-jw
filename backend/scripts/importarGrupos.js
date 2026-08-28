/**
 * Abastece o sistema com a lista "Listas de Grupos - Norte de Itapua".
 *
 *   npm run importar:grupos -- --simular   (nao grava nada; mostra o que faria)
 *   npm run importar:grupos                (grava)
 *
 * PRECISA DE BANCO. E idempotente: rodar de novo nao duplica ninguem nem desfaz ajuste feito
 * a mao depois.
 *
 * O QUE ELE FAZ
 * -------------
 *  1. Garante os cinco grupos (pelo nome de quem dirige).
 *  2. Para cada pessoa da lista: acha quem ja esta cadastrado e, se nao achar, CRIA — so com
 *     nome e tratamento. Sem funcao, sem privilegio, sem telefone, como pedido.
 *  3. Poe todo mundo no grupo certo.
 *  4. Marca o dirigente e o ajudante de cada grupo.
 *
 * O TRATAMENTO (irmao/irma) esta escrito na tabela abaixo, nome por nome, e nao adivinhado
 * por regra de terminacao. Regra erraria em "Walney" (irmao) e em nomes raros como "Elvandy"
 * e "Henzel"; e o preco de errar aqui e o sistema tratar um irmao por "irma" numa mensagem
 * enviada a ele. A classificacao foi conferida por leitura independente dos 128 nomes, sem
 * divergencia.
 *
 * O CASAMENTO COM QUEM JA EXISTE e conservador de proposito. As duas listas escrevem os nomes
 * de formas diferentes ("Walney Oliveira" x "Walney Oliveira e Souza"; "Maria Eduarda dos S.
 * Gomes de Araujo" x "Maria Eduarda dos S. G. de Araujo"), entao ha tres criterios, do mais
 * seguro para o menos:
 *
 *   1. nome igual (sem acento e sem caixa);
 *   2. um nome CONTEM todos os nomes do outro;
 *   3. primeiro E ultimo nome iguais.
 *
 * O que nao cair em nenhum e tratado como pessoa NOVA. Errar criando um registro a mais e
 * visivel e tem conserto (`npm run pessoas:duplicados`); errar fundindo duas pessoas
 * diferentes mistura telefone e designacao de gente que nao tem nada a ver. Quando a pessoa e
 * criada mas ha alguem no cadastro com o mesmo primeiro nome, o script AVISA — e ali que mora
 * a duplicata que escapou.
 */
const prisma = require('../src/prisma');

const simular = process.argv.includes('--simular');

// --------------------------------------------------------------------------
// A lista, como esta no documento. `d` = dirigente, `a` = ajudante.
// --------------------------------------------------------------------------
const GRUPOS = [
    {
        grupo: 'Edilson Santos',
        dirigente: ['Edilson Santos', 'irmao'],
        ajudante: ['José dos Santos Cruz', 'irmao'],
        membros: [
            ['Ana Cristina Bastos Batista', 'irma'],
            ['Breno Costa Santos', 'irmao'],
            ['Edilza C. de Oliveira', 'irma'],
            ['Edleuza G. Souza', 'irma'],
            ['Edson Alberto de S. S. Junior', 'irmao'],
            ['Emanuelle Costa de Oliveira', 'irma'],
            ['Érick Matheus B. Santos', 'irmao'],
            ['Fabiana Alvim De M. Moura', 'irma'],
            ['Harison Mendes de P. Araújo', 'irmao'],
            ['Iasmin S. Mendes Santana', 'irma'],
            ['Ismaelina S. Cafezeiro', 'irma'],
            ['Joana Batista A. d. Santos', 'irma'],
            ['Laura Bispo D. Santos', 'irma'],
            ['Laura Julia G. Araujo', 'irma'],
            ['Maria Amélia Francisca', 'irma'],
            ['Maria Cristiane S. de Souza', 'irma'],
            ['Maria Dias Oliveira', 'irma'],
            ['Marisol Santos', 'irma'],
            ['Talita Iasmin B. d. Santos', 'irma'],
            ['Tânia Maria A. de Mello', 'irma'],
            ['Terezinha de Jesus Andrade', 'irma'],
            ['Valdirene R. S. Miranda', 'irma'],
            ['Vera Lucia L. Pinto', 'irma'],
        ],
    },
    {
        grupo: 'Átilas Santos',
        dirigente: ['Átilas Santos', 'irmao'],
        ajudante: ['Henzel Almeida', 'irmao'],
        membros: [
            ['Aloísio Rodrigues', 'irmao'],
            ['Ana Lúcia P. S. Rodrigues', 'irma'],
            ['Antônia S. Santos', 'irma'],
            ['Drielle G. L. d. Silva', 'irma'],
            ['Edgar B. d. Santos', 'irmao'],
            ['Ivo Ribeiro dos Santos', 'irmao'],
            ['Laudelina S. Souza', 'irma'],
            ['Laura Leonídia Gomes', 'irma'],
            ['Lindinalva S. Souza', 'irma'],
            ['Lourrany Alves dos Santos', 'irma'],
            ['Manoel Alves da Silva Neto', 'irmao'],
            ['Marcia Vieira Santos', 'irma'],
            ['Maria Celeste G. Oliveira', 'irma'],
            ['Maria de Fatima G. d. Silva', 'irma'],
            ['Maria de Lourdes S. Souza', 'irma'],
            ['Maria de Lurdes S. Piton', 'irma'],
            ['Maria Helena R. Araujo', 'irma'],
            ['Maria Idália A. P. Moura', 'irma'],
            ['Maria Ivone A. Nani', 'irma'],
            ['Mônica Cely de O. Dias Lima', 'irma'],
            ['Olga P. Souza', 'irma'],
            ['Walney Oliveira e Souza', 'irmao'],
        ],
    },
    {
        grupo: 'Marcelo Santana',
        dirigente: ['Marcelo Santana', 'irmao'],
        ajudante: ['Miguel A. de Jesus', 'irmao'],
        membros: [
            ['Alexandra Gonçalves Alves', 'irma'],
            ['Benjamin Gomes Santana', 'irmao'],
            ['Catia Pereira de Souza', 'irma'],
            ['Cidinalva Da Silva', 'irma'],
            ['Cláudio da Silva Oliveira', 'irmao'],
            ['Cleibia de Souza O. Amorim', 'irma'],
            ['Domingos C. R. Neto', 'irmao'],
            ['Everton A. Oliveira Reis', 'irmao'],
            ['Francisco Luis D. Santos', 'irmao'],
            ['Iolanda Maria B. d. Santos', 'irma'],
            ['Iraci Alves D. S. Jesus', 'irma'],
            ['Ivanildes Pereira de Souza', 'irma'],
            ['José Ricardo C. da Silva', 'irmao'],
            ['Jucimar Carvalho Fonseca', 'irmao'],
            ['Leonardo d. S. Alves', 'irmao'],
            ['Lidiane Neiva S. Carvalho', 'irma'],
            ['Maria Angélica T. Gomes', 'irma'],
            ['Maria de Fatima P. Lopez', 'irma'],
            ['Maria Helena G. S. Santana', 'irma'],
            ['Maria Helena S. Santos', 'irma'],
            ['Maria José S. Valadares', 'irma'],
            ['Maria Vicência V. Santana', 'irma'],
            ['Zenaildes P. Gonçalves', 'irma'],
        ],
    },
    {
        grupo: 'Elvandyr Lima',
        dirigente: ['Elvandy F. Lima', 'irmao'],
        ajudante: ['Jessé F. Gonçalves', 'irmao'],
        membros: [
            ['André Marques S. d. Conceição', 'irmao'],
            ['Antônio C Elesbão', 'irmao'],
            ['Cathia Regina S. Santos', 'irma'],
            ['Cosmirio Carvalho', 'irmao'],
            ['Daiana D. S. Marques Soares', 'irma'],
            ['Denise L. Santos', 'irma'],
            ['Dinalva S. d. S. Santana', 'irma'],
            ['Doralice C. Cardoso', 'irma'],
            ['Eleticia M. S. Gonçalves', 'irma'],
            ['Francisca Liduina da Silva', 'irma'],
            ['João Felipe C. Lima', 'irmao'],
            ['Josefa L. Santos', 'irma'],
            ['Juliana S. Trancoso', 'irma'],
            ['Kaique K. B. Elesbão', 'irmao'],
            ['Kauã Kevin Elesbão', 'irmao'],
            ['Magna S. Correia', 'irma'],
            ['Margarete S. Correia', 'irma'],
            ['Maria Angelica C. Lima', 'irma'],
            ['Maria Isaura dos Santos', 'irma'],
            ['Nicholas S. dos Santos', 'irmao'],
            ['Paulo Rosário Souza', 'irmao'],
            ['Raimundo Reginaldo', 'irmao'],
            ['Raquel Pereira dos Santos', 'irma'],
            ['Sandra L. B. Elesbão', 'irma'],
            ['Valdete C. Santos', 'irma'],
        ],
    },
    {
        grupo: 'Luiz Roberto',
        dirigente: ['Luis R. L. Sampaio', 'irmao'],
        ajudante: ['Matheus L. Santos', 'irmao'],
        membros: [
            ['Adriana S. de Abreu', 'irma'],
            ['Ana Ella C. Ferreira', 'irma'],
            ['Anderson Lacroix P. de Abreu', 'irmao'],
            ['Cleuza R. dos Santos', 'irma'],
            ['Emily A. de Oliveira', 'irma'],
            ['Ester Gomes S. Sales', 'irma'],
            ['Fatima Tereza Silva', 'irma'],
            ['Gislaine S. O. de Araújo', 'irma'],
            ['Givaldo J. Santana', 'irmao'],
            ['Guilherme A. R. Tavares', 'irmao'],
            ['Irlene Rocha dos Santos', 'irma'],
            ['Izabel Cristina P. C. de Oliveira', 'irma'],
            ['Jucélia D. S. G. Pinto', 'irma'],
            ['Lázaro Gabriel Spinola Sales', 'irmao'],
            ['Magali de F. O. Sampaio', 'irma'],
            ['Marcia Nunes de Jesus', 'irma'],
            ['Maria Dalva R. Bitencourt', 'irma'],
            ['Maria de Fátima Marques', 'irma'],
            ['Maria Eduarda dos S. G. de Araújo', 'irma'],
            ['Maria Perpétua P. Do Carmo', 'irma'],
            ['Matilde da Anunciação Nunes', 'irma'],
            ['Sérgio A. Tavares', 'irmao'],
            ['Teresinha de Jesus D. C. e. Silva', 'irma'],
            ['Tifany S. Santana', 'irma'],
            ['Vanize R. d. H. Santana', 'irma'],
        ],
    },
];

// --------------------------------------------------------------------------
// Casamento de nomes
// --------------------------------------------------------------------------

const semAcento = (t) =>
    String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const chaveNome = (nome) => semAcento(nome).replace(/\s+/g, ' ').trim();

/**
 * Nomes "de verdade": inicial solta ("S.", "d.") e conectivo ("de", "da", "e") saem. Sao o
 * que mais varia entre as duas listas e nao ajudam a identificar ninguem.
 */
const CONECTIVOS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
function pedacos(nome) {
    return chaveNome(nome)
        .split(/\s+/)
        .map((p) => p.replace(/\.$/, ''))
        .filter((p) => p.length > 1 && !CONECTIVOS.has(p));
}

/**
 * Acha a pessoa no cadastro. Devolve { pessoa, criterio } ou null.
 *
 * Tres criterios, do mais seguro para o menos. Nenhum deles aceita empate: se dois cadastros
 * casam, ninguem e escolhido — dois "Maria Santos" diferentes nao podem virar um so por
 * causa de um script.
 */
function acharPessoa(nome, cadastro) {
    const alvo = pedacos(nome);
    if (alvo.length === 0) return null;

    const exato = cadastro.filter((c) => c.chave === chaveNome(nome));
    if (exato.length === 1) return { pessoa: exato[0], criterio: 'nome igual' };

    const contem = cadastro.filter(
        (c) =>
            (alvo.every((p) => c.pedacos.includes(p)) && alvo.length > 0) ||
            (c.pedacos.length > 0 && c.pedacos.every((p) => alvo.includes(p))),
    );
    if (contem.length === 1) return { pessoa: contem[0], criterio: 'um nome contem o outro' };

    const primeiroUltimo = cadastro.filter(
        (c) =>
            c.pedacos.length > 1 &&
            alvo.length > 1 &&
            c.pedacos[0] === alvo[0] &&
            c.pedacos[c.pedacos.length - 1] === alvo[alvo.length - 1],
    );
    if (primeiroUltimo.length === 1) {
        return { pessoa: primeiroUltimo[0], criterio: 'primeiro e ultimo nome' };
    }

    return null;
}

// --------------------------------------------------------------------------

async function main() {
    console.log(simular ? '=== SIMULACAO (nada e gravado) ===\n' : '=== IMPORTACAO DOS GRUPOS ===\n');

    const irmaos = await prisma.irmao.findMany({
        select: { id: true, nome: true, genero: true, grupoId: true },
    });
    const cadastro = irmaos.map((i) => ({
        ...i,
        chave: chaveNome(i.nome),
        pedacos: pedacos(i.nome),
    }));

    const totalLista = GRUPOS.reduce((s, g) => s + g.membros.length + 2, 0);
    console.log(`cadastrados hoje: ${cadastro.length}`);
    console.log(`pessoas na lista: ${totalLista}\n`);

    const avisos = [];
    let casados = 0;
    let criados = 0;
    let jaNoGrupo = 0;
    let movidos = 0;

    for (const bloco of GRUPOS) {
        // O grupo pode nao existir ainda (se `seed:grupos` nao rodou).
        let grupo = await prisma.grupoCampo.findFirst({
            where: { nome: bloco.grupo },
        });
        if (!grupo) {
            console.log(`GRUPO "${bloco.grupo}": nao existe, ${simular ? 'seria criado' : 'criando'}`);
            if (!simular) {
                grupo = await prisma.grupoCampo.create({
                    data: { nome: bloco.grupo, ordem: GRUPOS.indexOf(bloco) },
                });
            }
        }
        console.log(`\n--- ${bloco.grupo} ---`);

        const todos = [
            { nome: bloco.dirigente[0], genero: bloco.dirigente[1], papel: 'dirigente' },
            { nome: bloco.ajudante[0], genero: bloco.ajudante[1], papel: 'ajudante' },
            ...bloco.membros.map(([nome, genero]) => ({ nome, genero, papel: null })),
        ];

        const papeis = {};

        for (const item of todos) {
            // O dirigente tem uma segunda chance pelo NOME DO GRUPO. As duas fontes o
            // escrevem diferente — o documento traz "Luis R. L. Sampaio" e o cadastro
            // "Luiz Roberto" (luis x luiz: nem o primeiro nome bate). Como o grupo e batizado
            // com o nome de quem o dirige, o nome do grupo e a grafia que o cadastro usa.
            const achado =
                acharPessoa(item.nome, cadastro) ||
                (item.papel === 'dirigente' ? acharPessoa(bloco.grupo, cadastro) : null);
            let pessoa;

            if (achado) {
                casados += 1;
                pessoa = achado.pessoa;
                if (achado.criterio !== 'nome igual') {
                    console.log(`   = "${item.nome}" -> "${pessoa.nome}" (${achado.criterio})`);
                }
            } else {
                // Alguem com o mesmo primeiro nome ja cadastrado? E onde a duplicata escapa.
                const mesmoPrimeiro = cadastro.filter(
                    (c) => c.pedacos[0] && c.pedacos[0] === pedacos(item.nome)[0],
                );
                if (mesmoPrimeiro.length > 0) {
                    avisos.push(
                        `"${item.nome}" sera criado, mas ja existe: ${mesmoPrimeiro.map((c) => `"${c.nome}"`).join(', ')}`,
                    );
                }

                criados += 1;
                console.log(`   + "${item.nome}" (${item.genero})`);
                if (simular) {
                    pessoa = { id: null, nome: item.nome, genero: item.genero, grupoId: null };
                } else {
                    pessoa = await prisma.irmao.create({
                        data: { nome: item.nome, funcoes: [], genero: item.genero },
                        select: { id: true, nome: true, genero: true, grupoId: true },
                    });
                    cadastro.push({ ...pessoa, chave: chaveNome(pessoa.nome), pedacos: pedacos(pessoa.nome) });
                }
            }

            if (item.papel) papeis[item.papel] = pessoa;

            // Grupo: so mexe quando muda. Quem ja esta no grupo certo nao e tocado.
            if (grupo && pessoa.id) {
                if (pessoa.grupoId === grupo.id) {
                    jaNoGrupo += 1;
                } else {
                    movidos += 1;
                    if (!simular) {
                        await prisma.irmao.update({
                            where: { id: pessoa.id },
                            data: { grupoId: grupo.id },
                        });
                    }
                    pessoa.grupoId = grupo.id;
                }
            }
        }

        if (grupo && !simular) {
            await prisma.grupoCampo.update({
                where: { id: grupo.id },
                data: {
                    dirigenteId: papeis.dirigente?.id ?? null,
                    ajudanteId: papeis.ajudante?.id ?? null,
                },
            });
        }
        console.log(`   dirigente: ${papeis.dirigente?.nome ?? '—'} | ajudante: ${papeis.ajudante?.nome ?? '—'}`);
    }

    console.log(`\n=== RESUMO ===`);
    console.log(`ja cadastrados (reaproveitados): ${casados}`);
    console.log(`criados: ${criados}`);
    console.log(`ja estavam no grupo certo: ${jaNoGrupo} | movidos de grupo: ${movidos}`);

    if (avisos.length > 0) {
        console.log(`\n=== CONFERIR (${avisos.length}) ===`);
        console.log('Nomes que serao criados tendo alguem parecido no cadastro. Se for a mesma');
        console.log('pessoa, junte depois com: npm run pessoas:duplicados');
        avisos.forEach((a) => console.log(`   ! ${a}`));
    }

    if (!simular) {
        const [total, semGrupo, semGenero] = await Promise.all([
            prisma.irmao.count(),
            prisma.irmao.count({ where: { grupoId: null } }),
            prisma.irmao.count({ where: { genero: null } }),
        ]);
        console.log(`\n=== CONFERENCIA ===`);
        console.log(`publicadores no total: ${total}`);
        console.log(`sem grupo:             ${semGrupo}`);
        console.log(`sem tratamento:        ${semGenero} ${semGenero === 0 ? '(ok)' : '(CONFERIR)'}`);
    }
}

main()
    .catch((e) => {
        console.error('\nFALHOU:', e.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
