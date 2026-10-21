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

// --- contorno das areas ------------------------------------------------------

/**
 * A linha que envolve cada area por FORA das suas quadras, a `folga` metros, fechando as ruas
 * entre elas ate `ponte` metros. Entra [{ nome, poligonos: [[[lat, lng]]] }], sai
 * [{ nome, aneis: [[[lat, lng]]] }] — um anel por pedaco separado da area.
 *
 * O envoltorio convexo, mais simples, nao serve: area em "L" engole o canto da vizinha e as
 * linhas se cruzam. Aqui tudo vira um grid de `passo` metros: cada area e engordada e afinada
 * de novo (fechamento morfologico), cada celula fica com a area mais proxima (assim duas areas
 * separadas por uma rua dividem a rua ao meio, sem uma cobrir a outra), e a borda do que sobrou
 * vira o anel. Sem biblioteca de geometria.
 */
function contornarAreas(areas, { passo = 8, ponte = 50, folga = 14 } = {}) {
    const entrada = areas
        .map(a => ({ nome: a.nome, poligonos: a.poligonos.filter(p => p.length >= 3) }))
        .filter(a => a.poligonos.length > 0);
    if (entrada.length === 0) return [];
    const [lat0, lng0] = entrada[0].poligonos[0][0];
    const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
    const ky = 110540;
    // [y, x] em metros: a mesma ordem de [lat, lng], para o `dentro` servir aqui tambem.
    const emMetros = entrada.map(a => a.poligonos.map(p => p.map(([lat, lng]) => [(lat - lat0) * ky, (lng - lng0) * kx])));
    const fechar = Math.ceil(ponte / 2 / passo);
    const engordar = fechar + Math.ceil(folga / passo);
    const margem = (engordar + 2) * passo;
    const todos = emMetros.flat(2);
    const y0 = Math.min(...todos.map(p => p[0])) - margem;
    const x0 = Math.min(...todos.map(p => p[1])) - margem;
    const L = Math.ceil((Math.max(...todos.map(p => p[1])) + margem - x0) / passo);
    const A = Math.ceil((Math.max(...todos.map(p => p[0])) + margem - y0) / passo);
    const celula = (y, x) => Math.floor((y - y0) / passo) * L + Math.floor((x - x0) / passo);

    const rasterizar = (poligonos) => {
        const g = new Uint8Array(L * A);
        for (const p of poligonos) {
            const de = celula(Math.min(...p.map(q => q[0])), Math.min(...p.map(q => q[1])));
            const ate = celula(Math.max(...p.map(q => q[0])), Math.max(...p.map(q => q[1])));
            for (let j = Math.floor(de / L); j <= Math.floor(ate / L); j++) {
                for (let i = de % L; i <= ate % L; i++) {
                    if (dentro([y0 + (j + 0.5) * passo, x0 + (i + 0.5) * passo], p)) g[j * L + i] = 1;
                }
            }
            // E as celulas por onde a borda passa: sem elas, a quadra mais fina que o passo nao
            // cobre centro nenhum, e a beirada de qualquer quadra ficaria para fora do contorno.
            p.forEach((a, n) => {
                const b = p[(n + 1) % p.length];
                const trechos = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (passo / 2)) || 1;
                for (let t = 0; t <= trechos; t++) {
                    g[celula(a[0] + ((b[0] - a[0]) * t) / trechos, a[1] + ((b[1] - a[1]) * t) / trechos)] = 1;
                }
            });
        }
        return g;
    };
    const disco = (r) => {
        const d = [];
        for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (di * di + dj * dj <= r * r) d.push([dj, di]);
        return d;
    };
    const dilatar = (g, r, valor) => {
        const saida = Uint8Array.from(g);
        const d = disco(r);
        for (let c = 0; c < g.length; c++) {
            if (g[c] !== valor) continue;
            const j = Math.floor(c / L);
            const i = c % L;
            for (const [dj, di] of d) {
                const jj = j + dj;
                const ii = i + di;
                if (jj >= 0 && jj < A && ii >= 0 && ii < L) saida[jj * L + ii] = valor;
            }
        }
        return saida;
    };
    const vizinhos = (c) => {
        const j = Math.floor(c / L);
        const i = c % L;
        return [[j - 1, i], [j + 1, i], [j, i - 1], [j, i + 1], [j - 1, i - 1], [j - 1, i + 1], [j + 1, i - 1], [j + 1, i + 1]]
            .filter(([jj, ii]) => jj >= 0 && jj < A && ii >= 0 && ii < L)
            .map(([jj, ii]) => jj * L + ii);
    };

    const quadras = emMetros.map(rasterizar);
    // Dono de cada celula: a area cuja quadra esta mais perto (busca em largura a partir de todas).
    const dono = new Int16Array(L * A).fill(-1);
    let fila = [];
    quadras.forEach((g, k) => g.forEach((v, c) => {
        if (v && dono[c] < 0) {
            dono[c] = k;
            fila.push(c);
        }
    }));
    while (fila.length > 0) {
        const proxima = [];
        for (const c of fila) {
            for (const n of vizinhos(c)) {
                if (dono[n] < 0) {
                    dono[n] = dono[c];
                    proxima.push(n);
                }
            }
        }
        fila = proxima;
    }

    return entrada.map((area, k) => {
        // Engorda (fecha as ruas e da a folga) e afina de volta so o que fechou as ruas.
        const g = dilatar(dilatar(quadras[k], engordar, 1), fechar, 0);
        // Fica so com o que e desta area: duas areas vizinhas se encontram no meio da rua. A
        // propria quadra nunca sai (rua estreita demais para a folga: o contorno encosta nela).
        for (let c = 0; c < g.length; c++) {
            if (g[c] && !quadras[k][c] && dono[c] !== k) g[c] = 0;
        }
        return { nome: area.nome, aneis: tracarBorda(g, L, A).map(anel => {
            const liso = suavizar(simplificar([...anel, anel[0]].map(([j, i]) => [y0 + j * passo, x0 + i * passo]), passo));
            return liso.map(([y, x]) => [+(lat0 + y / ky).toFixed(6), +(lng0 + x / kx).toFixed(6)]);
        }) };
    });
}

