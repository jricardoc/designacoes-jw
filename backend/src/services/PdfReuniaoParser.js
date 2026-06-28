// Parser da programação da reunião a partir de um PDF.
//
// O PDF é a mesma programação que hoje é importada via Excel, exportado como PDF
// (layout em tabela). O texto "cru" em ordem de leitura embaralha as colunas, então
// reconstruímos a tabela a partir das COORDENADAS (x,y) de cada fragmento de texto
// devolvido pelo pdfjs: agrupamos itens por linha (y) e separamos as colunas por x.
//
// Saída: { mes, ano, semanas: [...] } no MESMO formato que o ExcelReuniaoParser,
// para reuso direto pelo ReuniaoController.

// Build "legacy" do pdfjs: compatível com Node/CommonJS, sem necessidade de worker
// nem de canvas (só fazemos extração de texto, não renderização).
let pdfjsLib = null;
function getPdfjs() {
    if (!pdfjsLib) {
        pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    }
    return pdfjsLib;
}

const norm = (s) =>
    (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim();

const collapse = (s) => (s || '').replace(/\s+/g, ' ').trim();

// Rótulos do lado direito (chave: valor). Ordem importa: variantes mais
// específicas antes das genéricas (ex.: "oracao final" antes de "oracao").
const LABELS = [
    { key: 'oracaoFinal', test: (s) => s.startsWith('oracao final') },
    { key: 'oracao', test: (s) => s.startsWith('oracao') },
    { key: 'conselheiro', test: (s) => s.startsWith('conselheiro') },
    { key: 'presidente', test: (s) => s.startsWith('presidente:') },
    { key: 'dirigenteLeitor', test: (s) => s.startsWith('dirigente') },
    { key: 'leitorSentinela', test: (s) => s.startsWith('leitor da sentinela') },
    { key: 'tema', test: (s) => s.startsWith('tema:') },
    { key: 'orador', test: (s) => s.startsWith('orador:') },
    { key: 'cong', test: (s) => s.startsWith('cong:') },
    { key: 'canticoFds', test: (s) => s.startsWith('cantico:') },
    { key: 'limpeza', test: (s) => s.startsWith('limpeza:') },
];

function labelOf(item) {
    const n = norm(item.str);
    for (const l of LABELS) {
        if (l.test(n)) return l.key;
    }
    return null;
}

/**
 * Extrai todas as páginas como "linhas" reconstruídas por coordenadas.
 * Cada linha: { y, page, items: [{ str, x }] } com items ordenados por x.
 */
async function extractLines(buffer) {
    const pdfjs = getPdfjs();
    const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        // mantém o parsing puramente textual / evita avaliação de scripts do PDF
        isEvalSupported: false,
    });
    const doc = await loadingTask.promise;

    const allLines = [];
    const TOL = 4; // tolerância em px para considerar itens na mesma linha visual

    for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();

        const items = content.items
            .filter((it) => it.str && it.str.trim() !== '')
            .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));

        items.sort((a, b) => b.y - a.y || a.x - b.x);

        const lines = [];
        for (const it of items) {
            let line = lines.find((l) => Math.abs(l.y - it.y) <= TOL);
            if (!line) {
                line = { y: it.y, page: p, items: [] };
                lines.push(line);
            }
            line.items.push(it);
        }
        lines.sort((a, b) => b.y - a.y);
        for (const l of lines) l.items.sort((a, b) => a.x - b.x);
        allLines.push(...lines);
    }

    return allLines;
}

/**
 * Separa os itens de uma linha em: valores de rótulos (chave→valor),
 * itens da esquerda (tempo/descrição/cântico) e itens de nomes (colunas).
 */
