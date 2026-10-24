import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useErrosApp, useLimparErrosApp } from "@/api/hooks/useErrosApp";
import type { ErroApp } from "@/api/types";
import { ConfirmDialog, EmptyState, GradientHeader, Loading, useConfirm, useToast } from "@/components/ui";
import { radius, shadow, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { usePuxar } from "@/utils/usePuxar";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Ajustes › Erros do app (admin geral): o que quebrou no celular de cada um, do mais recente.
 * É aqui que se confere uma atualização antes de ela ir para todos (ver o "Canal de teste").
 */
export default function ErrosScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const { data: erros, isLoading, isError, refetch } = useErrosApp();
  const limpar = useLimparErrosApp();
  const toast = useToast();
  const puxar = usePuxar(refetch);
  const { config, confirm, close } = useConfirm();
  const [aberto, setAberto] = useState<number | null>(null);

  const pedirLimpeza = () =>
    confirm({
      title: "Limpar os erros",
      message: "Apaga a lista para todos os admins. Os erros que voltarem a acontecer aparecem de novo.",
      type: "danger",
      confirmText: "Limpar tudo",
      onConfirm: async () => {
        try {
          await limpar.mutateAsync();
        } catch {
          toast.show("Não consegui limpar agora", "error");
        }
        close();
      },
    });

  const renderItem = ({ item }: { item: ErroApp }) => {
    const expandido = aberto === item.id;
    const detalhes = [
      item.tela,
      item.plataforma === "ios" ? "iPhone" : item.plataforma === "android" ? "Android" : item.plataforma,
      [item.versaoApp, item.updateId?.slice(0, 8)].filter(Boolean).join(" · "),
      item.canal === "teste" ? "canal de teste" : null,
    ].filter(Boolean);
    return (
      <Pressable
        onPress={() => setAberto(expandido ? null : item.id)}
        style={({ pressed }) => [styles.card, pressed && styles.pressionado]}
        accessibilityRole="button"
        accessibilityState={{ expanded: expandido }}
      >
        <View style={styles.topo}>
          <View style={[styles.selo, { backgroundColor: item.fatal ? colors.dangerBg : colors.warningBg }]}>
            <Text style={[styles.seloTexto, { color: item.fatal ? colors.red : colors.amber }]}>
              {item.fatal ? "Fechou o app" : "Tela com erro"}
            </Text>
          </View>
          <Text style={styles.vezes}>{item.vezes === 1 ? "1 vez" : `${item.vezes} vezes`}</Text>
          <Text style={styles.quando}>{quando(item.ultimaEm)}</Text>
        </View>
        <Text style={styles.mensagem} numberOfLines={expandido ? undefined : 3} selectable={expandido}>
          {item.mensagem}
        </Text>
        <Text style={styles.detalhe}>{detalhes.join(" · ")}</Text>
        {item.usuario ? <Text style={styles.detalhe}>Última vez com {item.usuario}</Text> : null}
        {expandido ? (
          <>
            <Text style={styles.detalhe}>Primeira vez: {quando(item.primeiraEm)}</Text>
            {item.pilha ? (
              <Text style={styles.pilha} selectable>
                {item.pilha}
              </Text>
            ) : null}
          </>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Erros do app"
        description="O que quebrou no celular de cada um"
        showBack
        right={
          erros?.length ? (
            <Pressable style={styles.limpar} hitSlop={8} onPress={pedirLimpeza} accessibilityRole="button" accessibilityLabel="Limpar os erros">
              <Ionicons name="trash-outline" size={16} color={colors.red} />
            </Pressable>
          ) : null
        }
      />
      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={erros ?? []}
          keyExtractor={(e) => String(e.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}
          ListEmptyComponent={
            isError ? (
              <EmptyState icon="cloud-offline-outline" title="Não consegui buscar" message="Confira a internet e puxe para tentar de novo." />
            ) : (
              <EmptyState icon="checkmark-circle-outline" title="Nenhum erro" message="Quando uma tela quebrar no celular de alguém, ela aparece aqui." />
            )
          }
        />
      )}
      <ConfirmDialog config={config} onClose={close} />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    lista: { padding: 16, gap: spacing.md, paddingBottom: 40 },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: 14,
      gap: 6,
      ...shadow.card,
    },
    pressionado: { opacity: 0.85 },
    topo: { flexDirection: "row", alignItems: "center", gap: 8 },
    selo: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
    seloTexto: { fontSize: 11.5, fontWeight: "800" },
    vezes: { fontSize: 13, fontWeight: "700", color: colors.text },
    quando: { flex: 1, textAlign: "right", fontSize: 12.5, color: colors.textMuted },
    mensagem: { fontSize: 15, fontWeight: "700", color: colors.text, lineHeight: 20 },
    detalhe: { fontSize: 12.5, color: colors.textSecondary },
    pilha: {
      marginTop: 4,
      padding: 10,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 15,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    limpar: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
      backgroundColor: colors.dangerBg,
    },
  });
