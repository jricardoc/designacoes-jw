const { Prisma } = require('@prisma/client');
const prisma = require('../prisma');
const MyMaps = require('../services/MyMapsService');
const T = require('../services/TerritoriosService');
const { ESCOPOS, temEscopo, podeMarcarTerritorio } = require('../middleware/escopos');

/**
 * Territorios: lista, detalhe com mapa, saidas, marcacoes por GPS e a gestao (My Maps,
 * designacoes, avisos, ciclo, revisao, painel e S-13). As regras moram em
 * services/TerritoriosService.js; aqui fica o HTTP e a validacao do que chega do celular.
 *
 * Ver e livre para quem esta logado. Registrar e de quem `podeMarcarTerritorio`; gerir e do
 * escopo de territorios (ver routes.js).
 */

const gerencia = (user) => temEscopo(user, ESCOPOS.TERRITORIOS);
const permissoes = (user) => ({ marcar: podeMarcarTerritorio(user), gerenciar: gerencia(user) });

/** Texto aparado e cortado; vazio vira null. */
const texto = (valor, max) => {
    const t = String(valor ?? '').trim().slice(0, max);
    return t || null;
};

const coordenada = (valor, limite) => {
    const n = Number(valor);
    return valor !== null && valor !== undefined && valor !== '' && Number.isFinite(n) && Math.abs(n) <= limite ? n : null;
};

const ehDia = (valor) => /^\d{4}-\d{2}-\d{2}$/.test(String(valor || '')) && !Number.isNaN(Date.parse(valor));
const ehChave = (valor) => /^[A-Za-z0-9_-]{8,80}$/.test(String(valor || ''));

async function territorioAtivo(id) {
    const n = parseInt(id, 10);
    if (!Number.isInteger(n)) return null;
    return prisma.territorio.findFirst({ where: { id: n, ativo: true }, include: { quadras: { where: { ativo: true } } } });
}

// ponytail: guarda so o ultimo contorno calculado (~300 ms com 3 areas); refaz quando muda
// area ou quadra. Varias instancias da API = um calculo por instancia, o que tambem serve.
let contornoGuardado = { chave: '', aneis: [] };
function contornos(areas) {
    const chave = JSON.stringify(areas);
    if (chave !== contornoGuardado.chave) contornoGuardado = { chave, aneis: MyMaps.contornarAreas(areas) };
    return contornoGuardado.aneis;
}

/** Erro de chave unica do Prisma (o mesmo clientKey chegando duas vezes ao mesmo tempo). */
const duplicado = (erro) => erro && erro.code === 'P2002';

class TerritorioController {
    // ==================== LEITURA ====================

    /**
     * GET /territorios — o formato do app ate a versao 2.11: so os cartoes em imagem, numero
     * inteiro. O app novo le /territorios/lista; este fica para quem ainda nao instalou o build
     * novo continuar abrindo os cartoes (o APK novo chega a cada irmao no tempo dele).
     * ponytail: remover quando ninguem mais usar o app antigo.
     */
    async legado(req, res) {
        return res.json({
            territorios: [...T.cartoes()].map(([numero, c]) => ({
                numero: parseInt(numero, 10),
                localidade: c.localidade,
                imagens: c.imagens,
            })),
        });
    }

    async index(req, res) {
        try {
            const [doBanco, config] = await Promise.all([
                T.listar(),
                prisma.config.findFirst({ select: { coresAreas: true } }),
            ]);
            return res.json({
                fonte: doBanco.length > 0 ? 'banco' : 'cartoes',
                territorios: doBanco.length > 0 ? doBanco : T.listarSoCartoes(),
                cores: T.coresDasAreas(doBanco, config && config.coresAreas),
                permissoes: permissoes(req.user),
            });
        } catch (error) {
            console.error('Erro ao listar territórios:', error);
            return res.status(500).json({ error: 'Erro ao buscar territórios' });
        }
    }