/**
 * Aneis [[j, i]] da borda das celulas cheias de um grid L x A. Cada borda entre cheia e vazia
 * e orientada com a cheia a esquerda: as de fora fecham aneis anti-horarios (area positiva);
 * buracos, horarios — e esses ficam de fora.
 */
function tracarBorda(g, L, A) {
    const cheia = (j, i) => j >= 0 && j < A && i >= 0 && i < L && g[j * L + i] === 1;
    const saindo = new Map();
    const borda = (a, b) => {
        const k = `${a[0]},${a[1]}`;
        saindo.set(k, [...(saindo.get(k) || []), b]);
    };
    for (let j = 0; j < A; j++) {
        for (let i = 0; i < L; i++) {
            if (!cheia(j, i)) continue;
            if (!cheia(j - 1, i)) borda([j, i], [j, i + 1]);
            if (!cheia(j, i + 1)) borda([j, i + 1], [j + 1, i + 1]);
            if (!cheia(j + 1, i)) borda([j + 1, i + 1], [j + 1, i]);
            if (!cheia(j, i - 1)) borda([j + 1, i], [j, i]);
        }
    }
    const aneis = [];
    for (const [inicio, destinos] of saindo) {
        while (destinos.length > 0) {
            const anel = [inicio.split(',').map(Number)];
            let atual = destinos.shift();
            while (`${atual[0]},${atual[1]}` !== inicio) {
                anel.push(atual);
                // ponytail: celulas que se tocam so na quina tem duas saidas no mesmo vertice;
                // pega a primeira e o anel fecha do mesmo jeito (talvez juntando os dois pedacos).
                atual = saindo.get(`${atual[0]},${atual[1]}`).shift();
            }
            let dobro = 0;
            for (let n = 0; n < anel.length; n++) {
                const [ya, xa] = anel[n];
                const [yb, xb] = anel[(n + 1) % anel.length];
                dobro += xa * yb - xb * ya;
            }
            if (dobro > 0) aneis.push(anel);
        }
    }
    return aneis;
}

/** Douglas-Peucker: tira os degraus do grid, mantendo os pontos que mudam a forma. */
function simplificar(pontos, tolerancia) {
    if (pontos.length < 3) return pontos;
    const [a, b] = [pontos[0], pontos[pontos.length - 1]];
    const comprimento = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let maior = 0;
    let onde = 0;
    for (let n = 1; n < pontos.length - 1; n++) {
        const [y, x] = pontos[n];
        const d = comprimento === 1 && a[0] === b[0] && a[1] === b[1]
            ? Math.hypot(y - a[0], x - a[1])
            : Math.abs((b[1] - a[1]) * (a[0] - y) - (a[1] - x) * (b[0] - a[0])) / comprimento;
        if (d > maior) [maior, onde] = [d, n];
    }
    if (maior <= tolerancia) return [a, b];
    return [...simplificar(pontos.slice(0, onde + 1), tolerancia).slice(0, -1), ...simplificar(pontos.slice(onde), tolerancia)];
}

/** Chaikin, duas voltas: arredonda as quinas do anel fechado. */
function suavizar(anel) {
    let pontos = anel.slice(0, -1);
    for (let volta = 0; volta < 2; volta++) {
        pontos = pontos.flatMap((p, n) => {
            const q = pontos[(n + 1) % pontos.length];
            return [
                [0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]],
                [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]],
            ];
        });
    }
    return [...pontos, pontos[0]];
}

/** Cor da linha de um KML (`<LineStyle><color>aabbggrr`) em "#RRGGBB", ou null. */
function corDaLinha(xml) {
    const m = /<LineStyle\b[\s\S]*?<color[^>]*>\s*[0-9a-f]{2}([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})\s*</i.exec(xml || '');
    return m ? `#${m[3]}${m[2]}${m[1]}`.toUpperCase() : null;
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

module.exports = { extrairMid, baixarKml, lerKml, dentro, contornarAreas, corDaLinha, sugerirNumeros, _internos: { texto, lerCoordenadas, corDoEstilo } };
