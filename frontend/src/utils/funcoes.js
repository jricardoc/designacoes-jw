/**
 * Funções que um irmão pode exercer.
 *
 * Espelha os valores aceitos pelo backend (campo `funcoes` do Irmão) e o equivalente do app
 * em mobile/src/utils/funcoes.ts. Ficava declarada dentro do EditarIrmaoModal; foi extraída
 * porque o filtro de GerenciarIrmaos precisa das mesmas cores e rótulos.
 */

export const FUNCOES = [
  { id: 'microfone', label: 'Microfone', color: 'var(--t-olive)' },
  { id: 'indicador', label: 'Indicador', color: 'var(--t-primary)' },
  { id: 'audioVideo', label: 'Áudio e Vídeo', color: 'var(--t-olive)' },
  { id: 'estacionamento', label: 'Estacionamento', color: 'var(--t-terracotta)' },
  { id: 'dirigente', label: 'Dirigente', color: 'var(--t-red)' },
];

/** Devolve a definição da função, ou null se o id não for conhecido. */
export function funcaoInfo(id) {
  if (!id) return null;
  return FUNCOES.find((f) => f.id === id) || null;
}

/**
 * Funções que o quadro mensal designa. `dirigente` fica fora de propósito: dirigente é
 * escalado na escala de dirigentes, não no quadro — então quem só tem essa função não está
 * com cadastro incompleto, apenas não participa daqui.
 */
export const FUNCOES_QUADRO = [
  "microfone",
  "indicador",
  "audioVideo",
  "estacionamento",
];

/** Diz se o irmão exerce alguma função designada pelo quadro mensal. */
export function serveNoQuadro(irmao) {
  return (irmao?.funcoes || []).some((f) => FUNCOES_QUADRO.includes(f));
}
