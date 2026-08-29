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
import { AtalhoCumprimento } from "@/components/cumprimento/AtalhoCumprimento";
import { MonthCard } from "@/components/quadros/MonthCard";
import { NovaEscalaModal } from "@/components/dirigentes/NovaEscalaModal";
import { useAuth } from "@/context/AuthContext";
import { podeGerenciar } from "@/utils/permissoes";
import { type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { useBarraFlutuante } from "@/components/layout/contextoRolagem";

export default function DirigentesScreen() {
  // Chamado UMA vez, no topo: o ScrollView abaixo mora dentro de um condicional
  // (carregando / vazio / lista), e espalhar o hook lá dentro o tornaria uma
  // chamada condicional — proibido, e quebra na primeira troca de estado.
  const { rolagem, recuo } = useBarraFlutuante();
  const { styles } = useTema(criarEstilos);
  const { usuario } = useAuth();
  const podeEditar = podeGerenciar(usuario, "dirigentes");
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
          {...rolagem}
          contentContainerStyle={[styles.scroll, recuo]}
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
            {podeEditar ? (
              <Button label="Nova" icon="add" onPress={() => setModalOpen(true)} />
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
              message={
                podeEditar
                  ? 'Toque em "Nova" para criar a primeira'
                  : "Quando um administrador criar uma escala, ela aparece aqui."
              }
            >
              {podeEditar ? (
                <Button label="Criar Primeira Escala" onPress={() => setModalOpen(true)} />
              ) : null}
            </EmptyState>
          )}

          <View style={styles.atalho}>
            <AtalhoCumprimento />
          </View>
        </ScrollView>
      )}

      {podeEditar ? (
        <NovaEscalaModal
          visible={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={(q) => router.push(`/escala/${q.id}`)}
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
