// Casa os nomes que aparecem na programação importada (Excel ou PDF) com os
// irmãos cadastrados e monta um PREVIEW de indisponibilidades para o usuário
// revisar e confirmar — substitui a marcação silenciosa que existia antes.
//
// Esta lógica foi extraída da antiga "FASE 2" de ReuniaoController.importExcel,
// agora agrupando por irmão e separando matches confiáveis (1 candidato) dos
// ambíguos (vários candidatos), em vez de aplicar direto no banco.

const { domingoDaSemana } = require('../utils/semanaReuniao');

// Campos das semanas que carregam nomes de pessoas, com um rótulo legível da parte.
//
// `momento` diz em QUE DIA daquela semana a parte acontece: 'meio' na reunião de meio de
// semana (a única data que o arquivo importado traz) e 'fds' no domingo que fecha a mesma
// semana. Sem essa distinção, quem serve no fim de semana era marcado como ocupado na
// quinta — e o domingo, o dia em que ele realmente serve, continuava livre no quadro.
//
// Espelha o `momento` de CAMPOS_REUNIAO (MinhasDesignacoesService): as duas listas precisam
// concordar sobre o dia de cada parte, e verificar:indisponibilidade-import confere isso.
const CAMPOS = [
    { campo: 'presidente', label: 'Presidente', momento: 'meio' },
    { campo: 'conselheiroB', label: 'Conselheiro Sala B', momento: 'meio' },
    { campo: 'oracaoInicial', label: 'Oração Inicial', momento: 'meio' },
    { campo: 'oracaoFinal', label: 'Oração Final', momento: 'meio' },
    { campo: 'tesouro1_irmao', label: 'Tesouros 1', momento: 'meio' },
    { campo: 'tesouro2_irmao', label: 'Tesouros 2', momento: 'meio' },
    { campo: 'tesouro3_principal', label: 'Leitura da Bíblia', momento: 'meio' },
    { campo: 'tesouro3_salaB', label: 'Leitura da Bíblia (Sala B)', momento: 'meio' },
    { campo: 'ministerio1_principal', label: 'Ministério 1', momento: 'meio' },
    { campo: 'ministerio1_salaB', label: 'Ministério 1 (Sala B)', momento: 'meio' },
    { campo: 'ministerio2_principal', label: 'Ministério 2', momento: 'meio' },
    { campo: 'ministerio2_salaB', label: 'Ministério 2 (Sala B)', momento: 'meio' },
    { campo: 'ministerio3_principal', label: 'Ministério 3', momento: 'meio' },
    { campo: 'ministerio3_salaB', label: 'Ministério 3 (Sala B)', momento: 'meio' },
    { campo: 'ministerio4_principal', label: 'Ministério 4', momento: 'meio' },
    { campo: 'ministerio4_salaB', label: 'Ministério 4 (Sala B)', momento: 'meio' },
    { campo: 'vidaCrista1_irmao', label: 'Vida Cristã 1', momento: 'meio' },
    { campo: 'vidaCrista2_irmao', label: 'Vida Cristã 2', momento: 'meio' },
    { campo: 'estudoBiblico_dirigente', label: 'Estudo (Dirigente)', momento: 'meio' },
    { campo: 'estudoBiblico_leitor', label: 'Estudo (Leitor)', momento: 'meio' },
    { campo: 'fds_presidente', label: 'Fim de Semana (Presidente)', momento: 'fds' },
    { campo: 'fds_orador', label: 'Fim de Semana (Orador)', momento: 'fds' },
    { campo: 'fds_leitor', label: 'Leitor da Sentinela', momento: 'fds' },
];

const normalizeString = (str) =>
    str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, ' ');

const tokenize = (str) =>
    normalizeString(str).split(/\s+/).filter((word) => word.length > 2); // ignora palavras de 1-2 letras

/**
 * Classifica a semelhança entre o nome importado (TI) e o nome do irmão (TD),
 * ambos já tokenizados. As pessoas costumam escrever o irmão com sobrenomes
 * diferentes ou a mais/a menos, então não dá para exigir igualdade exata.
 *
 * Retorna a "força" do match:
 *   3 = alta   → um nome contém o outro por completo e o menor tem ≥2 tokens
 *                (ex.: "André Marques" = "André Marques", "José Santos" ⊂ "José Santos Lima")
 *   2 = média  → o primeiro nome de um aparece no outro, ou compartilham ≥2 tokens
 *                (ex.: "José Ricardo" × "Ricardo Carvalho" → batem em "Ricardo")
 *   1 = fraca  → só um sobrenome em comum (ruído — ignorado)
 *   0 = nada
 */
