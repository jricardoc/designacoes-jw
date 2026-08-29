/**
 * As medidas da barra flutuante, num módulo só.
 *
 * Ficam FORA de `BarraFlutuante.tsx` porque quem precisa delas são as telas (para reservar o
 * espaço no fim da rolagem) e o contexto de rolagem — e os dois já são importados pela barra.
 * Deixá-las lá dentro fecharia um ciclo de imports.
 */

/** Altura da pílula. */
export const ALTURA_DA_BARRA = 60;

/** Largura de cada aba. Mexer aqui reposiciona o indicador sozinho. */
export const LARGURA_DA_ABA = 58;

/** Lado do quadrado arredondado que desliza sob o ícone ativo. */
export const LADO_DO_INDICADOR = 50;

/**
 * Distância entre a pílula e o fim da área segura.
 *
 * Somada a `insets.bottom`, e não no lugar dele: o container de (tabs) não reserva mais o
 * rodapé (era ele que criava aquela faixa de fundo no fim de toda tela), então a barra
 * precisa se afastar da barra de navegação do sistema por conta própria.
 */
export const RECUO_DA_BARRA = 14;

/**
 * O piso do recuo, para aparelho que não declara área segura embaixo.
 *
 * Com botões de hardware `insets.bottom` vem 0, e sem este piso a pílula encostaria na
 * moldura.
 */
export const RECUO_MINIMO = 10;

/**
 * Folga entre o fim do conteúdo e o topo da pílula.
 *
 * Não é decoração: sem ela o último item da lista termina exatamente na borda do vidro, e
 * fica com cara de cortado.
 */
export const FOLGA_DO_CONTEUDO = 22;

/**
 * A que altura do rodapé a pílula flutua.
 *
 * É a MESMA conta que decide o espaço reservado no fim da rolagem (abaixo). Duas contas
 * separadas só pareceriam certas: com `insets.bottom` menor que o piso, a folga entre o fim
 * do conteúdo e o vidro encolheria sem ninguém entender por quê.
 */
export function recuoDaBarra(recuoSeguro: number): number {
  return Math.max(recuoSeguro, RECUO_MINIMO) + RECUO_DA_BARRA;
}

/**
 * Quanto cada tela reserva no fim da rolagem: a barra inteira, de onde ela flutua até o topo
 * dela, mais a folga para o último item não encostar no vidro.
 */
export function espacoDoConteudo(recuoSeguro: number): number {
  return recuoDaBarra(recuoSeguro) + ALTURA_DA_BARRA + FOLGA_DO_CONTEUDO;
}
