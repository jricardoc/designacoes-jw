/**
 * As contas do tutorial: onde fica o recorte em volta do que ele mostra e onde fica o cartão.
 * Sem React, para o teste (scripts/verificarTour.mjs).
 *
 * Tudo em coordenadas da camada do tutorial (a tela inteira, a partir do canto de cima).
 */

export interface Retangulo {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A camada, com o que as bordas do aparelho tomam (entalhe, barra de gestos). */
export interface Area {
  w: number;
  h: number;
  topo: number;
  base: number;
}

/** Quanto do alvo precisa estar à vista para valer o recorte: menos que isso, o cartão vai para o meio. */
const MINIMO_A_VISTA = 0.6;

/**
 * O recorte em volta do alvo: o alvo com folga, cortado ao que está na tela. `null` quando o alvo
 * não tem tamanho ou está quase todo fora (rolado para longe, atrás da borda): mostrar um recorte
 * no lugar errado é pior que não mostrar nenhum.
 */
export function recorte(alvo: Retangulo, area: Pick<Area, "w" | "h">, folga = 6): Retangulo | null {
  if (!(alvo.w > 2 && alvo.h > 2) || ![alvo.x, alvo.y, alvo.w, alvo.h].every(Number.isFinite)) return null;
  const x0 = Math.max(0, alvo.x);
  const y0 = Math.max(0, alvo.y);
  const x1 = Math.min(area.w, alvo.x + alvo.w);
  const y1 = Math.min(area.h, alvo.y + alvo.h);
  if (x1 <= x0 || y1 <= y0) return null;
  if (((x1 - x0) * (y1 - y0)) / (alvo.w * alvo.h) < MINIMO_A_VISTA) return null;
  const x = Math.max(0, x0 - folga);
  const y = Math.max(0, y0 - folga);
  return { x, y, w: Math.min(area.w, x1 + folga) - x, h: Math.min(area.h, y1 + folga) - y };
}

/**
 * O topo do cartão: embaixo do recorte se couber, senão em cima, senão encostado embaixo da tela
 * (por cima do recorte, que é o que sobra com letra muito grande). Sem recorte, no meio.
 */
export function topoDoCartao(furo: Retangulo | null, area: Area, alturaCartao: number, margem = 14): number {
  const minimo = area.topo + margem;
  const maximo = Math.max(minimo, area.h - area.base - margem - alturaCartao);
  if (!furo) return Math.min(maximo, Math.max(minimo, (area.h - alturaCartao) / 2));
  const embaixo = furo.y + furo.h + margem;
  if (embaixo <= maximo) return embaixo;
  const emCima = furo.y - margem - alturaCartao;
  if (emCima >= minimo) return emCima;
  return maximo;
}

/** O raio do recorte: pílula para as abas, círculo para os botões redondos, cantos suaves no resto. */
export function raioDo(furo: Retangulo, forma?: "circulo" | "pilula"): number {
  if (forma === "circulo" || forma === "pilula") return Math.min(furo.w, furo.h) / 2;
  return Math.min(16, Math.min(furo.w, furo.h) / 2);
}

/** Mudou de lugar de verdade (mais que meio ponto de tela)? Medidas repetidas oscilam no arredondamento. */
export function mudou(a: Retangulo | null, b: Retangulo | null, tolerancia = 1.5): boolean {
  if (!a || !b) return a !== b;
  return Math.abs(a.x - b.x) > tolerancia || Math.abs(a.y - b.y) > tolerancia || Math.abs(a.w - b.w) > tolerancia || Math.abs(a.h - b.h) > tolerancia;
}

/**
 * As quatro faixas do véu em volta do recorte, como o transform de uma faixa W×H: deslocamento e,
 * nas laterais, escala vertical (que o React Native aplica em volta do centro, antes de deslocar).
 * Tudo em pixel inteiro: as bordas das faixas coincidem e não fica fresta. Roda nas animações.
 */
export function faixasDoVeu(f: Retangulo, W: number, H: number, pr: number) {
  "worklet";
  const px = (v: number) => Math.round(v * pr) / pr;
  const x0 = px(f.x);
  const x1 = px(f.x + f.w);
  const y0 = px(f.y);
  const y1 = px(f.y + f.h);
  const k = Math.max(0.0001, (y1 - y0) / H);
  const meio = y0 - (H * (1 - k)) / 2;
  return {
    cima: { translateY: y0 - H },
    baixo: { translateY: y1 },
    esquerda: { translateX: x0 - W, translateY: meio, scaleY: k },
    direita: { translateX: x1, translateY: meio, scaleY: k },
  };
}

/** Um canto do recorte: o desenho de lado `r0` em escala `r / r0`, encostado no canto pedido. */
export function cantoDoVeu(f: Retangulo, r: number, direita: boolean, baixo: boolean, pr: number, r0: number) {
  "worklet";
  const px = (v: number) => Math.round(v * pr) / pr;
  const raio = px(Math.max(0, r));
  const s = Math.max(0.0001, raio / r0);
  const x = direita ? px(f.x + f.w) - raio : px(f.x);
  const y = baixo ? px(f.y + f.h) - raio : px(f.y);
  return { translateX: x - (r0 * (1 - s)) / 2, translateY: y - (r0 * (1 - s)) / 2, scale: s };
}
