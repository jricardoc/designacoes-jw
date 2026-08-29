'use strict';

/**
 * Liga a linha "Limpeza:" da programacao aos GRUPOS DE CAMPO — e, por eles, as pessoas.
 *
 * O problema que isto resolve: a programacao escala a limpeza por GRUPO
 * ("Limpeza: Grupo 4 Elvandy LIma & Grupo 5 Luiz Roberto"), mas o app so sabia casar NOME.
 * Resultado: da limpeza inteira, o unico que via alguma coisa era o irmao que da nome ao
 * grupo. Os outros publicadores do grupo — que sao quem de fato limpa — nao ficavam sabendo
 * de nada. Aqui o texto vira grupo, e o grupo vira a lista de gente.
 *
 * O casamento e CONSERVADOR de proposito, no mesmo espirito de MinhasDesignacoesService e de
 * scripts/importarGrupos.js: um fragmento que casa com dois grupos nao casa com nenhum. Avisar
 * o grupo errado que e a semana dele e pior do que nao avisar — o salao fica sujo e ninguem
 * entende por que.
 *
 * Modulo com uma parte PURA (o parser e o casamento, testaveis sem banco por
 * `scripts/verificarLimpezaGrupos.js`) e uma parte que le o banco.
 */

const prisma = require('../prisma');

// ---------------------------------------------------------------------------
// Normalizacao de nome
// ---------------------------------------------------------------------------

/**
 * minusculas, sem acento, so letras — e com Z virando S.
 *
 * A troca de Z por S nao e capricho: o mesmo documento escreve "Luis Roberto" numa semana e
 * "Luiz Roberto" na outra, e as duas grafias sao a mesma pessoa. E a mesma regra que
 * scripts/importarGrupos.js ja usa para casar o cadastro com o documento.
 */
