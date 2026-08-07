/**
 * Privilégios de serviço do irmão (servo ministerial / ancião).
 *
 * Espelha os valores aceitos por `normalizarPrivilegio` em
 * backend/src/controllers/IrmaoController.js. Um irmão tem no máximo um, e pode não ter
 * nenhum — por isso o campo é anulável e os chips são desmarcáveis.
 *
 * Por enquanto é informativo. A intenção é usá-lo como critério de designação no futuro.
 */

export const PRIVILEGIOS = [
  {
    id: 'anciao',
    label: 'Ancião',
    abreviacao: 'Ancião',
    cor: 'var(--t-purple)',
    fundo: 'var(--t-purple-bg)',
  },
  {
    id: 'servoMinisterial',
    label: 'Servo Ministerial',
    abreviacao: 'Servo Min.',
    cor: 'var(--t-teal)',
    fundo: 'var(--t-teal-bg)',
  },
];

/** Devolve a definição do privilégio, ou null se o irmão não tiver nenhum. */
export function privilegioInfo(id) {
  if (!id) return null;
  return PRIVILEGIOS.find((p) => p.id === id) || null;
}
