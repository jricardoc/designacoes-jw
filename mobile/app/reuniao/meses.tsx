import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAssistencias } from "@/api/hooks/useReunioes";
import { useReunioes } from "@/api/hooks/useMisc";
import { EmptyState, GradientHeader, Loading } from "@/components/ui";
import { useSemanaAcoes } from "@/components/reuniao/useSemanaAcoes";
import { MESES, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/**
 * A listagem completa da programação, mês a mês, do mais recente para o mais
 * antigo. A tela de Reunião mostra só o mês atual (e futuros) — o histórico
 * inteiro, que a deixava quilométrica, mora aqui atrás do botão
 * "Todos os meses".
 *
 * Os cartões são os mesmos de lá, com as mesmas ações (PDF, assistência,
 * compartilhar): tudo vem de useSemanaAcoes.
 */
export default function TodosOsMesesScreen() {
  const { styles } = useTema(criarEstilos);
  const { data: reunioes, isLoading, refetch, isRefetching } = useReunioes();
  // Renovada junto no puxar-para-atualizar: é ela que pré-preenche a folha de
  // assistência dos cartões desta tela.
  const assistencias = useAssistencias();
  const { renderSemana, overlays } = useSemanaAcoes();

  return (
    <View style={styles.flex}>
      <GradientHeader
        title="Todos os meses"
        description="Toda a programação importada, mês a mês"
        showBack
      />

      {isLoading ? (
        <Loading label="Carregando reuniões..." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching || assistencias.isRefetching}
              onRefresh={() => {
                refetch();
                assistencias.refetch();
              }}
            />
          }
        >
          {reunioes && reunioes.length > 0 ? (
            reunioes.map((r) => (
              <View key={r.id} style={styles.mesGroup}>
                <Text style={styles.mesTitulo}>
                  {MESES[r.mes]} {r.ano}
                </Text>
                <View style={styles.semanas}>
                  {r.semanas.map((s, i) => renderSemana(r, s, i))}
                </View>
              </View>
            ))
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="Nenhuma reunião importada"
              message="Quando a programação for importada, os meses aparecem aqui."
            />
          )}
        </ScrollView>
      )}

      {overlays}
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: 40, gap: 20 },
    mesGroup: { gap: 12 },
    mesTitulo: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      textTransform: "capitalize",
    },
    semanas: { gap: 12 },
  });
