const prisma = require('../prisma');
const { gerarEscala: resolverEscala, REGRAS_PADRAO } = require('./EscalaDirigenteAlgoritmo');

/**
 * Orquestra a geracao da Escala de Dirigentes: monta o universo a partir do banco,
 * delega a decisao para EscalaDirigenteAlgoritmo (puro) e persiste o resultado.
 */
class AutoDirigenteService {

    /**
     * Gera dias organizados por semana (Segunda a Sábado).
     * - Início: Segunda-feira da semana que contém o dia 1 do mês (pode puxar do mês anterior)
     * - Fim: Último sábado do mês
     * - Domingos são sempre excluídos
     */
    gerarDiasDoMes(mes, ano) {
        const dias = [];

        const nomesDias = ['Domingo', 'Segunda-Feira', 'Terça-Feira', 'Quarta-Feira', 'Quinta-Feira', 'Sexta-Feira', 'Sábado'];
        const diasSemanaMap = {
            1: 'segunda',
            2: 'terca',
            3: 'quarta',
            4: 'quinta',
            5: 'sexta',
            6: 'sabado'
        };

        const primeiroDia = new Date(ano, mes - 1, 1);
        const diaDaSemana1 = primeiroDia.getDay(); // 0=Dom, 1=Seg, ...

        // Calcular o início: Segunda-feira da semana contendo o dia 1
        let inicioDate;
        if (diaDaSemana1 === 0) {
            // Dia 1 é domingo → próxima segunda é dia 2
            inicioDate = new Date(ano, mes - 1, 2);
        } else if (diaDaSemana1 === 1) {
            // Dia 1 já é segunda
            inicioDate = new Date(ano, mes - 1, 1);
        } else {
            // Voltar para a segunda anterior (pode ser do mês anterior)
            const diasVoltar = diaDaSemana1 - 1;
            inicioDate = new Date(ano, mes - 1, 1 - diasVoltar);
        }

        // Calcular o fim: Último sábado do mês
        const ultimoDia = new Date(ano, mes, 0); // Último dia do mês
        const ultimoDiaSemana = ultimoDia.getDay();
        const diasVoltarParaSabado = (ultimoDiaSemana - 6 + 7) % 7;
        // Sat(6)→0, Sun(0)→1, Mon(1)→2, Tue(2)→3, Wed(3)→4, Thu(4)→5, Fri(5)→6
        const fimDate = new Date(ultimoDia);
        fimDate.setDate(fimDate.getDate() - diasVoltarParaSabado);

        // Gerar todos os dias de inicioDate até fimDate, excluindo domingos
        const current = new Date(inicioDate);
        while (current <= fimDate) {
            const diaDaSemana = current.getDay();
            if (diaDaSemana !== 0) { // Excluir domingo
                const diaStr = String(current.getDate()).padStart(2, '0');
                const mesStr = String(current.getMonth() + 1).padStart(2, '0');

                dias.push({
                    data: `${diaStr}/${mesStr}`,
                    diaSemanaStr: nomesDias[diaDaSemana],
                    diaSemanaSlug: diasSemanaMap[diaDaSemana],
                    dataObj: new Date(current)
                });
            }
            current.setDate(current.getDate() + 1);
        }
        return dias;
    }

    /**
     * Converte uma data "dd/MM" de um quadro (mes/ano) para Date real.
     *
     * Um quadro pode conter dias do mes anterior, porque a escala comeca na segunda-feira
     * da semana que contem o dia 1. A versao antiga ignorava o "MM" da string e assumia o
     * mes do quadro, o que colocava "30/06" de um quadro de julho no dia 30 de julho e
     * quebrava toda a regra de descanso na virada do mes.
     */
    resolverData(dataStr, mesQuadro, anoQuadro) {
        const [dia, mes] = String(dataStr).split('/').map(Number);
        if (!dia || !mes) return null;
        // Unico caso em que o mes da data e maior que o do quadro: dezembro num quadro de janeiro.
        const ano = mes > mesQuadro ? anoQuadro - 1 : anoQuadro;
        return new Date(ano, mes - 1, dia);
    }

