const prisma = require('../prisma');
const Divisao = require('../services/DivisaoGruposService');
const Relatorio = require('../services/RelatorioCampoService');
const Pioneiro = require('../services/PioneiroService');

const erro = (res, status, mensagem) => res.status(status).json({ error: mensagem });
const MENSAGENS = { 403: 'Você não tem acesso a este grupo.', 404: 'Grupo não encontrado.' };

/**
 * Os grupos de campo para quem lidera (dirigente e ajudante, so o proprio) e para quem ve
 * todos (admin geral e o secretario), o relatorio de servico de campo, e a importacao da nova
 * divisao dos grupos a partir do PDF da lista (so admin geral).
 */
class GruposController {
    /** GET /grupos/painel?mes=YYYY-MM */
    async painel(req, res) {
        try {
            return res.json(await Relatorio.painel(req.user, req.query.mes));
        } catch (e) {
            console.error('Erro no painel de grupos:', e);
            return erro(res, 500, 'Erro ao carregar os grupos');
        }
    }

    /** GET /grupos/:id/detalhe?mes=YYYY-MM&periodo=mes|3m|ano */
    async detalhe(req, res) {
        try {
            const r = await Relatorio.detalhe(req.user, parseInt(req.params.id, 10), req.query);
            if (r.erro) return erro(res, r.erro, MENSAGENS[r.erro]);
            return res.json(r);
        } catch (e) {
            console.error('Erro no detalhe do grupo:', e);
            return erro(res, 500, 'Erro ao carregar o grupo');
        }
    }

    /** GET /grupos/:id/membros/:irmaoId — a ficha do irmao para o dirigente */
    async membro(req, res) {
        try {
            const r = await Relatorio.membro(req.user, parseInt(req.params.id, 10), parseInt(req.params.irmaoId, 10));
            if (r.erro) return erro(res, r.erro, r.erro === 404 ? 'Irmão não encontrado neste grupo.' : MENSAGENS[403]);
            return res.json(r);
        } catch (e) {
            console.error('Erro na ficha do irmão:', e);
            return erro(res, 500, 'Erro ao carregar o irmão');
        }
    }

    /** PUT /relatorios-campo — body: { irmaoId, mes, participou, estudos, horas, pioneiroAuxiliar, observacao } */
    async salvarRelatorio(req, res) {
        try {
            const r = await Relatorio.salvarRelatorio(req.user, req.body);
            if (r.erro) return erro(res, r.erro, r.mensagem);
            return res.json(r.relatorio);
        } catch (e) {
            console.error('Erro ao salvar relatório:', e);
            return erro(res, 500, 'Erro ao salvar o relatório');
        }
    }

    /** GET /relatorios-campo/meu?mes=: o relatorio do proprio irmao no mes. */
    async meuRelatorio(req, res) {
        try {
            const r = await Relatorio.meuRelatorio(req.user, req.query.mes);
            if (r.erro) return erro(res, r.erro, r.mensagem);
            return res.json(r);
        } catch (e) {
            console.error('Erro ao carregar o relatório do irmão:', e);
            return erro(res, 500, 'Erro ao carregar o relatório');
        }
    }

    /** PUT /relatorios-campo/meu: o proprio irmao manda o relatorio ("Registrar o campo"). */
    async enviarMeuRelatorio(req, res) {
        try {
            const r = await Relatorio.enviarMeuRelatorio(req.user, req.body);
            if (r.erro) return erro(res, r.erro, r.mensagem);
            return res.json(r.relatorio);
        } catch (e) {
            console.error('Erro ao enviar o relatório do irmão:', e);
            return erro(res, 500, 'Erro ao enviar o relatório');
        }
    }

    /** DELETE /relatorios-campo/:id */
    async apagarRelatorio(req, res) {
        try {
            const r = await Relatorio.apagarRelatorio(req.user, parseInt(req.params.id, 10));
            if (r.erro) return erro(res, r.erro, r.erro === 404 ? 'Relatório não encontrado.' : MENSAGENS[403]);
            return res.json(r);
        } catch (e) {
            console.error('Erro ao apagar relatório:', e);
            return erro(res, 500, 'Erro ao apagar o relatório');
        }
    }

    /** GET /relatorios-campo/resumo?mes=YYYY-MM — o total da congregacao (admin e secretario) */
    async resumo(req, res) {
        try {
            const r = await Relatorio.resumoDoMes(req.user, req.query.mes);
            if (r.erro) return erro(res, r.erro, 'Só o secretário e os administradores veem o relatório da congregação.');
            return res.json(r);
        } catch (e) {
            console.error('Erro no resumo do relatório:', e);
            return erro(res, 500, 'Erro ao montar o relatório');
        }
    }

