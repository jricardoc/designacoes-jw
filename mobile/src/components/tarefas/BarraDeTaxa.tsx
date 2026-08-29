import { StyleSheet, Text, View } from "react-native";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/**
 * A barra de proporção do painel: um rótulo, uma barra e a fração escrita ao lado.
 *
 * Feita com Views, sem biblioteca de gráfico. Um pacote de charts traria um runtime de
 * desenho (SVG ou canvas) inteiro para o app resolver o que aqui são duas caixas e uma
 * porcentagem — e o resto do painel são barras como esta.
 *
 * A barra tem DOIS preenchimentos sobrepostos: o total cumprido e, mais forte, a parte que
 * saiu no prazo. Uma taxa de 90% cumprida com metade em atraso não é a mesma coisa que 90%
 * em dia, e uma barra só esconderia justamente essa diferença.
 */

interface Props {
  rotulo: string;
  /** Quantas ocorrências existiam no período. Zero = sem dado, não zero por cento. */
  previstas: number;
  cumpridas: number;
  noPrazo?: number;
  /** Linha secundária opcional, abaixo do rótulo. */
  detalhe?: string | null;
}

export function BarraDeTaxa({ rotulo, previstas, cumpridas, noPrazo, detalhe }: Props) {
  const { colors, styles } = useTema(criarEstilos);

  // Sem ocorrência nenhuma no período não há taxa. Mostrar 0% acusaria alguém de não fazer
  // uma coisa que nunca lhe foi pedida.
  if (previstas === 0) {
    return (
      <View style={styles.linha}>
        <View style={styles.topo}>
          <Text style={styles.rotulo} numberOfLines={1}>
            {rotulo}
          </Text>
          <Text style={styles.semDado}>sem ocorrência no período</Text>
        </View>
      </View>
    );
  }

  const taxa = cumpridas / previstas;
  const taxaNoPrazo = (noPrazo ?? 0) / previstas;
  const atrasadas = cumpridas - (noPrazo ?? cumpridas);

  /** Verde quando quase tudo saiu, âmbar no meio, vermelho quando a maioria ficou. */
  const cor = taxa >= 0.85 ? colors.greenDark : taxa >= 0.6 ? colors.amber : colors.red;

  return (
    <View style={styles.linha}>
      <View style={styles.topo}>
        <Text style={styles.rotulo} numberOfLines={1}>
          {rotulo}
        </Text>
        <Text style={[styles.numero, { color: cor }]}>{Math.round(taxa * 100)}%</Text>
      </View>

      <View style={styles.trilho}>
        <View style={[styles.preenchido, { width: `${taxa * 100}%`, backgroundColor: `${cor}55` }]} />
        {noPrazo !== undefined ? (
          <View style={[styles.preenchido, { width: `${taxaNoPrazo * 100}%`, backgroundColor: cor }]} />
        ) : null}
      </View>

      <Text style={styles.legenda}>
        {cumpridas} de {previstas}
        {noPrazo !== undefined && atrasadas > 0 ? ` · ${atrasadas} em atraso` : ""}
        {detalhe ? ` · ${detalhe}` : ""}
      </Text>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    linha: { gap: 5, paddingVertical: 9 },
    topo: { flexDirection: "row", alignItems: "center", gap: 10 },
    rotulo: { flex: 1, fontSize: 14, color: colors.text, fontWeight: "600" },
    numero: { fontSize: 14.5, fontWeight: "800" },
    semDado: { fontSize: 12, color: colors.textMuted, fontStyle: "italic" },
    trilho: {
      height: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      overflow: "hidden",
    },
    // Os dois preenchimentos partem da esquerda e se sobrepõem: o mais forte (no prazo) é
    // desenhado depois e fica por cima.
    preenchido: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
    legenda: { fontSize: 11.5, color: colors.textMuted },
  });