    /**
     * Carrega o universo de dirigentes numa unica query.
     *
     * O pool inclui tanto quem tem vinculo com alguma saida ativa quanto quem esta marcado
     * com a funcao "dirigente" sem vinculo nenhum. O segundo grupo nunca podera ser escalado,
     * mas precisa aparecer para que "garantir que todos sejam designados" seja mensuravel e
     * para que o diagnostico avise que falta vincular o irmao a alguma saida - antes ele
     * simplesmente desaparecia do sistema sem nenhum sinal.
     */
    async carregarDirigentes() {
        const irmaos = await prisma.irmao.findMany({
            where: {
                ativo: true,
                OR: [
                    { dirigenteSaidas: { some: { saidaCampo: { ativo: true } } } },
                    { funcoes: { has: 'dirigente' } }
                ]
            },
            include: {
                indisponibilidades: true,
                dirigenteSaidas: { include: { saidaCampo: true } }
            },
            orderBy: { nome: 'asc' }
        });

        return irmaos.map(i => ({
            nome: i.nome,
            saidaCampoIds: i.dirigenteSaidas
                .filter(ds => ds.saidaCampo?.ativo)
                .map(ds => ds.saidaCampoId),
            indisponiveis: i.indisponibilidades.map(ind => ind.data)
        }));
    }

    /**
     * Monta o historico dos quadros ANTERIORES, que e o que define a fila inicial do rodizio.
     *
     * Nao basta o mes passado e nao basta contar designacoes: o algoritmo precisa saber a
     * ORDEM em que os irmaos serviram pela ultima vez, porque a fila do mes N e a fila com que
     * o mes N-1 terminou. Por isso todas as designacoes anteriores sao colocadas numa unica
     * sequencia cronologica (data, turno, saida) e cada irmao guarda o indice da ultima vez em
     * que aparece nela - `ordem`. Maior = serviu mais recentemente = mais para o fim da fila.
     *
     * Uma janela de 12 quadros e suficiente: so a ULTIMA vez de cada um importa, e quem nao
     * aparece na janela e tratado como "nunca serviu", que ja e a frente da fila.
     */
    async carregarHistorico(mes, ano) {
        const quadrosAnteriores = await prisma.quadroDirigente.findMany({
            where: {
                OR: [
                    { ano: { lt: ano } },
                    { ano, mes: { lt: mes } }
                ]
            },
            include: {
                escalas: {
                    where: { removido: false },
                    include: { saidaCampo: true }
                }
            },
            orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
            take: 12
        });

        const eventos = [];
        for (const quadro of quadrosAnteriores) {
            for (const esc of quadro.escalas) {
                if (!esc.principal) continue;
                const dataObj = this.resolverData(esc.data, quadro.mes, quadro.ano);
                if (!dataObj) continue;
                eventos.push({
                    nome: esc.principal,
                    dataObj,
                    turno: esc.saidaCampo?.turno || 0,
                    saidaCampoId: esc.saidaCampoId
                });
            }
        }

        eventos.sort((a, b) =>
            a.dataObj.getTime() - b.dataObj.getTime()
            || a.turno - b.turno
            || a.saidaCampoId - b.saidaCampoId);

        const historico = {};
        eventos.forEach((evento, indice) => {
            if (!historico[evento.nome]) {
                historico[evento.nome] = { designacoes: 0, ultimaDataObj: null, ordem: null };
            }
            const registro = historico[evento.nome];
            registro.designacoes += 1;
            registro.ultimaDataObj = evento.dataObj;
            registro.ordem = indice;
        });

        return historico;
    }