    /** PUT /grupos/secretario — body: { irmaoId } (null tira). So admin geral. */
    async definirSecretario(req, res) {
        try {
            const bruto = req.body && req.body.irmaoId;
            const irmaoId = bruto === null ? null : Number(bruto);
            if (irmaoId !== null && !Number.isInteger(irmaoId)) return erro(res, 400, 'Irmão inválido.');
            if (irmaoId !== null && !(await prisma.irmao.findUnique({ where: { id: irmaoId }, select: { id: true } }))) {
                return erro(res, 404, 'Irmão não encontrado.');
            }
            const config = await prisma.config.findFirst({ select: { id: true } });
            if (config) await prisma.config.update({ where: { id: config.id }, data: { secretarioIrmaoId: irmaoId } });
            else await prisma.config.create({ data: { titulo: 'Quadro de Designações', subtitulo: '', mes: 'JAN', secretarioIrmaoId: irmaoId } });
            return res.json({ success: true, irmaoId });
        } catch (e) {
            console.error('Erro ao definir o secretário:', e);
            return erro(res, 500, 'Erro ao salvar o secretário');
        }
    }

    /**
     * POST /grupos/divisao/previa — PDF da lista de grupos (campo "file"). Le os grupos e casa
     * cada nome com o cadastro. NAO grava: a tela mostra e o admin confirma em /aplicar.
     */
    async previaDivisao(req, res) {
        try {
            if (!req.file) return erro(res, 400, 'Envie o PDF da lista de grupos.');
            const { grupos, avisos } = Divisao.montarGrupos(await Divisao.lerItens(req.file.buffer));
            if (grupos.length === 0) {
                return erro(res, 422, 'Não achei nenhum grupo no arquivo. Confira se é o PDF da lista de grupos.');
            }
            const cadastro = await prisma.irmao.findMany({ where: { ativo: true }, select: { id: true, nome: true, grupoId: true } });
            const previa = Divisao.previa(grupos, cadastro);
            const listados = new Set(previa.flatMap((g) => g.membros.map((m) => m.irmao && m.irmao.id).filter(Boolean)));
            return res.json({
                grupos: previa,
                avisos,
                // Quem esta em algum grupo hoje e nao apareceu na lista nova: sai dos grupos.
                saem: cadastro.filter((i) => i.grupoId && !listados.has(i.id)).map(({ id, nome }) => ({ id, nome })),
            });
        } catch (e) {
            console.error('Erro ao ler a divisão de grupos:', e);
            return erro(res, 500, 'Erro ao ler o PDF');
        }
    }