    /**
     * Todos os poligonos, para o mapa geral colorido pela situacao, mais o contorno de cada area
     * (na cor dela) e o limite do territorio da congregacao, quando importado.
     */
    async mapa(req, res) {
        try {
            const [lista, quadras, config] = await Promise.all([
                T.listar(),
                prisma.quadra.findMany({
                    where: { ativo: true, territorio: { ativo: true } },
                    select: { territorioId: true, nome: true, pontos: true },
                }),
                prisma.config.findFirst({ select: { coresAreas: true, limiteTerritorio: true } }),
            ]);
            const territorios = lista.map(t => ({
                numero: t.numero,
                nome: t.nome,
                area: t.area || null,
                situacao: t.situacao,
                cor: t.cor,
                quadras: quadras.filter(q => q.territorioId === t.id).map(q => ({ nome: q.nome, pontos: q.pontos })),
            }));
            const cores = T.coresDasAreas(lista, config && config.coresAreas);
            const areas = contornos(Object.keys(cores).map(nome => ({
                nome,
                poligonos: territorios.filter(t => t.area === nome).flatMap(t => t.quadras.map(q => q.pontos)),
            })));
            return res.json({
                territorios,
                areas: areas.map(a => ({ ...a, cor: cores[a.nome] })),
                limite: (config && config.limiteTerritorio) || null,
            });
        } catch (error) {
            console.error('Erro ao montar o mapa dos territórios:', error);
            return res.status(500).json({ error: 'Erro ao buscar o mapa' });
        }
    }

    async show(req, res) {
        try {
            const detalhe = await T.detalhe(req.params.numero);
            if (!detalhe) return res.status(404).json({ error: 'Território não encontrado' });
            return res.json({ ...detalhe, permissoes: permissoes(req.user) });
        } catch (error) {
            console.error('Erro ao buscar território:', error);
            return res.status(500).json({ error: 'Erro ao buscar território' });
        }
    }

    async historico(req, res) {
        try {
            const t = await prisma.territorio.findFirst({ where: { numero: T.normalizarNumero(req.params.numero) } });
            if (!t) return res.status(404).json({ error: 'Território não encontrado' });
            return res.json(await T.historico(t.id));
        } catch (error) {
            console.error('Erro ao buscar histórico:', error);
            return res.status(500).json({ error: 'Erro ao buscar o histórico' });
        }
    }

    // ==================== REGISTRAR (dirigentes) ====================

    /**
     * POST /territorios/saidas — a saida de campo: concluiu, ou onde parou.
     * Idempotente por `clientKey`: o celular reenvia o que ficou na fila sem internet.
     */
    async criarSaida(req, res) {
        try {
            const b = req.body || {};
            if (!ehChave(b.clientKey)) return res.status(400).json({ error: 'Registro sem identificador' });
            const ja = await prisma.registroSaida.findUnique({ where: { clientKey: b.clientKey } });
            if (ja) return res.json(ja);

            const t = await territorioAtivo(b.territorioId);
            if (!t) return res.status(404).json({ error: 'Território não encontrado' });

            const hoje = T.hojeISO();
            const dia = ehDia(b.dia) ? b.dia : hoje;
            if (dia > hoje) return res.status(400).json({ error: 'A data da saída não pode ser no futuro' });

            const concluiu = b.concluiu === true;
            const ondeParou = texto(b.ondeParou, 500);
            const casaTrabalhada = T.CASA_TRABALHADA.includes(b.casaTrabalhada) ? b.casaTrabalhada : null;
            const quadraId = b.quadraId == null ? null : parseInt(b.quadraId, 10);
            if (quadraId !== null && !t.quadras.some(q => q.id === quadraId)) {
                return res.status(400).json({ error: 'Essa parte não é deste território' });
            }
            const lat = coordenada(b.lat, 90);
            const lng = coordenada(b.lng, 180);
            if (!concluiu && !ondeParou && lat === null) {
                return res.status(400).json({ error: 'Diga onde vocês pararam (ou marque no mapa)' });
            }

            const saida = await prisma.$transaction(async (tx) => {
                // Territorio concluido que recebe saida nova de outro dia: comecou a proxima volta.
                // Abrir o ciclo sozinho poupa o responsavel de lembrar do botao "novo ciclo".
                const conclusao = await tx.registroSaida.findFirst({
                    where: { territorioId: t.id, concluiu: true, status: { not: 'descartada' }, createdAt: { gte: t.cicloDesde } },
                    orderBy: { dia: 'desc' },
                });
                const novaVolta = conclusao && dia > conclusao.dia;
                if (novaVolta || t.naoIniciado) {
                    await tx.territorio.update({
                        where: { id: t.id },
                        data: { naoIniciado: false, ...(novaVolta ? { cicloDesde: new Date() } : {}) },
                    });
                }

                // Outro dirigente ja disse onde parou nesta mesma parte, no mesmo dia, com outra
                // orientacao: os dois ficam, e o responsavel decide na Revisao.
                const outro = concluiu ? null : await tx.registroSaida.findFirst({
                    where: { territorioId: t.id, dia, quadraId, status: 'ativa', concluiu: false, autorId: { not: req.user.id } },
                });
                const conflito = outro && (outro.ondeParou || '').toLowerCase() !== (ondeParou || '').toLowerCase();

                const criada = await tx.registroSaida.create({
                    data: {
                        clientKey: b.clientKey,
                        territorioId: t.id,
                        quadraId,
                        autorId: req.user.id,
                        dia,
                        concluiu,
                        ondeParou,
                        casaTrabalhada,
                        proximoInicio: texto(b.proximoInicio, 500),
                        pendente: texto(b.pendente, 1000),
                        lat: lng === null ? null : lat,
                        lng: lat === null ? null : lng,
                        status: conflito ? 'conflito' : 'ativa',
                    },
                });

                // Concluir fecha a designacao em aberto deste territorio (vai para o S-13).
                if (concluiu) {
                    const designacao = await tx.designacaoTerritorio.findFirst({
                        where: { territorioId: t.id, concluidoEm: null, dia: { lte: dia } },
                        orderBy: { dia: 'desc' },
                    });
                    if (designacao) {
                        await tx.designacaoTerritorio.update({ where: { id: designacao.id }, data: { concluidoEm: dia } });
                    }
                }
                return criada;
            });

            return res.status(201).json(saida);
        } catch (error) {
            if (duplicado(error)) {
                return res.json(await prisma.registroSaida.findUnique({ where: { clientKey: req.body.clientKey } }));
            }
            console.error('Erro ao registrar saída:', error);
            return res.status(500).json({ error: 'Erro ao registrar a saída' });
        }
    }

