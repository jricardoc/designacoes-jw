import { router } from "expo-router";
import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuadros } from "@/api/hooks/useQuadros";
import { Button, EmptyState, GradientHeader, Loading } from "@/components/ui";
import { AtalhoCumprimento } from "@/components/cumprimento/AtalhoCumprimento";
import { DashboardGlobal } from "@/components/quadros/DashboardGlobal";
import { MonthCard } from "@/components/quadros/MonthCard";
import { NovoQuadroModal } from "@/components/quadros/NovoQuadroModal";
import { useAuth } from "@/context/AuthContext";
import { podeGerenciar } from "@/utils/permissoes";
import { type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { useBarraFlutuante } from "@/components/layout/contextoRolagem";

export default function DesignacoesScreen() {
  // Chamado UMA vez, no topo: o ScrollView abaixo mora dentro de um condicional
  // (carregando / vazio / lista), e espalhar o hook lá dentro o tornaria uma
  // chamada condicional — proibido, e quebra na primeira troca de estado.
  const { rolagem, recuo } = useBarraFlutuante();
  const { styles } = useTema(criarEstilos);
  const { usuario } = useAuth();
  const podeEditar = podeGerenciar(usuario, "designacoes");
  const { data: quadros, isLoading, refetch, isRefetching } = useQuadros();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <View style={styles.flex}>
      <GradientHeader
        title="Designações"
        description="Gerencie os quadros mensais"
        icon="document-text"
      />

      {isLoading ? (
        <Loading label="Carregando quadros..." />
      ) : (
        <ScrollView
          {...rolagem}
          contentContainerStyle={[styles.scroll, recuo]}
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
            {podeEditar ? (
              <Button
                label="Novo"
                icon="add"
                onPress={() => setModalOpen(true)}
              />
            ) : null}
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
              message={
                podeEditar
                  ? 'Toque em "Novo" para criar o primeiro'
                  : "Quando um administrador criar um quadro, ele aparece aqui."
              }
            >
              {podeEditar ? (
                <Button label="Criar Primeiro Quadro" onPress={() => setModalOpen(true)} />
              ) : null}
            </EmptyState>
          )}

          <View style={styles.atalho}>
            <AtalhoCumprimento />
          </View>

          <DashboardGlobal />
        </ScrollView>
      )}

      {podeEditar ? (
        <NovoQuadroModal
          visible={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={(q) => router.push(`/quadro/${q.id}`)}
          existentes={quadros ?? []}
        />
      ) : null}
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
    },
    sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    sectionSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    list: { gap: 12 },
    atalho: { marginTop: 16 },
  });