    /**
     * POST /grupos/divisao/aplicar — a divisao conferida pelo admin:
     * { grupos: [{ numero, local, dirigente: {membro|irmaoId}, ajudante: {...},
     *              membros: [{ nomeDocumento, irmaoId?, nomeNovo?, pioneiro }] }], tirarDosGrupos }
     *
     * Tudo numa transacao: grupos (pelo numero), quem esta em cada um, dirigente e ajudante, e o
     * pioneiro regular de quem esta na lista (o auxiliar do cadastro fica). Grupo que nao veio fica
     * inativo.
     */
    async aplicarDivisao(req, res) {
        try {
            const entrada = Array.isArray(req.body && req.body.grupos) ? req.body.grupos : null;
            if (!entrada || entrada.length === 0 || entrada.length > 30) return erro(res, 400, 'Divisão inválida.');
            if (entrada.some((g) => !Number.isInteger(g.numero) || !Array.isArray(g.membros))) {
                return erro(res, 400, 'Cada grupo precisa do número e dos membros.');
            }
            const tirarDosGrupos = req.body.tirarDosGrupos !== false;

            const resultado = await prisma.$transaction(async (tx) => {
                // 1. Cada nome vira um irmao: o escolhido pelo admin, ou um registro novo.
                const novos = [];
                const resolver = async (m) => {
                    const id = Number(m.irmaoId);
                    if (Number.isInteger(id) && id > 0) {
                        const existe = await tx.irmao.findUnique({ where: { id }, select: { id: true } });
                        if (existe) return id;
                    }
                    const nome = String(m.nomeNovo || m.nomeDocumento || '').replace(/\s+/g, ' ').trim().slice(0, 120);
                    if (!nome) return null;
                    const ja = await tx.irmao.findUnique({ where: { nome }, select: { id: true } });
                    if (ja) return ja.id;
                    const criado = await tx.irmao.create({ data: { nome, funcoes: [] }, select: { id: true } });
                    novos.push(nome);
                    return criado.id;
                };

                const grupos = [];
                for (const g of entrada) {
                    const membros = [];
                    for (const m of g.membros) {
                        const id = await resolver(m);
                        if (id) membros.push({ id, nomeDocumento: m.nomeDocumento, pioneiro: m.pioneiro === true });
                    }
                    const lider = async (l) => {
                        if (!l) return null;
                        if (l.membro) {
                            const achado = membros.find((m) => m.nomeDocumento === l.membro);
                            if (achado) return achado.id;
                        }
                        return l.irmaoId ? resolver(l) : null;
                    };
                    grupos.push({ numero: g.numero, local: g.local ? String(g.local).slice(0, 80) : null, membros, dirigenteId: await lider(g.dirigente), ajudanteId: await lider(g.ajudante) });
                }

                // 2. Os grupos: pelo numero, senao pelo dirigente, senao um novo.
                const atuais = await tx.grupoCampo.findMany();
                const usados = new Set();
                for (const g of grupos) {
                    const existente =
                        atuais.find((a) => a.numero === g.numero && !usados.has(a.id)) ||
                        atuais.find((a) => g.dirigenteId && a.dirigenteId === g.dirigenteId && !usados.has(a.id));
                    const dirigente = g.dirigenteId ? await tx.irmao.findUnique({ where: { id: g.dirigenteId }, select: { nome: true } }) : null;
                    let nome = dirigente ? dirigente.nome : `Grupo ${g.numero}`;
                    // `nome` e unico: outro grupo com o mesmo nome ganha o numero junto.
                    if (atuais.some((a) => a.nome === nome && (!existente || a.id !== existente.id))) nome = `${nome} (${g.numero})`;
                    const dados = { nome, numero: g.numero, local: g.local, ordem: g.numero, ativo: true, dirigenteId: g.dirigenteId, ajudanteId: g.ajudanteId };
                    const salvo = existente
                        ? await tx.grupoCampo.update({ where: { id: existente.id }, data: dados })
                        : await tx.grupoCampo.create({ data: dados });
                    usados.add(salvo.id);
                    g.id = salvo.id;
                }
                await tx.grupoCampo.updateMany({ where: { id: { notIn: [...usados] } }, data: { ativo: false } });

                // 3. Quem esta em cada grupo e quem e pioneiro regular: a lista e a fonte do regular (o
                // verde). O auxiliar continuo nao sai no PDF: vem do cadastro e fica como esta.
                const antes = new Map(
                    (await tx.irmao.findMany({ where: { id: { in: grupos.flatMap((g) => g.membros.map((m) => m.id)) } }, select: { id: true, pioneiro: true } }))
                        .map((i) => [i.id, i.pioneiro]),
                );
                const listados = new Set();
                const viraramRegulares = [];
                for (const g of grupos) {
                    for (const m of g.membros) {
                        listados.add(m.id);
                        const era = antes.get(m.id) ?? null;
                        const pioneiro = m.pioneiro ? 'regular' : era === 'regular' ? null : era;
                        if (pioneiro === 'regular' && era !== 'regular') viraramRegulares.push(m.id);
                        await tx.irmao.update({ where: { id: m.id }, data: { grupoId: g.id, pioneiro } });
                    }
                }
                if (viraramRegulares.length) await Pioneiro.metaDoTipo(tx, viraramRegulares, 'regular');
                let sairam = 0;
                if (tirarDosGrupos) {
                    sairam = (await tx.irmao.updateMany({ where: { grupoId: { not: null }, id: { notIn: [...listados] } }, data: { grupoId: null } })).count;
                }
                return {
                    grupos: grupos.length,
                    pessoas: listados.size,
                    pioneiros: grupos.reduce((s, g) => s + g.membros.filter((m) => m.pioneiro).length, 0),
                    criados: novos,
                    sairam,
                };
            }, { timeout: 60000 });

            return res.json({ success: true, ...resultado });
        } catch (e) {
            console.error('Erro ao aplicar a divisão de grupos:', e);
            return erro(res, 500, 'Erro ao aplicar a divisão');
        }
    }
}

module.exports = new GruposController();