function splitLine(items, colBoundary) {
    const labelItems = [];
    const rest = [];
    for (const it of items) {
        const key = labelOf(it);
        if (key) labelItems.push({ ...it, key });
        else rest.push(it);
    }

    // Valor de cada rótulo: parte após ":" no próprio item OU itens à direita,
    // até o próximo rótulo (limite por x).
    labelItems.sort((a, b) => a.x - b.x);
    const labels = {};
    for (let i = 0; i < labelItems.length; i++) {
        const lab = labelItems[i];
        const nextX = i + 1 < labelItems.length ? labelItems[i + 1].x : Infinity;
        const inline = lab.str.split(':').slice(1).join(':').trim();
        let value = inline;
        if (!value) {
            value = rest
                .filter((r) => r.x > lab.x && r.x < nextX)
                .sort((a, b) => a.x - b.x)
                .map((r) => r.str)
                .join(' ');
        }
        // Não sobrescreve um rótulo repetido na mesma linha (raro)
        if (!labels[lab.key]) labels[lab.key] = collapse(value);
    }

    // Itens consumidos como valor de rótulo precisam sair de "rest".
    const consumed = new Set();
    for (let i = 0; i < labelItems.length; i++) {
        const lab = labelItems[i];
        if (lab.str.includes(':') && lab.str.split(':').slice(1).join(':').trim()) continue;
        const nextX = i + 1 < labelItems.length ? labelItems[i + 1].x : Infinity;
        rest.forEach((r) => {
            if (r.x > lab.x && r.x < nextX) consumed.add(r);
        });
    }
    const remaining = rest.filter((r) => !consumed.has(r));

    const left = remaining.filter((r) => r.x < 200);
    const names = remaining.filter((r) => r.x >= 200);
    const salaB = names.filter((r) => r.x < colBoundary).sort((a, b) => a.x - b.x);
    const salao = names.filter((r) => r.x >= colBoundary).sort((a, b) => a.x - b.x);

    return { labels, left, names, salaB, salao };
}

const isTime = (s) => /^\d{1,2}:\d{2}$/.test((s || '').trim());

