import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuadros } from "@/api/hooks/useQuadros";
import { Button, EmptyState, GradientHeader, Loading } from "@/components/ui";
import { DashboardGlobal } from "@/components/quadros/DashboardGlobal";
import { MonthCard } from "@/components/quadros/MonthCard";
import { NovoQuadroModal } from "@/components/quadros/NovoQuadroModal";
import { colors } from "@/theme";

export default function DesignacoesScreen() {
  const { data: quadros, isLoading, refetch, isRefetching } = useQuadros();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <View style={styles.flex}>
      <GradientHeader
        title="Designações"
        description="Gerencie os quadros mensais"
        icon="document-text"
        right={
          <Pressable
            hitSlop={10}
            onPress={() => router.push("/config")}
            style={styles.headerBtn}
          >
            <Ionicons name="options-outline" size={20} color={colors.oliveSoft} />
          </Pressable>
        }
      />

      {isLoading ? (
        <Loading label="Carregando quadros..." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
        >
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>Quadros de Designações</Text>
              <Text style={styles.sectionSub}>
                {quadros?.length ?? 0} quadros criados
              </Text>
            </View>
            <Button
              label="Novo"
              icon="add"
              onPress={() => setModalOpen(true)}
            />
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
                  icon="document-text"
                  metrics={[
                    { icon: "calendar", label: `${q._count?.designacoes ?? 0} designações` },
                    { icon: "time", label: `${q._count?.historicos ?? 0} alterações` },
                  ]}
                  onPress={() => router.push(`/quadro/${q.id}`)}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="Nenhum quadro criado"
              message='Toque em "Novo" para criar o primeiro'
            >
              <Button label="Criar Primeiro Quadro" onPress={() => setModalOpen(true)} />
            </EmptyState>
          )}

          <DashboardGlobal />
        </ScrollView>
      )}

      <NovoQuadroModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(q) => router.push(`/quadro/${q.id}`)}
        existentes={quadros ?? []}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
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