function matchStrength(TI, TD) {
    if (!TI.length || !TD.length) return 0;
    const shared = TI.filter((t) => TD.includes(t));
    if (shared.length === 0) return 0;

    const importInDb = TI.every((t) => TD.includes(t));
    const dbInImport = TD.every((t) => TI.includes(t));
    const minLen = Math.min(TI.length, TD.length);
    // Contenção total só é "alta" quando o nome menor tem ≥2 tokens; um único
    // token contido (sobrenome solto num nome longo) cai para as regras abaixo.
    if ((importInDb || dbInImport) && minLen >= 2) return 3;

    // Primeiro nome de um aparecendo no outro é um forte indício (porém parcial).
    // Reordenações/abreviações reais (mesmos sobrenomes) já caem na contenção acima;
    // exigir o primeiro nome evita o ruído de "dois sobrenomes comuns em comum"
    // (ex.: "... dos Santos" × "... dos Santos" de pessoas diferentes).
    const firstNameMatch = TI.includes(TD[0]) || TD.includes(TI[0]);
    if (firstNameMatch) return 2;

    return 1;
}

// Ordena por "dd/MM" cronologicamente (mês depois dia).
const compareData = (a, b) => {
    const [dia1, mes1] = a.split('/').map((n) => parseInt(n, 10));
    const [dia2, mes2] = b.split('/').map((n) => parseInt(n, 10));
    return mes1 * 100 + dia1 - (mes2 * 100 + dia2);
};

/**
 * "dd/MM" — o formato de data do quadro e da tabela Indisponibilidade (sem ano).
 * Aceita a string "dd/MM/yyyy" da programação ou um Date já calculado.
 */
function formatarDiaMes(valor) {
    if (valor instanceof Date) {
        if (Number.isNaN(valor.getTime())) return null;
        return `${String(valor.getDate()).padStart(2, '0')}/${String(valor.getMonth() + 1).padStart(2, '0')}`;
    }
    const m = String(valor || '').match(/(\d{1,2})\/(\d{1,2})/);
    return m ? `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}` : null;
}

/**
 * @param {Array} semanas  Semanas parseadas (formato SemanaReuniao)
 * @param {Array} irmaosDB Irmãos cadastrados ([{ id, nome }])
 * @returns {{ confirmados: Array, ambiguos: Array }}
 *   confirmados: [{ irmaoId, nome, datas: [{ data, count, partes: [] }] }]
 *   ambiguos:    [{ nomeOriginal, data, partes: [], candidatos: [{ id, nome }] }]
 */
