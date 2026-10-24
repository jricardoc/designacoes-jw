/**
 * Conferência do tutorial e das novidades: node --no-warnings scripts/verificarTour.mjs
 *
 * - as contas do recorte e do cartão (alvo fora da tela, cartão sem lugar embaixo, letra grande);
 * - os passos: cada alvo existe em alguma tela (um nome errado deixaria o passo sem destaque),
 *   cada aba é uma aba do ambiente, e o menu só aparece no Servir Mais;
 * - as novidades: título e texto em cada uma, sem repetir.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cantoDoVeu, faixasDoVeu, mudou, raioDo, recorte, topoDoCartao } from "../src/tour/geometria.ts";
import { NOVIDADES, VERSAO_NOVIDADES } from "../src/tour/novidades.ts";
import { TOURS } from "../src/tour/passos.ts";

let falhas = 0;
const ok = (condicao, descricao) => {
  console.log(`${condicao ? "   ok  " : "   FALHA"} ${descricao}`);
  if (!condicao) falhas += 1;
};

console.log("recorte");
const tela = { w: 390, h: 844 };
ok(JSON.stringify(recorte({ x: 20, y: 100, w: 50, h: 40 }, tela)) === JSON.stringify({ x: 14, y: 94, w: 62, h: 52 }), "à vista: o alvo com a folga");
ok(recorte({ x: 20, y: 830, w: 50, h: 40 }, tela) === null, "quase todo fora da tela: sem recorte (o cartão vai para o meio)");
ok(recorte({ x: 0, y: 820, w: 50, h: 30 }, tela).h <= 844 - 814, "um pouco fora: cortado na borda");
ok(recorte({ x: 20, y: 100, w: 0, h: 40 }, tela) === null && recorte({ x: NaN, y: 0, w: 10, h: 10 }, tela) === null, "sem tamanho ou medida ruim: sem recorte");
ok(recorte({ x: -500, y: 100, w: 50, h: 40 }, tela) === null, "rolado para fora: sem recorte");

console.log("cartão");
const area = { w: 390, h: 844, topo: 47, base: 34 };
const noTopo = { x: 10, y: 50, w: 40, h: 40 };
const naBarra = { x: 150, y: 760, w: 60, h: 60 };
ok(topoDoCartao(noTopo, area, 200) === 50 + 40 + 14, "alvo em cima: cartão embaixo dele");
ok(topoDoCartao(naBarra, area, 200) === 760 - 14 - 200, "alvo na barra: cartão em cima dele");
ok(topoDoCartao(null, area, 200) === (844 - 200) / 2, "sem alvo: no meio");
const grande = topoDoCartao({ x: 0, y: 380, w: 390, h: 80 }, area, 420);
ok(grande === 844 - 34 - 14 - 420, "sem lugar nem em cima nem embaixo (letra grande): encosta embaixo, acima da barra de gestos");
ok(topoDoCartao(null, area, 900) >= area.topo, "cartão maior que a tela: não passa do entalhe");
ok(raioDo({ x: 0, y: 0, w: 60, h: 40 }, "circulo") === 20 && raioDo({ x: 0, y: 0, w: 200, h: 80 }) === 16, "raio do recorte");
ok(!mudou({ x: 1, y: 1, w: 10, h: 10 }, { x: 1.4, y: 1, w: 10, h: 10 }) && mudou({ x: 1, y: 1, w: 10, h: 10 }, { x: 4, y: 1, w: 10, h: 10 }), "meio ponto de diferença não é mudança");

console.log("véu em faixas");
// Onde a faixa W×H vai parar com o transform (escala em volta do centro, depois o deslocamento).
const caixa = (t, W, H) => {
  const k = t.scaleY ?? 1;
  const y = (t.translateY ?? 0) + H / 2 - (k * H) / 2;
  return { x0: t.translateX ?? 0, x1: (t.translateX ?? 0) + W, y0: y, y1: y + k * H };
};
const dentro = (c, x, y) => x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1;
const ladrilha = (furo, W, H, pr, larguraTela, alturaTela) => {
  const f = faixasDoVeu(furo, W, H, pr);
  const pecas = [f.cima, f.baixo, f.esquerda, f.direita].map((t) => caixa(t, W, H));
  const px = (v) => Math.round(v * pr) / pr;
  const miolo = { x0: px(furo.x), x1: px(furo.x + furo.w), y0: px(furo.y), y1: px(furo.y + furo.h) };
  // Centro de cada pixel do aparelho: coberto por exatamente uma peça (as faixas ou o recorte).
  for (let i = 0; i < larguraTela * pr; i += 3) {
    for (let j = 0; j < alturaTela * pr; j += 3) {
      const x = (i + 0.5) / pr;
      const y = (j + 0.5) / pr;
      const n = pecas.filter((c) => dentro(c, x, y)).length + (dentro(miolo, x, y) ? 1 : 0);
      if (n !== 1) return false;
    }
  }
  return true;
};
ok(ladrilha({ x: 20.4, y: 100.7, w: 50.2, h: 40.9 }, 590, 1044, 3, 390, 844), "recorte no meio: as faixas cobrem a tela sem fresta nem sobra");
ok(ladrilha({ x: 150.3, y: 760.1, w: 64, h: 64 }, 590, 1044, 2.75, 390, 844), "recorte na barra, outra densidade de tela");
ok(ladrilha({ x: 195, y: 422, w: 0, h: 0 }, 590, 1044, 3, 390, 844), "recorte fechado: véu inteiro");
ok(ladrilha({ x: 0, y: 0, w: 390, h: 60 }, 590, 1044, 3, 390, 844), "recorte encostado no topo e nas laterais");
const c = cantoDoVeu({ x: 20, y: 100, w: 50, h: 40 }, 16, true, true, 3, 40);
const cc = { x0: c.translateX + 20 - (40 * c.scale) / 2, y0: c.translateY + 20 - (40 * c.scale) / 2 };
ok(Math.abs(cc.x0 - (70 - 16)) < 1e-9 && Math.abs(cc.y0 - (140 - 16)) < 1e-9 && Math.abs(c.scale - 0.4) < 1e-9, "o canto vai ao raio e encosta no canto do recorte");

console.log("passos");
const raiz = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel) => readFileSync(join(raiz, rel), "utf8");
const arquivos = (dir) =>
  readdirSync(join(raiz, dir)).flatMap((n) => {
    const rel = join(dir, n);
    return statSync(join(raiz, rel)).isDirectory() ? arquivos(rel) : /\.tsx?$/.test(n) ? [rel] : [];
  });
const codigo = [...arquivos("app"), ...arquivos("src")].map(ler).join("\n");
const estaticos = new Set([...codigo.matchAll(/alvoTour\("([^"]+)"\)/g)].map((m) => m[1]));

// As abas de cada ambiente, lidas das barras (só as definições de aba: chave, rótulo, ícone).
const abasDe = (rel) => new Set([...ler(rel).matchAll(/chave: "(\w+)", rotulo: "[^"]*", (?:href: "[^"]*", )?icone: "[^"]*", iconeAtivo/g)].map((m) => m[1]));
const BARRAS = {
  servir: "src/components/layout/abas.ts",
  ministerio: "src/components/ministerio/BarraMinisterio.tsx",
  territorio: "src/components/territorio/BarraTerritorio.tsx",
  estudo: "src/components/estudo/BarraEstudo.tsx",
};
const ABAS = Object.fromEntries(Object.entries(BARRAS).map(([a, rel]) => [a, abasDe(rel)]));
ok(ABAS.servir.has("minhas") && ABAS.ministerio.has("agenda") && ABAS.territorio.has("painel") && ABAS.estudo.has("rotina"), "as abas das quatro barras foram lidas");
const barraComTour = (a) => a !== "servir" && ler(BARRAS[a]).includes(`tour="${a}"`);
ok(ler("src/components/layout/BarraAmbiente.tsx").includes("alvoTour(`${tour}.aba.${aba.chave}`)") && ler("src/components/layout/BarraAmbiente.tsx").includes("alvoTour(`${tour}.mais`)"), "a barra dos ambientes registra as abas e o +");
ok(ler("src/components/layout/BarraFlutuante.tsx").includes("alvoTour(`servir.aba.${aba.chave}`)"), "a barra do Servir Mais registra as abas");
ok(ler("src/components/layout/Ambientes.tsx").includes("alvoTour(`${atual}.marca`)"), "o cabeçalho do Território e do Estudo registra a marca");

const registrado = (id) => {
  if (estaticos.has(id)) return true;
  const [a, parte, chave] = id.split(".");
  if (parte === "aba") return a === "servir" ? ABAS.servir.has(chave) : barraComTour(a) && ABAS[a]?.has(chave);
  if (parte === "mais" && id.split(".").length === 2) return barraComTour(a);
  if (parte === "marca" && id.split(".").length === 2) return a === "territorio" || a === "estudo";
  return false;
};

for (const [ambiente, passos] of Object.entries(TOURS)) {
  const semAlvo = (p) => !p.alvo;
  ok(semAlvo(passos[0]) && !!passos[0].icone && semAlvo(passos.at(-1)), `${ambiente}: começa e termina com o cartão no meio`);
  ok(passos.every((p) => p.titulo && p.texto && p.texto.length <= 230), `${ambiente}: todo passo tem título e texto curto`);
  const perdidos = passos.filter((p) => p.alvo && !registrado(p.alvo)).map((p) => p.alvo);
  ok(perdidos.length === 0, `${ambiente}: todo alvo está registrado numa tela${perdidos.length ? ` (faltam ${perdidos.join(", ")})` : ""}`);
  const abasErradas = passos.filter((p) => p.aba && !ABAS[ambiente].has(p.aba)).map((p) => p.aba);
  ok(abasErradas.length === 0, `${ambiente}: toda aba é do ambiente${abasErradas.length ? ` (${abasErradas.join(", ")})` : ""}`);
  ok(ambiente === "servir" || passos.every((p) => !p.camada && !p.acao), `${ambiente}: o menu lateral só no Servir Mais`);
}
ok(TOURS.servir.some((p) => p.alvo === "menu.ambientes"), "o Servir Mais ensina a trocar de ambiente");

console.log("novidades");
ok(/^\d{4}-\d{2}$/.test(VERSAO_NOVIDADES), "versão no formato ano-mês");
ok(NOVIDADES.every((s) => s.nome && s.itens.length && s.itens.every((i) => i.titulo && i.texto && i.texto.length <= 200)), "toda novidade tem título e texto");
ok(NOVIDADES.every((s) => new Set(s.itens.map((i) => i.titulo)).size === s.itens.length), "sem título repetido numa seção");
ok(new Set(NOVIDADES.map((s) => s.chave)).size === NOVIDADES.length, "uma seção por ambiente");

console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
