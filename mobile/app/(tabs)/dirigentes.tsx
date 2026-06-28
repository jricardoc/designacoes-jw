import { router } from "expo-router";
import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useDirigentesQuadros } from "@/api/hooks/useDirigentes";
import { Button, EmptyState, GradientHeader, Loading } from "@/components/ui";
import { MonthCard } from "@/components/quadros/MonthCard";
import { NovaEscalaModal } from "@/components/dirigentes/NovaEscalaModal";
import { colors } from "@/theme";

export default function DirigentesScreen() {
  const { data: quadros, isLoading, refetch, isRefetching } = useDirigentesQuadros();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <View style={styles.flex}>
      <GradientHeader
        title="Escala de Dirigentes"
        description="Saídas de campo mensais"
        icon="compass"
      />

      {isLoading ? (
        <Loading label="Carregando escalas..." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
        >
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>Escalas</Text>
              <Text style={styles.sectionSub}>
                {quadros?.length ?? 0} escalas criadas
              </Text>
            </View>
            <Button label="Nova" icon="add" onPress={() => setModalOpen(true)} />
          </View>

          {quadros && quadros.length > 0 ? (
            <View style={styles.list}>
              {quadros.map((q, i) => (
                <MonthCard
                  key={q.id}
                  index={i}
                  mes={q.mes}
                  ano={q.ano}
                  status={q.status}
                  createdAt={q.createdAt}
                  icon="compass"
                  metrics={[
                    { icon: "navigate", label: `${q._count?.escalas ?? 0} saídas` },
                  ]}
                  onPress={() => router.push(`/escala/${q.id}`)}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="compass-outline"
              title="Nenhuma escala criada"
              message='Toque em "Nova" para criar a primeira'
            >
              <Button label="Criar Primeira Escala" onPress={() => setModalOpen(true)} />
            </EmptyState>
          )}
        </ScrollView>
      )}

      <NovaEscalaModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(q) => router.push(`/escala/${q.id}`)}
        existentes={quadros ?? []}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  sectionSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  list: { gap: 12 },
});