function parseLines(lines) {
    const semanas = [];
    let cur = null;
    let mode = 'HEADER'; // HEADER | TESOUROS | MINISTERIO | VIDA_CRISTA | FDS | LIMPEZA
    let colBoundary = 410;
    let counters = { tesouro: 0, ministerio: 0, vidaCrista: 0 };
    let target = null;

    const newSemana = (faixaData) => ({
        faixaData,
        dataReuniao: null,
        leituraSemanal: null,
        presidente: null,
        conselheiroB: null,
        oracaoInicial: null,
        oracaoFinal: null,
        canticoInicial: null,
        canticoMeio: null,
        canticoFinal: null,
        tesouro1_titulo: null, tesouro1_irmao: null,
        tesouro2_titulo: null, tesouro2_irmao: null,
        tesouro3_titulo: null, tesouro3_salaB: null, tesouro3_principal: null,
        ministerio1_titulo: null, ministerio1_salaB: null, ministerio1_principal: null,
        ministerio2_titulo: null, ministerio2_salaB: null, ministerio2_principal: null,
        ministerio3_titulo: null, ministerio3_salaB: null, ministerio3_principal: null,
        ministerio4_titulo: null, ministerio4_salaB: null, ministerio4_principal: null,
        vidaCrista1_titulo: null, vidaCrista1_irmao: null,
        vidaCrista2_titulo: null, vidaCrista2_irmao: null,
        estudoBiblico_dirigente: null, estudoBiblico_leitor: null,
        fds_presidente: null, fds_tema: null, fds_orador: null,
        fds_congregacao: null, fds_leitor: null,
        limpeza: null,
    });

    const joinNames = (arr) => collapse(arr.join(' '));

    const finalizeTarget = () => {
        if (!target || !cur) {
            target = null;
            return;
        }
        const salaB = joinNames(target.salaB || []);
        const salao = joinNames(target.salao || []);
        const principal = salao || salaB;

        if (target.kind === 'tesouro') {
            const n = target.slot;
            if (n === 3) {
                cur.tesouro3_titulo = target.titulo;
                cur.tesouro3_salaB = salaB || null;
                cur.tesouro3_principal = salao || null;
            } else if (n === 1 || n === 2) {
                cur[`tesouro${n}_titulo`] = target.titulo;
                cur[`tesouro${n}_irmao`] = principal || null;
            }
        } else if (target.kind === 'ministerio') {
            const n = target.slot;
            if (n >= 1 && n <= 4) {
                cur[`ministerio${n}_titulo`] = target.titulo;
                cur[`ministerio${n}_salaB`] = salaB || null;
                cur[`ministerio${n}_principal`] = salao || null;
            }
        } else if (target.kind === 'vidaCrista') {
            const n = target.slot;
            if (n === 1 || n === 2) {
                cur[`vidaCrista${n}_titulo`] = target.titulo;
                cur[`vidaCrista${n}_irmao`] = principal || null;
            }
        } else if (target.kind === 'estudo') {
            const raw = collapse(target.estudo.join(' '));
            const [dir, lei] = raw.split('/');
            cur.estudoBiblico_dirigente = dir ? dir.trim() : null;
            cur.estudoBiblico_leitor = lei ? lei.trim() : null;
        }
        target = null;
    };

    const pushCantico = (value) => {
        if (!cur) return;
        if (!cur.canticoInicial) cur.canticoInicial = value;
        else if (!cur.canticoMeio) cur.canticoMeio = value;
        else cur.canticoFinal = value;
    };

    for (const line of lines) {
        // --- Detecção de início de semana ---
        const congItem = line.items.find((it) => norm(it.str).startsWith('congregacao'));
        if (congItem) {
            finalizeTarget();
            if (cur) semanas.push(cur);
            const faixa = collapse(
                line.items.filter((it) => it.x < congItem.x).map((it) => it.str).join(' ')
            );
            cur = newSemana(faixa || null);
            mode = 'HEADER';
            counters = { tesouro: 0, ministerio: 0, vidaCrista: 0 };
            continue;
        }
        if (!cur) continue;

        const { labels, left, salaB, salao } = splitLine(line.items, colBoundary);

        // --- Aplica rótulos chave→valor ---
        if (labels.conselheiro && !cur.conselheiroB) cur.conselheiroB = labels.conselheiro;
        if (labels.oracaoFinal) cur.oracaoFinal = labels.oracaoFinal;
        if (labels.oracao && !cur.oracaoInicial) cur.oracaoInicial = labels.oracao;
        if (labels.presidente) {
            if (mode === 'FDS') cur.fds_presidente = labels.presidente;
            else if (!cur.presidente) cur.presidente = labels.presidente;
        }
        if (labels.tema) cur.fds_tema = labels.tema;
        if (labels.orador) cur.fds_orador = labels.orador;
        if (labels.cong) cur.fds_congregacao = labels.cong;
        if (labels.leitorSentinela) cur.fds_leitor = labels.leitorSentinela;
        if (labels.limpeza) cur.limpeza = labels.limpeza;

        const leftText = collapse(left.map((it) => it.str).join(' '));
        const nLeft = norm(leftText);

        // --- Linha de data/leitura: "dd/MM/yyyy | leitura" ---
        const dataItem = left.find((it) => /\d{2}\/\d{2}\/\d{4}/.test(it.str));
        if (dataItem && dataItem.str.includes('|')) {
            const [d, l] = dataItem.str.split('|');
            cur.dataReuniao = d.trim();
            cur.leituraSemanal = l ? collapse(l) : null;
        }

        // --- Cabeçalhos de seção / blocos ---
        if (nLeft.includes('tesouros da palavra')) {
            finalizeTarget();
            mode = 'TESOUROS';
            counters.tesouro = 0;
            const b = line.items.find((it) => norm(it.str) === 'sala b');
            const sp = line.items.find((it) => norm(it.str).startsWith('salao principal'));
            if (b && sp) colBoundary = (b.x + sp.x) / 2;
            continue;
        }
        if (nLeft.includes('faca seu melhor no ministerio')) {
            finalizeTarget();
            mode = 'MINISTERIO';
            counters.ministerio = 0;
            const b = line.items.find((it) => norm(it.str) === 'sala b');
            const sp = line.items.find((it) => norm(it.str).startsWith('salao principal'));
            if (b && sp) colBoundary = (b.x + sp.x) / 2;
            continue;
        }
        if (nLeft.includes('nossa vida crista')) {
            finalizeTarget();
            mode = 'VIDA_CRISTA';
            counters.vidaCrista = 0;
            continue;
        }
        if (nLeft.includes('reuniao congregacional') || nLeft.includes('final de semana')) {
            finalizeTarget();
            mode = 'FDS';
            continue;
        }
        if (nLeft.includes('limpeza semanal')) {
            finalizeTarget();
            mode = 'LIMPEZA';
            continue;
        }

        // --- Parte numerada: "N. Título ..." ---
        const partItem = left.find((it) => /^\s*\d+\.\s/.test(it.str));
        if (partItem) {
            finalizeTarget();
            const timeItem = left.find((it) => isTime(it.str));
            let titulo = collapse(partItem.str);
            // remove eventual número de parte duplicado ("1. 1. ...")
            titulo = titulo.replace(/^(\d+\.\s)(?:\d+\.\s)+/, '$1');
            if (timeItem) titulo = `${timeItem.str.trim()} ${titulo}`;

            if (mode === 'TESOUROS') {
                counters.tesouro += 1;
                target = { kind: 'tesouro', slot: counters.tesouro, titulo, salaB: [...salaB.map((s) => s.str)], salao: [...salao.map((s) => s.str)] };
            } else if (mode === 'MINISTERIO') {
                counters.ministerio += 1;
                target = { kind: 'ministerio', slot: counters.ministerio, titulo, salaB: [...salaB.map((s) => s.str)], salao: [...salao.map((s) => s.str)] };
            } else if (mode === 'VIDA_CRISTA') {
                if (/estudo b[ií]?blico/i.test(partItem.str)) {
                    target = { kind: 'estudo', estudo: labels.dirigenteLeitor ? [labels.dirigenteLeitor] : [] };
                } else {
                    counters.vidaCrista += 1;
                    target = { kind: 'vidaCrista', slot: counters.vidaCrista, titulo, salaB: [...salaB.map((s) => s.str)], salao: [...salao.map((s) => s.str)] };
                }
            }
            continue;
        }

        // --- Cântico (linha de música, não o "Cântico:" do FDS) ---
        const canticoItem = left.find((it) => /^c[âa]ntico$/i.test(norm(it.str)) || /^c[âa]ntico/i.test(it.str.trim()));
        if (canticoItem && mode !== 'FDS') {
            const timeItem = left.find((it) => isTime(it.str));
            // número do cântico: item numérico à direita do "Cântico"
            const numItem = left
                .filter((it) => /^\d+$/.test(it.str.trim()) && it.x > canticoItem.x)
                .sort((a, b) => a.x - b.x)[0];
            const num = numItem ? numItem.str.trim() : null;
            if (num) {
                const value = timeItem ? `${timeItem.str.trim()}|${num}` : num;
                pushCantico(value);
            }
            continue;
        }

        // --- Linha de continuação (somente nomes): acumula no alvo atual ---
        if (target && (salaB.length || salao.length)) {
            if (target.kind === 'estudo') {
                target.estudo.push(...salaB.map((s) => s.str), ...salao.map((s) => s.str));
            } else {
                target.salaB.push(...salaB.map((s) => s.str));
                target.salao.push(...salao.map((s) => s.str));
            }
        }
    }

    finalizeTarget();
    if (cur) semanas.push(cur);
    return semanas;
}

const MESES = {
    janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function derivarMesAno(semanas) {
    // Preferência: primeira data de reunião "dd/MM/yyyy" (mais confiável que a
    // faixa do cabeçalho, que pode dizer "29 Junho - 5 Julho" numa edição de Julho).
    for (const s of semanas) {
        if (s.dataReuniao) {
            const m = s.dataReuniao.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (m) return { mes: parseInt(m[2], 10), ano: parseInt(m[3], 10) };
        }
    }
    // Fallback: nome do mês na faixaData
    for (const s of semanas) {
        if (s.faixaData) {
            for (const [nome, num] of Object.entries(MESES)) {
                if (norm(s.faixaData).includes(nome)) {
                    return { mes: num, ano: new Date().getFullYear() };
                }
            }
        }
    }
    return { mes: 1, ano: new Date().getFullYear() };
}

/**
 * Parse principal. Recebe o Buffer do PDF e devolve { mes, ano, semanas }.
 */
async function parsePdf(buffer) {
    const lines = await extractLines(buffer);
    const semanas = parseLines(lines).filter((s) => s.faixaData || s.dataReuniao);
    const { mes, ano } = derivarMesAno(semanas);
    return { mes, ano, semanas };
}

module.exports = { parsePdf };
