'use strict';

/**
 * Leitura dos mapas do Google My Maps.
 *
 * Todo mapa do My Maps compartilhado como "qualquer pessoa com o link" exporta um KML publico
 * em /maps/d/kml?mid=<id>. E por ele que o app importa os territorios: cada CAMADA (Folder) e
 * um territorio, cada POLIGONO dela e uma quadra. O My Maps nao tem API de escrita — desenhar
 * continua sendo la; aqui so se le.
 *
 * O parser e de proposito pequeno e sem dependencia: o KML do My Maps e plano (camadas nao se
 * aninham) e regular. O que nao e poligono (pino, linha) e contado e ignorado.
 */

const LIMITE_BYTES = 5 * 1024 * 1024;

/** O `mid` de um link do My Maps (edit, viewer, embed ou kml), ou o proprio id colado. */
function extrairMid(link) {
    const texto = String(link || '').trim();
    const daUrl = /[?&]mid=([A-Za-z0-9_-]+)/.exec(texto);
    const mid = daUrl ? daUrl[1] : texto;
    return /^[A-Za-z0-9_-]{10,80}$/.test(mid) ? mid : null;
}

async function baixarKml(mid) {
    const resposta = await fetch(`https://www.google.com/maps/d/kml?mid=${mid}&forcekml=1`, {
        signal: AbortSignal.timeout(15000),
        redirect: 'follow',
    });
    if (!resposta.ok) {
        throw new Error(resposta.status === 404 || resposta.status === 403
            ? 'Mapa não encontrado. Confira o link e se o mapa está compartilhado como "qualquer pessoa com o link".'
            : `O Google respondeu ${resposta.status} ao baixar o mapa.`);
    }
    const texto = await resposta.text();
    if (texto.length > LIMITE_BYTES) throw new Error('Mapa grande demais para importar.');
    if (!texto.includes('<kml')) {
        throw new Error('O link não devolveu um mapa. O mapa precisa estar compartilhado como "qualquer pessoa com o link".');
    }
    return texto;
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Texto de um elemento XML: tira CDATA, decodifica entidades, apara (inclusive &nbsp;). */
function texto(bruto) {
    if (bruto == null) return '';
    return String(bruto)
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
            if (e[0] === '#') {
                const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
                return Number.isFinite(n) ? String.fromCodePoint(n) : m;
            }
            return ENTIDADES[e.toLowerCase()] ?? m;
        })
        .replace(/\s+/g, ' ')
        .trim();
}

const primeiro = (xml, tag) => {
    const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml);
    return m ? m[1] : null;
};

const todos = (xml, tag) =>
    [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => m[1]);

/** "lng,lat,alt lng,lat,alt ..." -> [[lat, lng], ...], sem repetir o ponto que fecha o anel. */
function lerCoordenadas(bruto) {
    const pontos = String(bruto || '').trim().split(/\s+/).map((par) => {
        const [lng, lat] = par.split(',').map(Number);
        return [Math.round(lat * 1e7) / 1e7, Math.round(lng * 1e7) / 1e7];
    }).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    const [a, z] = [pontos[0], pontos[pontos.length - 1]];
    if (pontos.length > 1 && a[0] === z[0] && a[1] === z[1]) pontos.pop();
    return pontos;
}

/** O My Maps poe a cor no id do estilo: "#poly-0288D1-3301-77-nodesc". */
function corDoEstilo(styleUrl) {
    const m = /poly-([0-9A-F]{6})/i.exec(styleUrl || '');
    return m ? `#${m[1].toUpperCase()}` : null;
}

function lerPlacemarks(xml) {
    const quadras = [];
    let ignorados = 0;
    for (const p of todos(xml, 'Placemark')) {
        const contorno = primeiro(p, 'outerBoundaryIs');
        const pontos = contorno ? lerCoordenadas(primeiro(contorno, 'coordinates')) : [];
        if (pontos.length < 3) {
            ignorados++;
            continue;
        }
        quadras.push({
            nome: texto(primeiro(p, 'name')) || `Quadra ${quadras.length + 1}`,
            cor: corDoEstilo(texto(primeiro(p, 'styleUrl'))),
            pontos,
        });
    }
    return { quadras, ignorados };
}

