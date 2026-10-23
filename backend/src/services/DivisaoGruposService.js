'use strict';

/**
 * A nova divisao dos grupos de campo, lida do PDF da "Lista de Grupos" (a planilha do Excel
 * exportada) e casada com o cadastro.
 *
 * O PDF tem, por grupo, o cabecalho "GRUPO 01 (Tokaia)", as linhas "DIRIGENTE: ..." e
 * "AJUDANTE: ...", e os membros um embaixo do outro. Nome em VERDE e pioneiro regular. As
 * colunas sao reconstruidas pela POSICAO de cada trecho, e a cor vem da lista de operacoes
 * do PDF (pdf.js): o texto puro nao traz nem uma coisa nem outra.
 *
 * Nada aqui grava: o controller mostra a previa ao admin e so aplica o que ele confirmar.
 * Nenhum nome mora no codigo (o repositorio e publico); o PDF chega pela tela.
 */

let pdfjsLib = null;
function getPdfjs() {
    if (!pdfjsLib) pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    return pdfjsLib;
}

/** "Verde" e o texto em que o verde manda claramente; preto e cinza ficam de fora. */
function ehVerde([r, g, b]) {
    return g >= 90 && g - r >= 30 && g - b >= 30;
}

/**
 * Os trechos de texto do PDF com posicao e cor: [{ texto, x, y, verde }]. `y` cresce para
 * cima (coordenada do PDF), como em todo o pdf.js.
 */
async function lerItens(buffer) {
    const pdfjs = getPdfjs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true })
        .promise;
    const { OPS } = pdfjs;
    const itens = [];
    for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const { fnArray, argsArray } = await page.getOperatorList();
        let cor = [0, 0, 0];
        let x = 0;
        let y = 0;
        fnArray.forEach((fn, i) => {
            const args = argsArray[i];
            if (fn === OPS.setFillRGBColor) {
                cor = [0, 1, 2].map((k) => Number(args[k]) || 0);
            } else if (fn === OPS.setFillGray) {
                const v = Math.round((Number(args[0]) || 0) * 255);
                cor = [v, v, v];
            } else if (fn === OPS.setTextMatrix) {
                x = Number(args[4]) || 0;
                y = Number(args[5]) || 0;
            } else if (fn === OPS.showText || fn === OPS.showSpacedText) {
                const texto = (args[0] || [])
                    .map((g) => (g && typeof g === 'object' ? g.unicode || '' : typeof g === 'number' && g < -200 ? ' ' : ''))
                    .join('')
                    .replace(/\s+/g, ' ')
                    .trim();
                // Pagina seguinte desce: cada pagina tem a sua altura, entao empilha por pagina.
                if (texto) itens.push({ texto, x, y: y - (p - 1) * 10000, verde: ehVerde(cor) });
            }
        });
    }
    return itens;
}

const RE_GRUPO = /^GRUPO\s*0*(\d+)\s*(?:\((.*)\))?/i;
const RE_DIRIGENTE = /^DIRIGENTE\s*:\s*(.+)$/i;
const RE_AJUDANTE = /^AJUDANTE\s*:\s*(.+)$/i;

/** Tolerancia de alinhamento das colunas (pt): os nomes sao alinhados a esquerda da coluna. */
const COLUNA = 15;

/**
 * Os grupos a partir dos trechos: cada "DIRIGENTE:" abre uma coluna; o cabecalho do grupo e o
 * "GRUPO NN" logo acima dela; o ajudante e os membros sao o que esta alinhado embaixo, ate o
 * proximo grupo da mesma coluna.
 */