    async excluirSaida(req, res) {
        try {
            const saida = await prisma.registroSaida.findUnique({ where: { id: parseInt(req.params.id, 10) || 0 } });
            if (!saida) return res.status(404).json({ error: 'Registro não encontrado' });
            if (saida.autorId !== req.user.id && !gerencia(req.user)) {
                return res.status(403).json({ error: 'Só quem registrou pode apagar' });
            }
            await prisma.registroSaida.delete({ where: { id: saida.id } });
            return res.status(204).end();
        } catch (error) {
            console.error('Erro ao apagar saída:', error);
            return res.status(500).json({ error: 'Erro ao apagar' });
        }
    }

    /** POST /territorios/marcacoes — ponto do GPS. Idempotente por `clientKey`, como a saida. */
    async criarMarcacao(req, res) {
        try {
            const b = req.body || {};
            if (!ehChave(b.clientKey)) return res.status(400).json({ error: 'Marcação sem identificador' });
            const ja = await prisma.marcacao.findUnique({ where: { clientKey: b.clientKey } });
            if (ja) return res.json(ja);

            const t = await territorioAtivo(b.territorioId);
            if (!t) return res.status(404).json({ error: 'Território não encontrado' });
            if (!T.TIPOS_MARCACAO.includes(b.tipo)) return res.status(400).json({ error: 'Tipo de marcação inválido' });

            let lat = coordenada(b.lat, 90);
            let lng = coordenada(b.lng, 180);
            if (lat === null || lng === null) lat = lng = null;
            const descricao = texto(b.texto, 300);
            if (b.tipo === 'nao_bater' && !descricao) {
                return res.status(400).json({ error: 'Escreva a rua e o número da casa' });
            }
            if (lat === null && b.tipo !== 'nao_bater') {
                return res.status(400).json({ error: 'Localização inválida' });
            }

            // Hora do aparelho (a marcacao offline chega depois), mas nunca no futuro.
            const marcadaEm = new Date(b.marcadaEm);
            const quando = Number.isNaN(marcadaEm.getTime()) || marcadaEm > new Date(Date.now() + 10 * 60000)
                ? new Date()
                : marcadaEm;

            const quadra = lat !== null ? t.quadras.find(q => MyMaps.dentro([lat, lng], q.pontos)) : null;

            const marcacao = await prisma.marcacao.create({
                data: {
                    clientKey: b.clientKey,
                    territorioId: t.id,
                    quadraId: quadra ? quadra.id : null,
                    autorId: req.user.id,
                    tipo: b.tipo,
                    lat,
                    lng,
                    precisao: coordenada(b.precisao, 100000),
                    texto: descricao,
                    marcadaEm: quando,
                },
            });
            return res.status(201).json(marcacao);
        } catch (error) {
            if (duplicado(error)) {
                return res.json(await prisma.marcacao.findUnique({ where: { clientKey: req.body.clientKey } }));
            }
            console.error('Erro ao registrar marcação:', error);
            return res.status(500).json({ error: 'Erro ao registrar a marcação' });
        }
    }