    /**
     * Gera o template do mes e, se pedido, preenche automaticamente.
     *
     * @param {number} quadroId
     * @param {number} mes
     * @param {number} ano
     * @param {boolean} autoPreenchimento
     * @param {Object} regras  toggles do algoritmo (ver EscalaDirigenteAlgoritmo.REGRAS_PADRAO)
     * @returns {Promise<{ success: boolean, diagnostico: Object|null }>}
     */
    async gerarEscala(quadroId, mes, ano, autoPreenchimento = false, regras = null) {
        // 1. Saídas de campo ativas com os dirigentes habilitados
        const saidasCampo = await prisma.saidaCampo.findMany({
            where: { ativo: true },
            include: {
                dirigentesDisponiveis: {
                    include: { irmao: true }
                }
            }
        });

        const dias = this.gerarDiasDoMes(mes, ano);

        // 2. Template: uma escala por (dia, saída daquele dia da semana)
        const escalasParaCriar = [];
        for (const dia of dias) {
            const saidasDoDia = saidasCampo.filter(s => s.diaSemana === dia.diaSemanaSlug);
            for (const saida of saidasDoDia) {
                escalasParaCriar.push({
                    quadroId,
                    saidaCampoId: saida.id,
                    data: dia.data,
                    dia: dia.diaSemanaStr,
                    principal: '',
                    removido: false,
                    _meta: { dataObj: dia.dataObj, turno: saida.turno, local: saida.local, horario: saida.horario }
                });
            }
        }

        let diagnostico = null;

        if (autoPreenchimento && escalasParaCriar.length > 0) {
            // 3. Dirigentes e historico. Duas queries no total - a versao antiga disparava
            //    um findUnique por linha de indisponibilidade.
            const dirigentes = await this.carregarDirigentes();
            const historico = await this.carregarHistorico(mes, ano);

            // 4. Decisao (modulo puro)
            const vagasBase = escalasParaCriar.map((e, indice) => ({
                id: indice,
                data: e.data,
                dataObj: e._meta.dataObj,
                saidaCampoId: e.saidaCampoId,
                turno: e._meta.turno,
                local: e._meta.local,
                horario: e._meta.horario
            }));

            const saida = resolverEscala({
                vagasBase,
                dirigentes,
                historico,
                regras: { ...REGRAS_PADRAO, ...(regras || {}) }
            });

            saida.atribuicoes.forEach(a => {
                escalasParaCriar[a.id].principal = a.principal;
            });

            diagnostico = saida.diagnostico;
        }

        // 5. Persistir
        const dataParaInserir = escalasParaCriar.map(({ _meta, ...rest }) => rest);
        if (dataParaInserir.length > 0) {
            await prisma.escalaDirigente.createMany({ data: dataParaInserir });
        }

        return { success: true, diagnostico };
    }

    /**
     * Regera o preenchimento de um quadro que ja existe, sem recriar o template.
     * Preserva os dias que o usuario removeu (removido = true).
     */
    async regerarEscala(quadroId, mes, ano, regras = null) {
        const escalas = await prisma.escalaDirigente.findMany({
            where: { quadroId, removido: false },
            include: { saidaCampo: true }
        });

        if (escalas.length === 0) {
            return { success: false, erro: 'Nenhuma saída ativa nesta escala para preencher.' };
        }

        const dirigentes = await this.carregarDirigentes();
        const historico = await this.carregarHistorico(mes, ano);

        const vagasBase = escalas.map(e => ({
            id: e.id,
            data: e.data,
            dataObj: this.resolverData(e.data, mes, ano),
            saidaCampoId: e.saidaCampoId,
            turno: e.saidaCampo?.turno,
            local: e.saidaCampo?.local,
            horario: e.saidaCampo?.horario
        })).filter(v => v.dataObj);

        const saida = resolverEscala({
            vagasBase,
            dirigentes,
            historico,
            regras: { ...REGRAS_PADRAO, ...(regras || {}) }
        });

        await prisma.$transaction(
            saida.atribuicoes.map(a =>
                prisma.escalaDirigente.update({
                    where: { id: a.id },
                    data: { principal: a.principal }
                })
            )
        );

        return { success: true, diagnostico: saida.diagnostico };
    }
}

module.exports = new AutoDirigenteService();