function montarGrupos(itens) {
    const avisos = [];
    const cabecalhos = itens.filter((i) => RE_GRUPO.test(i.texto));
    const dirigentes = itens.filter((i) => RE_DIRIGENTE.test(i.texto));
    const ajudantes = itens.filter((i) => RE_AJUDANTE.test(i.texto));
    const rotulos = new Set([...cabecalhos, ...dirigentes, ...ajudantes]);

    const grupos = dirigentes.map((d) => {
        // O cabecalho e centralizado na coluna: fica a direita do inicio dela, logo acima.
        const cabecalho = cabecalhos
            .filter((c) => c.y > d.y && c.y - d.y < 60 && c.x >= d.x - COLUNA && c.x < d.x + 200)
            .sort((a, b) => a.y - b.y)[0];
        const ajudante = ajudantes
            .filter((a) => Math.abs(a.x - d.x) < COLUNA && a.y < d.y && d.y - a.y < 40)
            .sort((a, b) => b.y - a.y)[0];
        const m = cabecalho ? RE_GRUPO.exec(cabecalho.texto) : null;
        return {
            d,
            numero: m ? Number(m[1]) : null,
            local: m && m[2] ? m[2].trim() : null,
            dirigente: RE_DIRIGENTE.exec(d.texto)[1].trim(),
            ajudante: ajudante ? RE_AJUDANTE.exec(ajudante.texto)[1].trim() : null,
            membros: [],
        };
    });

    for (const item of itens) {
        if (rotulos.has(item)) continue;
        // O dono do nome e o dirigente da mesma coluna mais perto ACIMA dele.
        const dono = grupos
            .filter((g) => Math.abs(g.d.x - item.x) < COLUNA && g.d.y > item.y)
            .sort((a, b) => a.d.y - b.d.y)[0];
        if (dono) dono.membros.push({ nome: item.texto, pioneiro: item.verde, y: item.y });
    }

    const saida = grupos
        .map(({ d, membros, ...g }) => ({
            ...g,
            membros: membros.sort((a, b) => b.y - a.y).map(({ nome, pioneiro }) => ({ nome, pioneiro })),
        }))
        .sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99));

    for (const g of saida) {
        if (g.numero === null) avisos.push(`Não achei o número do grupo de ${g.dirigente}.`);
        if (!g.ajudante) avisos.push(`O grupo de ${g.dirigente} está sem ajudante no documento.`);
        if (g.membros.length === 0) avisos.push(`O grupo de ${g.dirigente} está sem membros no documento.`);
    }
    return { grupos: saida, avisos };
}

// ---------------------------------------------------------------------------
// Casamento com o cadastro (as regras do antigo importar:grupos, sem os nomes)
// ---------------------------------------------------------------------------

/** Sem acento, minusculo e com Z = S ("Luiz"/"Luis", "Souza"/"Sousa" sao a mesma pessoa). */
const semAcento = (t) =>
    String(t || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/z/g, 's');

const chaveNome = (nome) => semAcento(nome).replace(/\s+/g, ' ').trim();

const CONECTIVOS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/** Os nomes "de verdade": sem iniciais soltas ("S.", "d.") nem conectivos. */
function pedacos(nome) {
    return chaveNome(nome)
        .replace(/\./g, '. ')
        .split(/\s+/)
        .map((p) => p.replace(/\.$/, ''))
        .filter((p) => p.length > 1 && !CONECTIVOS.has(p));
}

/** Os nomes com as iniciais: "Paulo B. d. Lima" -> [paulo, b, d, lima] (sem conectivos). */
function pedacosComIniciais(nome) {
    return chaveNome(nome)
        .replace(/\./g, '. ')
        .split(/\s+/)
        .map((t) => t.replace(/\.$/, ''))
        .filter((t) => t.length > 0 && !CONECTIVOS.has(t));
}

/** Prepara o cadastro uma vez: [{ id, nome, chave, pedacos }]. */
function prepararCadastro(irmaos) {
    return irmaos.map((i) => ({ ...i, chave: chaveNome(i.nome), pedacos: pedacos(i.nome) }));
}

/**
 * A pessoa do cadastro, quando a certeza e grande: nome igual, ou um nome contendo o outro com
 * o MESMO primeiro nome ("Maria Clara B. Lima" acha "Maria Clara Barros Lima"). Sem
 * empate: dois candidatos e ninguem e escolhido. Registro de um nome so ("Fulana") so vale se
 * nao houver outro comecando igual.
 */
function acharPessoa(nome, cadastro) {
    const alvo = pedacos(nome);
    if (alvo.length === 0) return null;

    const exato = cadastro.filter((c) => c.chave === chaveNome(nome));
    if (exato.length === 1) return { pessoa: exato[0], criterio: 'nome igual' };

    const contem = cadastro.filter(
        (c) =>
            c.pedacos[0] === alvo[0] &&
            (alvo.every((p) => c.pedacos.includes(p)) || (c.pedacos.length > 0 && c.pedacos.every((p) => alvo.includes(p)))),
    );
    if (contem.length === 1) {
        const soPrimeiroNome = contem[0].pedacos.length === 1;
        const concorrentes = soPrimeiroNome ? cadastro.filter((c) => c.pedacos[0] === contem[0].pedacos[0]).length : 1;
        if (concorrentes === 1) return { pessoa: contem[0], criterio: 'um nome contém o outro' };
    }
    return null;
}

/**
 * O nome do documento pode ser o do cadastro abreviado? Cada pedaco do cadastro aparece, NA
 * ORDEM, por extenso ou pela inicial ("Paulo A. de Lima" x "Paulo Alves de Lima"). Exige o
 * primeiro nome igual. Nunca casa sozinho: vira sugestao para o admin confirmar.
 */
