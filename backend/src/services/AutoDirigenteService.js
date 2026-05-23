const prisma = require('../prisma');

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
     * Gera template ou preenche automaticamente a escala
     */
    async gerarEscala(quadroId, mes, ano, autoPreenchimento = false) {
        // 1. Buscar saídas de campo ativas com os dirigentes disponíveis
        const saidasCampo = await prisma.saidaCampo.findMany({
            where: { ativo: true },
            include: {
                dirigentesDisponiveis: {
                    include: { irmao: true }
                }
            }
        });

        const dias = this.gerarDiasDoMes(mes, ano);
        
        // Estrutura para salvar o template
        const escalasParaCriar = [];

        // Prepara os turnos do mês
        for (const dia of dias) {
            // Acha as saídas programadas para esse dia da semana
            const saidasDoDia = saidasCampo.filter(s => s.diaSemana === dia.diaSemanaSlug);

            for (const saida of saidasDoDia) {
                escalasParaCriar.push({
                    quadroId,
                    saidaCampoId: saida.id,
                    data: dia.data,
                    dia: dia.diaSemanaStr,
                    principal: '',
                    substituto: '',
                    removido: false,
                    // Passar metadados para uso no algoritmo se for auto-preencher
                    _meta: {
                        dataObj: dia.dataObj,
                        dirigentes: saida.dirigentesDisponiveis
                            .filter(d => d.irmao.ativo)
                            .map(d => d.irmao.nome)
                    }
                });
            }
        }

        // Criar template primeiro
        const escalasSemMeta = escalasParaCriar.map(e => {
            const { _meta, ...rest } = e;
            return rest;
        });

        // Prisma createMany retorna só a quantidade, então teremos que buscar depois para o algoritmo, 
        // ou a gente preenche no JS e depois faz update/create.
        // Vamos preencher no JS e criar de uma vez se for autoPreenchimento.

        if (autoPreenchimento) {
            // Contadores para distribuição igualitária
            const contadorDesignacoes = {};
            
            // Rastrear última vez que o dirigente foi escalado (para evitar seguidas)
            const ultimaDesignacao = {}; // { nome: Date() }

            // Buscar histórico anterior
            let prevMes = mes - 1;
            let prevAno = ano;
            if (prevMes === 0) {
                prevMes = 12;
                prevAno = ano - 1;
            }

            const quadroAnterior = await prisma.quadroDirigente.findUnique({
                where: { mes_ano: { mes: prevMes, ano: prevAno } },
                include: { escalas: true }
            });

            if (quadroAnterior && quadroAnterior.escalas) {
                quadroAnterior.escalas.forEach(esc => {
                    const dDate = new Date(prevAno, prevMes - 1, parseInt(esc.data.split('/')[0]));
                    
                    const atualizarSeMaisRecente = (irmao) => {
                        if (irmao) {
                            if (!ultimaDesignacao[irmao] || ultimaDesignacao[irmao] < dDate) {
                                ultimaDesignacao[irmao] = dDate;
                            }
                        }
                    };

                    atualizarSeMaisRecente(esc.principal);
                    atualizarSeMaisRecente(esc.substituto);
                });
            }

            // Precisamos buscar indisponibilidades
            const indisponibilidades = await prisma.indisponibilidade.findMany();
            const indisponibilidadeMap = {}; // { 'Nome': ['01/01', '02/01'] }
            
            for (const ind of indisponibilidades) {
                const irmao = await prisma.irmao.findUnique({ where: { id: ind.irmaoId } });
                if (irmao) {
                    if (!indisponibilidadeMap[irmao.nome]) indisponibilidadeMap[irmao.nome] = [];
                    indisponibilidadeMap[irmao.nome].push(ind.data);
                }
            }

            // Lógica de seleção de irmão
            const selecionarDirigente = (candidatos, dataStr, dataObj, excluir = null) => {
                let disponiveis = candidatos.filter(c => {
                    // Excluir já escalado na mesma saída
                    if (c === excluir) return false;
                    
                    // Verificar indisponibilidade no calendário
                    if (indisponibilidadeMap[c] && indisponibilidadeMap[c].includes(dataStr)) {
                        return false;
                    }
                    return true;
                });

                if (disponiveis.length === 0) return '';

                // Regra: Evitar dias seguidos (diferença <= 2 dias)
                const semRepeticao = disponiveis.filter(c => {
                    const ultima = ultimaDesignacao[c];
                    if (!ultima) return true;
                    const diffDias = Math.abs(dataObj - ultima) / (1000 * 60 * 60 * 24);
                    return diffDias > 2; // Tem que ter mais de 2 dias de descanso
                });

                if (semRepeticao.length > 0) {
                    disponiveis = semRepeticao;
                }

                // Distribuição igualitária
                disponiveis.sort((a, b) => {
                    return (contadorDesignacoes[a] || 0) - (contadorDesignacoes[b] || 0);
                });

                const escolhido = disponiveis[0];
                
                // Atualizar rastreadores
                contadorDesignacoes[escolhido] = (contadorDesignacoes[escolhido] || 0) + 1;
                ultimaDesignacao[escolhido] = dataObj;

                return escolhido;
            };

            // Processar escalas
            for (const esc of escalasParaCriar) {
                const candidatos = esc._meta.dirigentes;
                
                esc.principal = selecionarDirigente(candidatos, esc.data, esc._meta.dataObj);
                esc.substituto = selecionarDirigente(candidatos, esc.data, esc._meta.dataObj, esc.principal);
            }
        }

        // Criar no banco removendo o _meta
        const dataParaInserir = escalasParaCriar.map(e => {
            const { _meta, ...rest } = e;
            return rest;
        });

        await prisma.escalaDirigente.createMany({
            data: dataParaInserir
        });

        return { success: true };
    }
}

module.exports = new AutoDirigenteService();