/**
 * KML -> { nomeMapa, camadas: [{ nome, cor, quadras: [{ nome, cor, pontos }] }], ignorados }.
 * Camada sem nenhum poligono fica de fora (o My Maps exporta a camada vazia da importacao).
 */
function lerKml(xml) {
    const documento = primeiro(xml, 'Document') || xml;
    const nomeMapa = texto(primeiro(documento.split('<Folder')[0], 'name'));
    const camadas = [];
    let ignorados = 0;

    for (const pasta of todos(documento, 'Folder')) {
        const nome = texto(primeiro(pasta.split('<Placemark')[0], 'name'));
        const lidos = lerPlacemarks(pasta);
        ignorados += lidos.ignorados;
        if (lidos.quadras.length === 0) continue;
        camadas.push({ nome: nome || `Camada ${camadas.length + 1}`, cor: lidos.quadras[0].cor, quadras: lidos.quadras });
    }

    // Poligonos fora de qualquer camada viram uma camada com o nome do mapa.
    const soltos = lerPlacemarks(documento.replace(/<Folder\b[\s\S]*?<\/Folder>/g, ''));
    ignorados += soltos.ignorados;
    if (soltos.quadras.length > 0) {
        camadas.push({ nome: nomeMapa || 'Sem camada', cor: soltos.quadras[0].cor, quadras: soltos.quadras });
    }

    return { nomeMapa, camadas, ignorados };
}

/** Ponto [lat, lng] dentro do poligono [[lat, lng], ...]? (ray casting) */
function dentro([lat, lng], pontos) {
    let dentroDele = false;
    for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
        const [yi, xi] = pontos[i];
        const [yj, xj] = pontos[j];
        if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
            dentroDele = !dentroDele;
        }
    }
    return dentroDele;
}

// --- sugestao de numero ------------------------------------------------------

const PALAVRAS_VAZIAS = new Set(['r', 'rua', 'av', 'avenida', 'tv', 'travessa', 'qd', 'quadra', 'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o']);

function palavras(nome) {
    return new Set(String(nome || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(p => p && !PALAVRAS_VAZIAS.has(p)));
}

/** Quantas palavras de `b` aparecem em `a`, de 0 a 1. */
function cobertura(a, b) {
    if (b.size === 0) return 0;
    let comuns = 0;
    for (const p of b) if (a.has(p)) comuns++;
    return comuns / b.size;
}

/**
 * Numero sugerido para cada camada, comparando o nome da camada e das quadras com o nome dos
 * territorios que ja existem. So sugere com boa semelhanca e sem repetir numero; o que sobra
 * fica em branco para quem importa decidir. Devolve um array alinhado a `camadas`.
 *
 * A nota mistura quanto do nome do territorio aparece na camada (contando as quadras, que
 * costumam trazer o nome da rua) com quanto do nome da CAMADA aparece no territorio — e esta
 * segunda parte que separa "Casinhas 1" de "Casinhas - Tokaia" diante de "Casinhas 1".
 *
 * @param {Array<{nome: string, quadras: Array<{nome: string}>}>} camadas
 * @param {Array<{numero: string, nome: string}>} existentes
 */
function sugerirNumeros(camadas, existentes) {
    const pares = [];
    camadas.forEach((camada, i) => {
        const daCamada = palavras(camada.nome);
        const comQuadras = new Set([...daCamada, ...camada.quadras.flatMap(q => [...palavras(q.nome)])]);
        for (const t of existentes) {
            const doTerritorio = palavras(t.nome);
            const nota = 0.6 * cobertura(comQuadras, doTerritorio) + 0.4 * cobertura(doTerritorio, daCamada);
            if (nota >= 0.5) pares.push({ i, numero: t.numero, nota });
        }
    });
    pares.sort((a, b) => b.nota - a.nota);
    const sugestao = camadas.map(() => null);
    const usados = new Set();
    for (const { i, numero } of pares) {
        if (sugestao[i] !== null || usados.has(numero)) continue;
        sugestao[i] = numero;
        usados.add(numero);
    }
    return sugestao;
}

module.exports = { extrairMid, baixarKml, lerKml, dentro, sugerirNumeros, _internos: { texto, lerCoordenadas, corDoEstilo } };