    /** "Continua nao bater": zera o prazo de 3 meses. */
    async reconfirmarMarcacao(req, res) {
        try {
            const m = await prisma.marcacao.findFirst({ where: { id: parseInt(req.params.id, 10) || 0, ativo: true } });
            if (!m) return res.status(404).json({ error: 'Marcação não encontrada' });
            const atualizada = await prisma.marcacao.update({
                where: { id: m.id },
                data: { reconfirmadaEm: new Date(), reconfirmadaPorId: req.user.id },
            });
            return res.json(atualizada);
        } catch (error) {
            console.error('Erro ao reconfirmar:', error);
            return res.status(500).json({ error: 'Erro ao reconfirmar' });
        }
    }

    /** Retirar do mapa. Desativa em vez de apagar: o historico continua contando o que houve. */
    async excluirMarcacao(req, res) {
        try {
            const m = await prisma.marcacao.findUnique({ where: { id: parseInt(req.params.id, 10) || 0 } });
            if (!m) return res.status(404).json({ error: 'Marcação não encontrada' });
            if (m.autorId !== req.user.id && !gerencia(req.user)) {
                return res.status(403).json({ error: 'Só quem marcou pode retirar' });
            }
            await prisma.marcacao.update({ where: { id: m.id }, data: { ativo: false } });
            return res.status(204).end();
        } catch (error) {
            console.error('Erro ao retirar marcação:', error);
            return res.status(500).json({ error: 'Erro ao retirar' });
        }
    }

    // ==================== MY MAPS (gestao) ====================

    /**
     * POST /territorios/mymaps/previa { links: [...] } — le os mapas e devolve as camadas com o
     * numero sugerido, sem gravar nada. Os poligonos nao vem na resposta: a importacao baixa
     * de novo.
     */
    async previaMyMaps(req, res) {
        try {
            const links = Array.isArray(req.body?.links) ? req.body.links.slice(0, 10) : [];
            const mids = links.map(MyMaps.extrairMid);
            if (mids.length === 0 || mids.some(m => !m)) {
                return res.status(400).json({ error: 'Cole links do My Maps (google.com/maps/d/...)' });
            }

            const [mapas, doBanco] = await Promise.all([
                T.lerMapas(mids),
                prisma.territorio.findMany({ select: { numero: true, nome: true, mymapsMid: true, mymapsCamada: true } }),
            ]);

            const camadas = [];
            const vistas = new Set();
            for (const mid of new Set(mids)) {
                const mapa = mapas.get(mid);
                if (mapa.erro) continue;
                for (const c of mapa.camadas) {
                    // A mesma camada copiada para dois mapas (aconteceu com "Inicio KM 17").
                    const assinatura = `${c.nome.trim().toLowerCase()}|${c.quadras.length}`;
                    const atual = doBanco.find(t => t.mymapsMid === mid && t.mymapsCamada === c.nome);
                    camadas.push({
                        mid,
                        nomeMapa: mapa.nomeMapa,
                        camada: c.nome,
                        quadras: c.quadras.length,
                        nomesQuadras: c.quadras.map(q => q.nome),
                        cor: c.cor,
                        territorioAtual: atual ? atual.numero : null,
                        repetida: vistas.has(assinatura),
                        numeroSugerido: atual ? atual.numero : null,
                    });
                    vistas.add(assinatura);
                }
            }

            // Sugestao para quem ainda nao tem territorio: contra o que existe no banco e nos cartoes.
            const usados = new Set(camadas.map(c => c.numeroSugerido).filter(Boolean));
            const candidatos = [
                ...doBanco.map(t => ({ numero: t.numero, nome: t.nome })),
                ...[...T.cartoes()].map(([numero, c]) => ({ numero, nome: c.localidade })),
            ].filter((c, i, todos) => !usados.has(c.numero) && todos.findIndex(o => o.numero === c.numero) === i);
            const semNumero = camadas.filter(c => !c.numeroSugerido && !c.repetida);
            const sugestoes = MyMaps.sugerirNumeros(
                semNumero.map(c => ({ nome: c.camada, quadras: c.nomesQuadras.map(nome => ({ nome })) })),
                candidatos,
            );
            semNumero.forEach((c, i) => { c.numeroSugerido = sugestoes[i]; });

            return res.json({
                mapas: [...new Set(mids)].map(mid => ({ mid, nome: mapas.get(mid).nomeMapa ?? null, erro: mapas.get(mid).erro ?? null })),
                camadas,
            });
        } catch (error) {
            console.error('Erro na prévia do My Maps:', error);
            return res.status(500).json({ error: 'Erro ao ler os mapas' });
        }
    }

