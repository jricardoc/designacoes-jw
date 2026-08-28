import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { SemanaReuniao } from "@/api/types";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { datasDaSemana, limpar } from "@/utils/semanaReuniao";

/** O bloco de data: número grande, mês e o dia da semana — como no quadro de designações. */
function BlocoData({
  dia,
  mes,
  diaSemana,
  rotulo,
}: {
  dia: string;
  mes: string;
  diaSemana: string;
  rotulo: string;
}) {
  const { styles } = useTema(criarEstilos);
  return (
    <View style={styles.blocoData}>
      <Text style={styles.blocoRotulo}>{rotulo}</Text>
      <View style={styles.blocoLinha}>
        <Text style={styles.blocoDia}>{dia}</Text>
        <View>
          <Text style={styles.blocoMes}>{mes}</Text>
          <View style={styles.blocoPill}>
            <Text style={styles.blocoPillTexto}>{diaSemana}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function SemanaCard({
  semana,
  index = 0,
  destaque = false,
  onAbrir,
  onCompartilhar,
  onPdf,
  onAssistencia,
  compartilhando = false,
  gerandoPdf = false,
}: {
  semana: SemanaReuniao;
  index?: number;
  /** Semana atual hasteada no topo da tela: ganha borda viva na cor da marca. */
  destaque?: boolean;
  /** Abre a programação da semana numa tela própria. */
  onAbrir?: () => void;
  onCompartilhar?: () => void;
  onPdf?: () => void;
  /**
   * Abre o registro de assistência. Só chega para quem gerencia reuniões e
   * quando a semana tem data importada — sem os dois, o botão nem aparece
   * (diferente de PDF/Compartilhar, que são de leitura e ficam para todos).
   */
  onAssistencia?: () => void;
  compartilhando?: boolean;
  gerandoPdf?: boolean;
}) {
  const { colors, styles } = useTema(criarEstilos);
  const { meio, fds } = datasDaSemana(semana);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 55).duration(300)}
      style={[styles.card, destaque && styles.cardDestaque]}
    >
      <Pressable
        style={({ pressed }) => [styles.header, pressed && styles.pressionado]}
        onPress={onAbrir}
        disabled={!onAbrir}
        accessibilityRole="button"
        accessibilityLabel="Abrir a programação desta semana"
      >
        {/* As datas vêm primeiro: é o que o irmão procura ao abrir a tela. O rótulo textual
            do PDF ("Agosto 03 - 09") só aparece quando a importação não trouxe a data. */}
        {meio || fds ? (
          <View style={styles.datas}>
            {meio ? (
              <BlocoData
                rotulo="Meio de semana"
                dia={meio.dia}
                mes={meio.mes}
                diaSemana={meio.diaSemana}
              />
            ) : null}
            {fds ? (
              <BlocoData
                rotulo="Fim de semana"
                dia={fds.dia}
                mes={fds.mes}
                diaSemana={fds.diaSemana}
              />
            ) : null}
          </View>
        ) : (
          <Text style={styles.faixa}>{semana.faixaData}</Text>
        )}

        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </Pressable>

      {limpar(semana.leituraSemanal) ? (
        <Text style={styles.leitura}>📖 {semana.leituraSemanal}</Text>
      ) : null}

      <View style={styles.acoes}>
        <Pressable
          style={styles.acao}
          onPress={onPdf}
          disabled={gerandoPdf || !onPdf}
        >
          {gerandoPdf ? (
            <ActivityIndicator size="small" color={colors.primaryDark} />
          ) : (
            <Ionicons name="download-outline" size={15} color={colors.primaryDark} />
          )}
          <Text style={styles.acaoTexto}>PDF</Text>
        </Pressable>
        {onAssistencia ? (
          <Pressable style={styles.acao} onPress={onAssistencia}>
            <Ionicons name="people-outline" size={15} color={colors.primaryDark} />
            <Text style={styles.acaoTexto}>Assistência</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={styles.acao}
          onPress={onCompartilhar}
          disabled={compartilhando || !onCompartilhar}
        >
          {compartilhando ? (
            <ActivityIndicator size="small" color={colors.primaryDark} />
          ) : (
            <Ionicons name="share-social-outline" size={15} color={colors.primaryDark} />
          )}
          <Text style={styles.acaoTexto}>Compartilhar</Text>
        </Pressable>
      </View>

    </Animated.View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      overflow: "hidden",
      paddingBottom: 4,
    },
    cardDestaque: {
      borderWidth: 2,
      borderColor: colors.primary,
    },
    pressionado: { opacity: 0.6 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      paddingBottom: 8,
      gap: 8,
    },
    datas: { flex: 1, flexDirection: "row", gap: 18 },
    blocoData: { gap: 2 },
    blocoRotulo: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    blocoLinha: { flexDirection: "row", alignItems: "center", gap: 6 },
    blocoDia: { fontSize: 30, fontWeight: "700", color: colors.terracotta, lineHeight: 34 },
    blocoMes: { fontSize: 10, fontWeight: "700", color: colors.mesEtiqueta, letterSpacing: 1 },
    blocoPill: {
      backgroundColor: colors.infoBg,
      borderRadius: radius.sm,
      paddingVertical: 2,
      paddingHorizontal: 7,
      marginTop: 2,
    },
    blocoPillTexto: { fontSize: 11, fontWeight: "700", color: colors.primaryDark },
    faixa: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
    leitura: {
      fontSize: 13,
      color: colors.textSecondary,
      paddingHorizontal: 14,
      paddingBottom: 4,
    },
    acoes: {
      flexDirection: "row",
      // Com o botão de Assistência são três ações: em telas estreitas a linha
      // quebra em vez de empurrar o último botão para fora do cartão.
      flexWrap: "wrap",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    acao: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.infoBg,
      borderRadius: radius.pill,
      paddingVertical: 7,
      paddingHorizontal: 12,
    },
    acaoTexto: { fontSize: 12.5, fontWeight: "700", color: colors.primaryDark },
    body: { padding: 14, paddingTop: 4, gap: 12 },
    secao: { flexDirection: "row", gap: 10 },
    secaoBar: { width: 4, borderRadius: 2 },
    secaoBody: { flex: 1, paddingVertical: 2 },
    secaoTitulo: { fontSize: 13, fontWeight: "800", marginBottom: 6 },
    linha: { flexDirection: "row", gap: 8, paddingVertical: 2 },
    linhaLabel: {
      fontSize: 13,
      color: colors.textMuted,
      minWidth: 96,
      fontWeight: "600",
    },
    linhaValue: { fontSize: 13, color: colors.text, flex: 1 },
    parte: { paddingVertical: 5 },
    parteTitulo: { fontSize: 13, color: colors.text, fontWeight: "600" },
    parteHora: { color: colors.textMuted, fontWeight: "700" },
    parteQuem: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
    chip: {
      backgroundColor: colors.slotBg,
      borderWidth: 1,
      borderColor: colors.slotBorder,
      borderRadius: radius.pill,
      paddingVertical: 3,
      paddingHorizontal: 9,
    },
    chipTexto: { fontSize: 12, fontWeight: "600", color: colors.text },
    chipSalaB: { backgroundColor: colors.surfaceMuted },
    chipTextoSalaB: { color: colors.textSecondary },
  });
