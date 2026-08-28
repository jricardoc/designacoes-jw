import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useReunioes } from "@/api/hooks/useMisc";
import type { SemanaReuniao } from "@/api/types";
import { EmptyState, GradientHeader, Loading } from "@/components/ui";
import { ProgramacaoSemana } from "@/components/reuniao/ProgramacaoSemana";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { datasDaSemana, faixaSemana, limpar } from "@/utils/semanaReuniao";

/**
 * A programação de UMA semana, inteira e aberta.
 *
 * Antes isto era um accordion dentro do cartão da lista: para ler a reunião era preciso
 * abrir o cartão e rolar por cima dos outros. Numa tela própria a programação respira — as
 * duas salas ganham rótulo separado e cada reunião tem a sua aba.
 *
 * O cabeçalho é da SEMANA: as duas datas, a leitura e a limpeza, que não pertencem a uma
 * reunião nem à outra. As abas dividem só o que é de cada uma.
 *
 * Os dados NÃO são buscados aqui: saem do cache de `useReunioes`, que a tela de Reunião já
 * carregou. Não existe endpoint de uma semana só, e criar um para isso faria a mesma
 * informação viajar duas vezes.
 */
export default function SemanaScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: reunioes, isLoading } = useReunioes();
  const [aba, setAba] = useState<"meio" | "fds">("meio");

  const semanaId = Number(id);

  const semana: SemanaReuniao | undefined = useMemo(() => {
    if (!reunioes || !Number.isFinite(semanaId)) return undefined;
    for (const reuniao of reunioes) {
      const achada = reuniao.semanas?.find((s) => s.id === semanaId);
      if (achada) return achada;
    }
    return undefined;
  }, [reunioes, semanaId]);

  const datas = semana ? datasDaSemana(semana) : null;

  return (
    <View style={styles.tela}>
      <GradientHeader
        title="Programação"
        description={semana ? faixaSemana(semana) : "Semana da reunião"}
        icon="people"
        showBack
      />

      {isLoading ? (
        <Loading />
      ) : !semana ? (
        <EmptyState
          icon="help-circle-outline"
          title="Semana não encontrada"
          message="Ela pode ter sido removida numa reimportação da programação. Volte e abra a lista de novo."
        >
          <Pressable style={styles.voltar} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color={colors.primaryDark} />
            <Text style={styles.voltarTexto}>Voltar</Text>
          </Pressable>
        </EmptyState>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.topo}>
            {datas?.meio || datas?.fds ? (
              <View style={styles.datas}>
                {datas.meio ? (
                  <BlocoData
                    rotulo="Meio de semana"
                    dia={datas.meio.dia}
                    mes={datas.meio.mes}
                    diaSemana={datas.meio.diaSemana}
                  />
                ) : null}
                {datas.fds ? (
                  <BlocoData
                    rotulo="Fim de semana"
                    dia={datas.fds.dia}
                    mes={datas.fds.mes}
                    diaSemana={datas.fds.diaSemana}
                  />
                ) : null}
              </View>
            ) : (
              <Text style={styles.faixa}>{semana.faixaData}</Text>
            )}

            {limpar(semana.leituraSemanal) ? (
              <Text style={styles.leitura}>📖 {semana.leituraSemanal}</Text>
            ) : null}

            {/* A limpeza vale a SEMANA, não uma das reuniões — por isso fica aqui em cima,
                com as datas, e não dentro de uma das abas. */}
            {limpar(semana.limpeza) ? (
              <Text style={styles.limpeza}>🧹 {semana.limpeza}</Text>
            ) : null}
          </View>

          <View style={styles.segmented}>
            {(["meio", "fds"] as const).map((m) => {
              const ativa = aba === m;
              return (
                <Pressable
                  key={m}
                  style={[styles.segment, ativa && styles.segmentActive]}
                  onPress={() => setAba(m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativa }}
                >
                  <Ionicons
                    name={m === "meio" ? "book-outline" : "people-outline"}
                    size={17}
                    color={ativa ? colors.primaryDark : colors.textSecondary}
                  />
                  <Text style={[styles.segmentText, ativa && styles.segmentTextActive]}>
                    {m === "meio" ? "Meio de semana" : "Fim de semana"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ProgramacaoSemana semana={semana} momento={aba} />
        </ScrollView>
      )}
    </View>
  );
}

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

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: 40, gap: 14 },

    topo: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 14,
      gap: 10,
      ...shadow.card,
    },
    datas: { flexDirection: "row", gap: 22 },
    faixa: { fontSize: 18, fontWeight: "700", color: colors.text },
    leitura: { fontSize: 15.5, color: colors.textSecondary },
    limpeza: { fontSize: 14.5, color: colors.textSecondary },

    blocoData: { gap: 2 },
    blocoRotulo: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    blocoLinha: { flexDirection: "row", alignItems: "center", gap: 6 },
    blocoDia: { fontSize: 34, fontWeight: "700", color: colors.terracotta, lineHeight: 38 },
    blocoMes: { fontSize: 11, fontWeight: "700", color: colors.mesEtiqueta, letterSpacing: 1 },
    blocoPill: {
      backgroundColor: colors.infoBg,
      borderRadius: radius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginTop: 2,
    },
    blocoPillTexto: { fontSize: 11, fontWeight: "700", color: colors.primaryDark },

    segmented: {
      flexDirection: "row",
      backgroundColor: colors.sand,
      borderRadius: radius.md,
      padding: 5,
      gap: 5,
    },
    segment: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: radius.sm,
    },
    segmentActive: { backgroundColor: colors.surface, ...shadow.card },
    segmentText: { fontWeight: "700", color: colors.textSecondary, fontSize: 14 },
    segmentTextActive: { color: colors.primaryDark },
    voltar: { flexDirection: "row", alignItems: "center", gap: 6 },
    voltarTexto: { fontSize: 14, fontWeight: "700", color: colors.primaryDark },
  });