    /** POST /territorios/mymaps/importar { camadas: [{ mid, camada, numero, nome }] } */
    async importarMyMaps(req, res) {
        try {
            const pedido = (Array.isArray(req.body?.camadas) ? req.body.camadas : []).map(c => ({
                mid: MyMaps.extrairMid(c.mid),
                camada: String(c.camada || ''),
                numero: T.normalizarNumero(c.numero),
                nome: texto(c.nome, 120),
            }));
            if (pedido.length === 0) return res.status(400).json({ error: 'Escolha ao menos uma camada' });
            if (pedido.some(c => !c.mid || !c.camada || !c.numero)) {
                return res.status(400).json({ error: 'Toda camada escolhida precisa de um número' });
            }
            const numeros = pedido.map(c => c.numero);
            const repetido = numeros.find((n, i) => numeros.indexOf(n) !== i);
            if (repetido) return res.status(400).json({ error: `O número ${repetido} foi usado em duas camadas` });

            const mapas = await T.lerMapas(pedido.map(c => c.mid));
            const resultado = { importados: [], erros: [] };
            for (const c of pedido) {
                const mapa = mapas.get(c.mid);
                const camada = mapa.erro ? null : mapa.camadas.find(x => x.nome === c.camada);
                if (!camada) {
                    resultado.erros.push({ numero: c.numero, erro: mapa.erro || `A camada "${c.camada}" não está mais no mapa` });
                    continue;
                }
                const existente = await prisma.territorio.findFirst({ where: { mymapsMid: c.mid, mymapsCamada: c.camada } })
                    || await prisma.territorio.findUnique({ where: { numero: c.numero } });
                if (existente && existente.numero !== c.numero && await prisma.territorio.findUnique({ where: { numero: c.numero } })) {
                    resultado.erros.push({ numero: c.numero, erro: `O número ${c.numero} já é de outro território` });
                    continue;
                }
                await prisma.$transaction(async (tx) => {
                    const dados = { numero: c.numero, mymapsMid: c.mid, mymapsCamada: c.camada, cor: camada.cor, ativo: true };
                    const t = existente
                        ? await tx.territorio.update({ where: { id: existente.id }, data: { ...dados, ...(c.nome ? { nome: c.nome } : {}) } })
                        : await tx.territorio.create({ data: { ...dados, nome: c.nome || camada.nome } });
                    await T.sincronizarQuadras(tx, t.id, camada);
                });
                resultado.importados.push(c.numero);
            }
            return res.json(resultado);
        } catch (error) {
            console.error('Erro ao importar do My Maps:', error);
            return res.status(500).json({ error: 'Erro ao importar' });
        }
    }

    async atualizarMyMaps(req, res) {
        try {
            return res.json(await T.atualizarDoMyMaps());
        } catch (error) {
            console.error('Erro ao atualizar do My Maps:', error);
            return res.status(500).json({ error: 'Erro ao atualizar do My Maps' });
        }
    }

    // ==================== TERRITORIO (gestao) ====================

