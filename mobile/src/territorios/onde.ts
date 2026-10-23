/**
 * Em que território o irmão está agora? Geometria pura, sem import nenhum, para dar para
 * conferir com `node scripts/verificarOndeEstou.mjs`.
 *
 * Pontos são [lat, lng], como os polígonos das quadras.
 */
export type PontoGeo = [number, number];

/** Raio de tolerância: quem está na rua entre duas quadras ainda está no território delas. */
export const RAIO_TERRITORIO_M = 60;

const METROS_POR_GRAU = 111_320;

/** O ponto está dentro do polígono? (Raio cruzando as arestas.) */
export function dentro([lat, lng]: PontoGeo, pontos: PontoGeo[]): boolean {
  let resultado = false;
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    const [yi, xi] = pontos[i];
    const [yj, xj] = pontos[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) resultado = !resultado;
  }
  return resultado;
}

/**
 * Distância em metros do ponto até o polígono: 0 dentro dele, senão até a aresta mais perto.
 * Conta plana a partir do ponto (equiretangular): o erro é desprezível na escala de uma rua.
 */
export function distanciaAoPoligono(ponto: PontoGeo, poligono: PontoGeo[]): number {
  if (poligono.length < 3) return Infinity;
  if (dentro(ponto, poligono)) return 0;
  const [lat, lng] = ponto;
  const kx = METROS_POR_GRAU * Math.cos((lat * Math.PI) / 180);
  let menor = Infinity;
  for (let i = 0; i < poligono.length; i++) {
    const [aLat, aLng] = poligono[i];
    const [bLat, bLng] = poligono[(i + 1) % poligono.length];
    const ax = (aLng - lng) * kx;
    const ay = (aLat - lat) * METROS_POR_GRAU;
    const dx = (bLng - aLng) * kx;
    const dy = (bLat - aLat) * METROS_POR_GRAU;
    const comprimento = dx * dx + dy * dy;
    const t = comprimento ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / comprimento)) : 0;
    menor = Math.min(menor, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return menor;
}

/**
 * O território mais perto do ponto, se estiver a até `raio` metros de alguma quadra dele.
 * Dentro de uma quadra vence sempre (distância 0); na rua, vence o mais perto.
 */
export function territorioDoPonto<T extends { quadras: { pontos: PontoGeo[] }[] }>(
  ponto: PontoGeo,
  territorios: T[],
  raio = RAIO_TERRITORIO_M,
): T | null {
  let melhor: T | null = null;
  let menor = raio;
  for (const t of territorios) {
    for (const q of t.quadras) {
      const d = distanciaAoPoligono(ponto, q.pontos);
      if (d <= menor) {
        menor = d;
        melhor = t;
      }
    }
  }
  return melhor;
}