function compativelPorIniciais(doDocumento, doCadastro) {
    const documento = pedacosComIniciais(doDocumento);
    const cadastro = pedacos(doCadastro);
    if (cadastro.length < 2 || documento.length < 2 || documento[0] !== cadastro[0]) return false;
    let i = 0;
    for (const parte of cadastro) {
        while (i < documento.length && documento[i] !== parte && documento[i] !== parte[0]) i += 1;
        if (i >= documento.length) return false;
        i += 1;
    }
    return true;
}

/** Distancia de edicao, para nome com uma letra a mais ou a menos ("Mateuss" x "Mateus"). */
function distancia(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
    }
    return d[a.length][b.length];
}

/** Candidatos para o admin escolher quando nao houve certeza (ate 4). */
function sugestoes(nome, cadastro) {
    const doc = pedacos(nome);
    if (doc.length === 0) return [];
    return cadastro
        .filter((c) => {
            if (c.pedacos.length === 0) return false;
            const primeiro = c.pedacos[0] === doc[0] || (doc[0].length >= 5 && distancia(c.pedacos[0], doc[0]) <= 1);
            if (!primeiro) return false;
            return (
                compativelPorIniciais(nome, c.nome) ||
                c.pedacos.slice(1).some((p) => doc.slice(1).includes(p)) ||
                c.pedacos.length === 1
            );
        })
        .slice(0, 4);
}

/**
 * Quem, entre os membros listados do grupo, e o lider escrito curto no cabecalho
 * ("DIRIGENTE: Paulo Lima" -> o membro "Paulo L. d. Souza"). Primeiro nome igual (ou com
 * uma letra de diferenca) e o resto compativel por inicial ou por extenso. So devolve com um
 * candidato unico.
 */
function liderEntreMembros(nomeCurto, membros) {
    const curto = pedacos(nomeCurto);
    if (curto.length === 0) return null;
    const candidatos = membros.filter((m) => {
        const doc = pedacosComIniciais(m.nome);
        const primeiro = doc[0] === curto[0] || (curto[0].length >= 5 && distancia(doc[0] || '', curto[0]) <= 1);
        if (!primeiro) return false;
        // Cada sobrenome do cabecalho aparece no membro por extenso ou pela inicial.
        return curto.slice(1).every((p) => doc.slice(1).some((t) => t === p || t === p[0]));
    });
    return candidatos.length === 1 ? candidatos[0] : null;
}

/**
 * A previa: para cada nome do documento, quem ele e no cadastro (`irmao`), ou sugestoes para
 * o admin escolher, ou nada (vai ser criado). O lider (dirigente/ajudante) e resolvido pelo
 * membro correspondente do grupo; nao achando, pelo cadastro.
 */
function previa(grupos, irmaos) {
    const cadastro = prepararCadastro(irmaos);
    const resolver = (nome) => {
        const achado = acharPessoa(nome, cadastro);
        if (achado) return { irmao: { id: achado.pessoa.id, nome: achado.pessoa.nome }, criterio: achado.criterio, sugestoes: [] };
        return { irmao: null, criterio: null, sugestoes: sugestoes(nome, cadastro).map((c) => ({ id: c.id, nome: c.nome })) };
    };

    return grupos.map((g) => {
        const membros = g.membros.map((m) => ({ nome: m.nome, pioneiro: m.pioneiro, ...resolver(m.nome) }));
        const lider = (nomeCurto) => {
            if (!nomeCurto) return null;
            const membro = liderEntreMembros(nomeCurto, g.membros);
            if (membro) return { nome: nomeCurto, membro: membro.nome };
            return { nome: nomeCurto, membro: null, ...resolver(nomeCurto) };
        };
        return { numero: g.numero, local: g.local, dirigente: lider(g.dirigente), ajudante: lider(g.ajudante), membros };
    });
}

/** "Grupo de Paulo": o grupo se chama pelo primeiro nome de quem dirige. */
function rotuloDoGrupo(dirigenteNome, reserva) {
    const primeiro = String(dirigenteNome || '').trim().split(/\s+/)[0];
    return primeiro ? `Grupo de ${primeiro}` : reserva || 'Grupo';
}

module.exports = {
    lerItens,
    montarGrupos,
    previa,
    rotuloDoGrupo,
    _internos: { ehVerde, chaveNome, pedacos, acharPessoa, compativelPorIniciais, sugestoes, liderEntreMembros, prepararCadastro },
};