    async update(req, res) {
        try {
            const id = parseInt(req.params.id, 10) || 0;
            const b = req.body || {};
            const dados = {};
            if (b.numero !== undefined) {
                const numero = T.normalizarNumero(b.numero);
                if (!numero) return res.status(400).json({ error: 'Informe o número' });
                const ocupado = await prisma.territorio.findFirst({ where: { numero, id: { not: id } } });
                if (ocupado) return res.status(409).json({ error: `O número ${numero} já é de outro território` });
                dados.numero = numero;
            }
            if (b.nome !== undefined) {
                dados.nome = texto(b.nome, 120);
                if (!dados.nome) return res.status(400).json({ error: 'Informe o nome' });
            }
            if (b.area !== undefined) dados.area = texto(b.area, 60);
            if (b.apelidos !== undefined) dados.apelidos = texto(b.apelidos, 300);
            if (b.observacoes !== undefined) dados.observacoes = texto(b.observacoes, 1000);
            return res.json(await prisma.territorio.update({ where: { id }, data: dados }));
        } catch (error) {
            if (error.code === 'P2025') return res.status(404).json({ error: 'Território não encontrado' });
            console.error('Erro ao editar território:', error);
            return res.status(500).json({ error: 'Erro ao salvar' });
        }
    }

    /**
     * PUT /territorios/areas { de, nome, cor, numeros } — cria (`de` vazio) ou edita uma area:
     * nome, cor e QUAIS territorios. Quem sai da lista fica sem area; `numeros` vazio apaga a
     * area. Territorio de outra area e recusado: tira de la primeiro (um territorio, uma area).
     */
    async salvarArea(req, res) {
        try {
            const b = req.body || {};
            const de = texto(b.de, 60);
            const nome = texto(b.nome, 60);
            const cor = texto(b.cor, 7);
            if (!nome) return res.status(400).json({ error: 'Dê um nome para a área' });
            if (cor && !/^#[0-9a-f]{6}$/i.test(cor)) return res.status(400).json({ error: 'Cor inválida' });
            if (!Array.isArray(b.numeros)) return res.status(400).json({ error: 'Informe os territórios da área' });
            const numeros = [...new Set(b.numeros.map(T.normalizarNumero).filter(Boolean))];

            const ativos = await prisma.territorio.findMany({ where: { ativo: true }, select: { numero: true, area: true } });
            if (nome !== de && ativos.some(t => t.area === nome)) {
                return res.status(409).json({ error: `Já existe a área "${nome}"` });
            }
            const faltando = numeros.find(n => !ativos.some(t => t.numero === n));
            if (faltando) return res.status(404).json({ error: `Território ${faltando} não encontrado` });
            const deOutra = ativos.find(t => numeros.includes(t.numero) && t.area && t.area !== de);
            if (deOutra) {
                return res.status(409).json({
                    error: `O território ${deOutra.numero} já está na área "${deOutra.area}". Tire de lá primeiro.`,
                });
            }

            const config = await T.configAtual();
            const cores = { ...(config.coresAreas || {}) };
            if (de) delete cores[de];
            if (cor && numeros.length > 0) cores[nome] = cor;
            await prisma.$transaction([
                ...(de ? [prisma.territorio.updateMany({ where: { area: de, numero: { notIn: numeros } }, data: { area: null } })] : []),
                prisma.territorio.updateMany({ where: { numero: { in: numeros } }, data: { area: nome } }),
                prisma.config.update({ where: { id: config.id }, data: { coresAreas: cores } }),
            ]);
            return res.status(204).end();
        } catch (error) {
            console.error('Erro ao salvar área:', error);
            return res.status(500).json({ error: 'Erro ao salvar a área' });
        }
    }

    /**
     * PUT /territorios/limite { kml } — o contorno do territorio da congregacao, desenhado por
     * cima do mapa geral. Do arquivo, vale o maior poligono; a cor e a da linha do KML.
     */
    async salvarLimite(req, res) {
        try {
            const xml = String((req.body && req.body.kml) || '');
            if (!/<coordinates/i.test(xml)) {
                return res.status(400).json({ error: 'O arquivo não é um KML com polígono (KMZ não serve: exporte como KML)' });
            }
            const poligonos = MyMaps.lerKml(xml).camadas.flatMap(c => c.quadras);
            if (poligonos.length === 0) return res.status(400).json({ error: 'Nenhum polígono no arquivo' });
            const maior = poligonos.reduce((a, b) => (b.pontos.length > a.pontos.length ? b : a));
            const limite = {
                nome: texto(maior.nome, 120) || 'Território da congregação',
                cor: MyMaps.corDaLinha(xml) || maior.cor || null,
                pontos: maior.pontos,
            };
            const config = await T.configAtual();
            await prisma.config.update({ where: { id: config.id }, data: { limiteTerritorio: limite } });
            return res.json(limite);
        } catch (error) {
            console.error('Erro ao salvar o limite do território:', error);
            return res.status(500).json({ error: 'Erro ao salvar o limite' });
        }
    }

    async removerLimite(req, res) {
        try {
            await prisma.config.updateMany({ data: { limiteTerritorio: Prisma.DbNull } });
            return res.status(204).end();
        } catch (error) {
            console.error('Erro ao tirar o limite do território:', error);
            return res.status(500).json({ error: 'Erro ao tirar o limite' });
        }
    }

    /** Tira da lista sem apagar o historico. Importar a camada de novo reativa. */
    async desativar(req, res) {
        try {
            await prisma.territorio.update({ where: { id: parseInt(req.params.id, 10) || 0 }, data: { ativo: false } });
            return res.status(204).end();
        } catch (error) {
            if (error.code === 'P2025') return res.status(404).json({ error: 'Território não encontrado' });
            console.error('Erro ao desativar território:', error);
            return res.status(500).json({ error: 'Erro ao desativar' });
        }
    }

    /** { acao: 'novo' | 'nao_iniciado' | 'retomar' } */
    async ciclo(req, res) {
        try {
            const acoes = {
                novo: { cicloDesde: new Date(), naoIniciado: false },
                nao_iniciado: { naoIniciado: true },
                retomar: { naoIniciado: false },
            };
            const data = acoes[req.body?.acao];
            if (!data) return res.status(400).json({ error: 'Ação inválida' });
            return res.json(await prisma.territorio.update({ where: { id: parseInt(req.params.id, 10) || 0 }, data }));
        } catch (error) {
            if (error.code === 'P2025') return res.status(404).json({ error: 'Território não encontrado' });
            console.error('Erro ao mudar o ciclo:', error);
            return res.status(500).json({ error: 'Erro ao mudar o ciclo' });
        }
    }

    async criarAviso(req, res) {
        try {
            const t = await territorioAtivo(req.params.id);
            if (!t) return res.status(404).json({ error: 'Território não encontrado' });
            const tipo = T.TIPOS_AVISO.includes(req.body?.tipo) ? req.body.tipo : 'outro';
            const conteudo = texto(req.body?.texto, 300);
            if (!conteudo) return res.status(400).json({ error: 'Escreva o aviso' });
            const aviso = await prisma.avisoTerritorio.create({
                data: { territorioId: t.id, tipo, texto: conteudo, criadoPorId: req.user.id },
            });
            return res.status(201).json(aviso);
        } catch (error) {
            console.error('Erro ao criar aviso:', error);
            return res.status(500).json({ error: 'Erro ao criar o aviso' });
        }
    }

    async desativarAviso(req, res) {
        try {
            await prisma.avisoTerritorio.update({ where: { id: parseInt(req.params.id, 10) || 0 }, data: { ativo: false } });
            return res.status(204).end();
        } catch (error) {
            if (error.code === 'P2025') return res.status(404).json({ error: 'Aviso não encontrado' });
            console.error('Erro ao desativar aviso:', error);
            return res.status(500).json({ error: 'Erro ao desativar o aviso' });
        }
    }

    // ==================== DESIGNACOES ====================

    async designacoes(req, res) {
        try {
            const de = ehDia(req.query.de) ? req.query.de : T.hojeISO();
            const lista = await prisma.designacaoTerritorio.findMany({
                where: { dia: { gte: de, ...(ehDia(req.query.ate) ? { lte: req.query.ate } : {}) } },
                include: {
                    irmao: { select: { id: true, nome: true } },
                    territorio: { select: { id: true, numero: true, nome: true } },
                },
                orderBy: [{ dia: 'asc' }, { id: 'asc' }],
            });
            return res.json(lista.map(d => ({ id: d.id, dia: d.dia, concluidoEm: d.concluidoEm, dirigente: d.irmao, territorio: d.territorio })));
        } catch (error) {
            console.error('Erro ao listar designações:', error);
            return res.status(500).json({ error: 'Erro ao listar designações' });
        }
    }

    async criarDesignacao(req, res) {
        try {
            const b = req.body || {};
            const t = await territorioAtivo(b.territorioId);
            if (!t) return res.status(404).json({ error: 'Território não encontrado' });
            const irmao = await prisma.irmao.findFirst({ where: { id: parseInt(b.irmaoId, 10) || 0, ativo: true } });
            if (!irmao) return res.status(400).json({ error: 'Escolha o dirigente' });
            if (!ehDia(b.dia)) return res.status(400).json({ error: 'Escolha o dia' });
            const d = await prisma.designacaoTerritorio.create({
                data: { territorioId: t.id, irmaoId: irmao.id, dia: b.dia, criadoPorId: req.user.id },
            });
            return res.status(201).json(d);
        } catch (error) {
            console.error('Erro ao designar:', error);
            return res.status(500).json({ error: 'Erro ao designar' });
        }
    }

    /** { acao: 'concluir' | 'reabrir', dia? } */
    async atualizarDesignacao(req, res) {
        try {
            const acao = req.body?.acao;
            if (!['concluir', 'reabrir'].includes(acao)) return res.status(400).json({ error: 'Ação inválida' });
            const d = await prisma.designacaoTerritorio.findUnique({ where: { id: parseInt(req.params.id, 10) || 0 } });
            if (!d) return res.status(404).json({ error: 'Designação não encontrada' });
            const dia = ehDia(req.body?.dia) ? req.body.dia : d.dia;
            return res.json(await prisma.designacaoTerritorio.update({
                where: { id: d.id },
                data: { concluidoEm: acao === 'concluir' ? dia : null },
            }));
        } catch (error) {
            console.error('Erro ao atualizar designação:', error);
            return res.status(500).json({ error: 'Erro ao atualizar a designação' });
        }
    }

    async excluirDesignacao(req, res) {
        try {
            await prisma.designacaoTerritorio.delete({ where: { id: parseInt(req.params.id, 10) || 0 } });
            return res.status(204).end();
        } catch (error) {
            if (error.code === 'P2025') return res.status(404).json({ error: 'Designação não encontrada' });
            console.error('Erro ao apagar designação:', error);
            return res.status(500).json({ error: 'Erro ao apagar' });
        }
    }

    // ==================== REVISAO, PAINEL E S-13 ====================

    async conflitos(req, res) {
        try {
            const lista = await prisma.registroSaida.findMany({
                where: { status: 'conflito' },
                include: {
                    territorio: { select: { numero: true, nome: true } },
                    autor: { select: { id: true, nome: true } },
                    quadra: { select: { nome: true } },
                },
                orderBy: { createdAt: 'desc' },
            });
            return res.json(lista);
        } catch (error) {
            console.error('Erro ao listar conflitos:', error);
            return res.status(500).json({ error: 'Erro ao listar' });
        }
    }

    /** { status: 'ativa' | 'descartada' } */
    async revisar(req, res) {
        try {
            const status = req.body?.status;
            if (!['ativa', 'descartada'].includes(status)) return res.status(400).json({ error: 'Status inválido' });
            return res.json(await prisma.registroSaida.update({ where: { id: parseInt(req.params.id, 10) || 0 }, data: { status } }));
        } catch (error) {
            if (error.code === 'P2025') return res.status(404).json({ error: 'Registro não encontrado' });
            console.error('Erro ao revisar:', error);
            return res.status(500).json({ error: 'Erro ao revisar' });
        }
    }

    async painel(req, res) {
        try {
            const dias = [30, 90, 180, 365, 3650].includes(Number(req.query.dias)) ? Number(req.query.dias) : 90;
            return res.json(await T.painel(dias));
        } catch (error) {
            console.error('Erro ao montar o painel:', error);
            return res.status(500).json({ error: 'Erro ao montar o painel' });
        }
    }

    async s13(req, res) {
        try {
            const hoje = T.hojeISO();
            // Ano de servico atual: setembro em diante ja conta como o ano seguinte.
            const atual = Number(hoje.slice(0, 4)) + (Number(hoje.slice(5, 7)) >= 9 ? 1 : 0);
            const ano = Number(req.query.ano) || atual;
            if (ano < 2000 || ano > atual + 1) return res.status(400).json({ error: 'Ano inválido' });
            return res.json(await T.s13(ano));
        } catch (error) {
            console.error('Erro ao montar o S-13:', error);
            return res.status(500).json({ error: 'Erro ao montar o S-13' });
        }
    }
}

module.exports = new TerritorioController();