function buildIndisponibilidadePreview(semanas, irmaosDB) {
    // 1) Coleta ocorrências { nomeOriginal, data "dd/MM", parte }
    const ocorrencias = [];
    for (const sem of semanas) {
        // Duas datas por semana: a reunião de meio de semana (a única que o arquivo traz) e o
        // domingo que a fecha, por aritmética de data. O domingo pode cair no mês seguinte
        // (30/09 fecha em 04/10), então não dá para tirá-lo do mês da Reuniao. As semanas
        // chegam aqui já reconciliadas por reconciliarSemanas.
        const datas = {
            meio: formatarDiaMes(sem.dataReuniao),
            fds: formatarDiaMes(domingoDaSemana(sem.dataReuniao)),
        };
        if (!datas.meio && !datas.fds) continue;

        for (const { campo, label, momento } of CAMPOS) {
            const data = datas[momento];
            if (!data) continue;

            const val = sem[campo];
            if (!val || typeof val !== 'string') continue;
            const fragmentos = val.split('/').map((n) => n.trim()).filter((n) => n && n !== '-');
            for (const nome of fragmentos) {
                ocorrencias.push({ nomeOriginal: nome, data, parte: label });
            }
        }
    }

    // 2) Pré-tokeniza os irmãos do banco
    const irmaosTok = irmaosDB.map((i) => ({ id: i.id, nome: i.nome, tokens: tokenize(i.nome) }));

    // 3) Casa cada ocorrência
    // confirmadosMap: irmaoId -> { irmaoId, nome, datasMap: Map(data -> { partes:Set, confianca, origem:Set }) }
    const confirmadosMap = new Map();
    // ambiguosMap: `${nome}__${data}` -> { nomeOriginal, data, partes:Set, candidatos }
    const ambiguosMap = new Map();

    const addConfirmado = (m, data, parte, confianca, origem) => {
        let entry = confirmadosMap.get(m.id);
        if (!entry) {
            entry = { irmaoId: m.id, nome: m.nome, datasMap: new Map() };
            confirmadosMap.set(m.id, entry);
        }
        let d = entry.datasMap.get(data);
        if (!d) {
            d = { data, partes: new Set(), confianca, origem: new Set() };
            entry.datasMap.set(data, d);
        }
        d.partes.add(parte);
        d.origem.add(origem);
        // 'alta' prevalece sobre 'media' quando o mesmo dia bate por nomes diferentes.
        if (confianca === 'alta') d.confianca = 'alta';
    };

    for (const oc of ocorrencias) {
        const importTokens = tokenize(oc.nomeOriginal);
        if (importTokens.length === 0 || importTokens.includes('grupo')) continue;

        // Pontua todos os irmãos; mantém só os com força >= 2 (ignora ruído de sobrenome).
        const scored = irmaosTok
            .map((it) => ({ it, s: matchStrength(importTokens, it.tokens) }))
            .filter((x) => x.s >= 2);
        if (scored.length === 0) continue;

        const best = Math.max(...scored.map((x) => x.s));
        const winners = scored.filter((x) => x.s === best);

        if (winners.length === 1) {
            // Único melhor candidato → confirmado. Alta confiança se contenção total.
            addConfirmado(
                winners[0].it,
                oc.data,
                oc.parte,
                best === 3 ? 'alta' : 'media',
                oc.nomeOriginal,
            );
        } else {
            // Empate entre vários (ex.: dois "Ricardo") → revisão manual.
            const key = `${oc.nomeOriginal}__${oc.data}`;
            let amb = ambiguosMap.get(key);
            if (!amb) {
                amb = {
                    nomeOriginal: oc.nomeOriginal,
                    data: oc.data,
                    partes: new Set(),
                    candidatos: winners.map((w) => ({ id: w.it.id, nome: w.it.nome })),
                };
                ambiguosMap.set(key, amb);
            }
            amb.partes.add(oc.parte);
        }
    }

    const confirmados = [...confirmadosMap.values()]
        .map((e) => ({
            irmaoId: e.irmaoId,
            nome: e.nome,
            datas: [...e.datasMap.values()]
                .map((d) => ({
                    data: d.data,
                    count: d.partes.size,
                    partes: [...d.partes],
                    confianca: d.confianca,
                    origem: [...d.origem],
                }))
                .sort((a, b) => compareData(a.data, b.data)),
        }))
        // Mais confiantes primeiro (quem tem alguma data 'alta'), depois por nome.
        .sort((a, b) => {
            const aAlta = a.datas.some((d) => d.confianca === 'alta') ? 0 : 1;
            const bAlta = b.datas.some((d) => d.confianca === 'alta') ? 0 : 1;
            return aAlta - bAlta || a.nome.localeCompare(b.nome, 'pt-BR');
        });

    const ambiguos = [...ambiguosMap.values()]
        .map((a) => ({
            nomeOriginal: a.nomeOriginal,
            data: a.data,
            partes: [...a.partes],
            candidatos: a.candidatos,
        }))
        .sort((a, b) => a.nomeOriginal.localeCompare(b.nomeOriginal, 'pt-BR') || compareData(a.data, b.data));

    return { confirmados, ambiguos };
}

// tokenize/matchStrength saem tambem soltos: o script de normalizacao de nomes das
// designacoes precisa do mesmo criterio de semelhanca, e reimplementa-lo la deixaria duas
// regras de match divergindo com o tempo.
module.exports = { buildIndisponibilidadePreview, CAMPOS, tokenize, matchStrength, formatarDiaMes };