function normalizar(texto) {
    return String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(new RegExp('[\u0300-\u036f]', 'g'), '')
        .replace(/[^a-z]/g, ' ')
        .replace(/z/g, 's')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Palavras significativas: descarta "de", "da", "do" e iniciais soltas. */
function tokens(texto) {
    return normalizar(texto).split(' ').filter(t => t.length > 2);
}

/**
 * Quantas letras um prefixo precisa ter para valer como o mesmo nome.
 *
 * 4 e o menor valor que aceita "elvandy" ~ "elvandyr" (o documento corta o R final) sem
 * aceitar "mar" ~ "marcelo". Abaixo disso, "ant" casaria Antonio com Antunes.
 */
const MINIMO_PREFIXO = 4;

/** Duas palavras sao o mesmo nome? Iguais, ou uma e prefixo da outra com folga. */
function mesmaPalavra(a, b) {
    if (a === b) return true;
    const [curta, longa] = a.length <= b.length ? [a, b] : [b, a];
    return curta.length >= MINIMO_PREFIXO && longa.startsWith(curta);
}

/**
 * Os dois textos nomeiam o mesmo grupo?
 *
 * Exige que TODAS as palavras do nome mais curto encontrem par distinto no mais longo, com no
 * minimo duas palavras casadas. Bater so o primeiro nome nao basta — e o que impede o
 * "Grupo 2 do Átilas Santos" de cair no grupo de um "Átilas Pereira" que venha a existir.
 *
 * Nome de uma palavra so exige igualdade exata, pelo mesmo motivo de MinhasDesignacoesService.
 */
function mesmoNomeDeGrupo(textoA, textoB) {
    const a = tokens(textoA);
    const b = tokens(textoB);
    if (a.length === 0 || b.length === 0) return false;

    if (a.length < 2 || b.length < 2) {
        return a.length === b.length && a.every((t, i) => t === b[i]);
    }

    const [curta, longa] = a.length <= b.length ? [a, b] : [b, a];
    const disponiveis = [...longa];
    let pares = 0;
    for (const palavra of curta) {
        const i = disponiveis.findIndex(outra => mesmaPalavra(palavra, outra));
        if (i === -1) return false;
        disponiveis.splice(i, 1);
        pares += 1;
    }
    return pares >= 2;
}

// ---------------------------------------------------------------------------
// Parser da linha "Limpeza:"
// ---------------------------------------------------------------------------

/**
 * Onde a linha se parte.
 *
 * O corte NAO e feito nos separadores, e sim ANTES de cada "Grupo"/"Grupos" — a fronteira
 * de verdade da linha. A primeira versao cortava so em "&", "/" e ",", e a producao mostrou
 * por que isso nao basta: metade das semanas usa " e " ("Grupo 2 do Átilas Santos e Grupo 5
 * do Elvandy Lima"). A linha inteira virava um fragmento so, batia com DOIS grupos, e o
 * criterio conservador recusava os dois — perdendo as duas metades em vez de nenhuma.
 *
 * E " e " nao pode simplesmente entrar na lista de separadores: ele faz parte de nomes reais
 * ("Olga Pereira e Souza"), e cortar ali partiria a pessoa ao meio. Cortar antes de "Grupo"
 * resolve os dois casos de uma vez, e ainda aguenta separador nenhum.
 *
 * Os separadores continuam na expressao para a linha que, por algum motivo, listar os grupos
 * sem repetir a palavra ("Grupo 1 Edilson & Marcelo Santana").
 */
const SEPARADORES = /[/&,]|(?=\bgrupos?\b)/i;

/** Sobra de separador no fim do pedaco depois do corte ("... Santos e ", "... Santos & "). */
const SOBRA = /(?:\s+e|[&/,])\s*$/i;

/** Texto que aparece no lugar do grupo quando ainda nao ha escala. */
const LIXO = new Set(['', '-', '--', 'a definir', 'a definir.', 'x']);

/**
 * Quebra "Grupos 5 do Luis Roberto & Grupo 1 Edilson Santos" em fragmentos com numero e nome.
 *
 * O numero e o pedaco ESTAVEL da linha: o nome chega abreviado ("Elvandy" por "Elvandyr"),
 * com caixa trocada ("LIma") e com Z/S trocados, mas "Grupo 4" e sempre "Grupo 4". Por isso
 * ele e extraido em separado, e nao deixado dentro do nome.
 *
 * @returns {{ numero: number|null, nome: string, bruto: string }[]}
 */
function separarFragmentos(limpeza) {
    const texto = String(limpeza || '').trim();
    if (!texto || LIXO.has(texto.toLowerCase())) return [];

    return texto
        .split(SEPARADORES)
        // O corte por lookahead deixa o separador no FIM do pedaco anterior ("Átilas Santos
        // e "), e nao no comeco do seguinte. Sem tirar isso, o "e" solto entraria no nome.
        .map(pedaco => pedaco.trim().replace(SOBRA, '').trim())
        .filter(pedaco => pedaco && !LIXO.has(pedaco.toLowerCase()))
        .map(bruto => {
            // "Grupos 5 do Luis Roberto" -> numero 5, nome "Luis Roberto".
            // O "do/da/de" e opcional porque o documento usa os dois jeitos na mesma pagina.
            const m = /^\s*grupos?\s*(\d+)?\s*(?:d[oae]\s+)?(.*)$/i.exec(bruto);
            if (!m) return { numero: null, nome: bruto, bruto };
            return {
                numero: m[1] ? Number(m[1]) : null,
                nome: (m[2] || '').trim(),
                bruto,
            };
        })
        .filter(f => f.numero !== null || tokens(f.nome).length > 0);
}

/**
 * A que grupo este fragmento se refere?
 *
 * O NUMERO ganha do nome quando o grupo tem numero gravado: ele e o pedaco que o documento
 * escreve sempre igual. O nome entra quando nao ha numero em jogo — e e o unico criterio
 * enquanto ninguem tiver rodado `npm run vincular:limpeza`.
 *
 * Empate nao casa: dois grupos batendo com o mesmo fragmento devolve null, e quem chamou
 * decide o que fazer com a duvida.
 *
 * @returns {{ grupo: object|null, criterio: 'numero'|'nome'|null, ambiguo: boolean }}
 */
function casarFragmento(fragmento, grupos) {
    if (fragmento.numero !== null) {
        const porNumero = grupos.filter(g => g.numero === fragmento.numero);
        if (porNumero.length === 1) return { grupo: porNumero[0], criterio: 'numero', ambiguo: false };
        if (porNumero.length > 1) return { grupo: null, criterio: null, ambiguo: true };
    }

    if (tokens(fragmento.nome).length === 0) return { grupo: null, criterio: null, ambiguo: false };

    const porNome = grupos.filter(g => mesmoNomeDeGrupo(g.nome, fragmento.nome));
    if (porNome.length === 1) return { grupo: porNome[0], criterio: 'nome', ambiguo: false };
    return { grupo: null, criterio: null, ambiguo: porNome.length > 1 };
}

/**
 * Os grupos escalados numa semana.
 *
 * @returns {{ grupos: object[], naoCasados: object[] }} `naoCasados` alimenta os avisos do
 * script de verificacao: fragmento que ninguem reconheceu e grupo que ficou sem ser avisado,
 * e isso precisa aparecer para alguem em vez de sumir em silencio.
 */
function gruposDaSemana(limpeza, grupos) {
    const encontrados = [];
    const naoCasados = [];

    for (const fragmento of separarFragmentos(limpeza)) {
        const { grupo, criterio, ambiguo } = casarFragmento(fragmento, grupos);
        if (!grupo) {
            naoCasados.push({ ...fragmento, ambiguo });
            continue;
        }
        if (!encontrados.some(e => e.grupo.id === grupo.id)) {
            encontrados.push({ grupo, criterio, fragmento });
        }
    }

    return { grupos: encontrados, naoCasados };
}

/** Um numero recente so vale contra o passado se mais de uma semana o confirmar. */
const MINIMO_APOIO = 2;

/**
 * Aprende o numero de cada grupo a partir dos textos da programacao.
 *
 * A logica base: quando um fragmento casa por NOME e traz um numero, aquele numero e o do
 * grupo. O que complica e que a numeracao MUDA — a congregacao ja teve seis grupos (havia um
 * "Grupo 3 do Helber Dias" em Marco/2026), e quando um grupo sai os outros sao renumerados.
 * O historico entao contradiz o presente de propria autoria, sem erro nenhum envolvido.
 *
 * Por isso a regra e por RECENCIA, e nao por unanimidade: vale o numero das semanas mais
 * novas, desde que ao menos `MINIMO_APOIO` semanas o usem. O apoio minimo e o que impede um
 * erro de digitacao na ultima semana de renumerar o grupo sozinho; e a recencia e o que
 * impede o passado, que e mais volumoso, de congelar a numeracao antiga para sempre.
 *
 * @param {{texto: string, quando?: string}[]} entradas em qualquer ordem; `quando` e uma
 *        chave cronologica ordenavel (a data ISO da reuniao). Sem ela, a entrada conta como
 *        a mais antiga — nunca como a mais nova, para nao decidir a numeracao.
 * @returns {{ aprendidos: Map<number, number>, conflitos: object[] }} os conflitos vem
 *        SEMPRE, inclusive os resolvidos: quem roda o script precisa ver que houve
 *        divergencia e qual numero ganhou.
 */
function aprenderNumeros(entradas, grupos) {
    const ordenadas = [...entradas].sort(
        (a, b) => String(a.quando || '').localeCompare(String(b.quando || ''))
    );

    // grupoId -> numeros observados, do mais antigo para o mais recente.
    const vistos = new Map();
    for (const { texto } of ordenadas) {
        for (const fragmento of separarFragmentos(texto)) {
            if (fragmento.numero === null) continue;
            const casados = grupos.filter(g => mesmoNomeDeGrupo(g.nome, fragmento.nome));
            if (casados.length !== 1) continue;
            const id = casados[0].id;
            if (!vistos.has(id)) vistos.set(id, []);
            vistos.get(id).push(fragmento.numero);
        }
    }

    const aprendidos = new Map();
    const conflitos = [];

    for (const [grupoId, lista] of vistos) {
        const recente = lista[lista.length - 1];
        const descartados = [...new Set(lista.filter(n => n !== recente))].sort((a, b) => a - b);

        if (descartados.length === 0) {
            aprendidos.set(grupoId, recente);
            continue;
        }

        const apoio = lista.filter(n => n === recente).length;
        if (apoio >= MINIMO_APOIO) {
            aprendidos.set(grupoId, recente);
            conflitos.push({ grupoId, numero: recente, apoio, descartados, resolvido: true });
        } else {
            // O numero mais novo aparece uma vez so e briga com o passado: pode ser
            // renumeracao comecando ou pode ser engano, e nao da para saber qual.
            conflitos.push({ grupoId, numeros: [...new Set(lista)].sort((a, b) => a - b), resolvido: false });
        }
    }

    return { aprendidos, conflitos };
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

/**
 * Os grupos com a lista de quem esta em cada um.
 *
 * "Estar no grupo" inclui o DIRIGENTE e o AJUDANTE, e nao so os publicadores: os dois moram
 * no grupo (ver GrupoCampo no schema) e nada garante que tambem estejam na lista de
 * publicadores dele. Deixa-los de fora tiraria da limpeza justamente quem a organiza.
 */
async function carregarGrupos() {
    const grupos = await prisma.grupoCampo.findMany({
        where: { ativo: true },
        select: {
            id: true,
            nome: true,
            numero: true,
            ordem: true,
            dirigenteId: true,
            ajudanteId: true,
            publicadores: { select: { id: true } },
        },
        orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });

    return grupos.map(g => ({
        ...g,
        integrantes: [...new Set([
            ...g.publicadores.map(p => p.id),
            ...(g.dirigenteId ? [g.dirigenteId] : []),
            ...(g.ajudanteId ? [g.ajudanteId] : []),
        ])],
    }));
}

/** O grupo (se houver) a que este irmao pertence. */
function grupoDoIrmao(irmaoId, grupos) {
    if (!irmaoId) return null;
    return grupos.find(g => g.integrantes.includes(irmaoId)) || null;
}

module.exports = {
    carregarGrupos,
    grupoDoIrmao,
    gruposDaSemana,
    separarFragmentos,
    casarFragmento,
    aprenderNumeros,
    _internos: { normalizar, tokens, mesmaPalavra, mesmoNomeDeGrupo, MINIMO_PREFIXO, MINIMO_APOIO },
};
