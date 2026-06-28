// Casa os nomes que aparecem na programação importada (Excel ou PDF) com os
// irmãos cadastrados e monta um PREVIEW de indisponibilidades para o usuário
// revisar e confirmar — substitui a marcação silenciosa que existia antes.
//
// Esta lógica foi extraída da antiga "FASE 2" de ReuniaoController.importExcel,
// agora agrupando por irmão e separando matches confiáveis (1 candidato) dos
// ambíguos (vários candidatos), em vez de aplicar direto no banco.

// Campos das semanas que carregam nomes de pessoas, com um rótulo legível da parte.
const CAMPOS = [
    ['presidente', 'Presidente'],
    ['conselheiroB', 'Conselheiro Sala B'],
    ['oracaoInicial', 'Oração Inicial'],
    ['oracaoFinal', 'Oração Final'],
    ['tesouro1_irmao', 'Tesouros 1'],
    ['tesouro2_irmao', 'Tesouros 2'],
    ['tesouro3_principal', 'Leitura da Bíblia'],
    ['tesouro3_salaB', 'Leitura da Bíblia (Sala B)'],
    ['ministerio1_principal', 'Ministério 1'],
    ['ministerio1_salaB', 'Ministério 1 (Sala B)'],
    ['ministerio2_principal', 'Ministério 2'],
    ['ministerio2_salaB', 'Ministério 2 (Sala B)'],
    ['ministerio3_principal', 'Ministério 3'],
    ['ministerio3_salaB', 'Ministério 3 (Sala B)'],
    ['ministerio4_principal', 'Ministério 4'],
    ['ministerio4_salaB', 'Ministério 4 (Sala B)'],
    ['vidaCrista1_irmao', 'Vida Cristã 1'],
    ['vidaCrista2_irmao', 'Vida Cristã 2'],
    ['estudoBiblico_dirigente', 'Estudo (Dirigente)'],
    ['estudoBiblico_leitor', 'Estudo (Leitor)'],
    ['fds_presidente', 'Fim de Semana (Presidente)'],
    ['fds_orador', 'Fim de Semana (Orador)'],
    ['fds_leitor', 'Leitor da Sentinela'],
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
        let dataFmt = null;
        if (sem.dataReuniao) {
            const [dd, mm] = sem.dataReuniao.split('/');
            if (dd && mm) dataFmt = `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}`;
        }
        if (!dataFmt) continue;

        for (const [campo, label] of CAMPOS) {
            const val = sem[campo];
            if (!val || typeof val !== 'string') continue;
            const fragmentos = val.split('/').map((n) => n.trim()).filter((n) => n && n !== '-');
            for (const nome of fragmentos) {
                ocorrencias.push({ nomeOriginal: nome, data: dataFmt, parte: label });
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

module.exports = { buildIndisponibilidadePreview, CAMPOS };
