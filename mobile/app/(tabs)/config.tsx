import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useIrmaos } from "@/api/hooks/useIrmaos";
import type { FuncaoId, GeneroPessoa } from "@/api/types";
import { EmptyState, GradientHeader, Loading } from "@/components/ui";
import { PrivilegioBadge } from "@/components/PrivilegioBadge";
import { useAuth } from "@/context/AuthContext";
import { ehAdminGeral } from "@/utils/permissoes";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { FUNCOES, funcaoColor, funcaoLabel } from "@/utils/funcoes";

export default function ConfigScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const { usuario } = useAuth();
  const { data: irmaos, isLoading } = useIrmaos();

  // Quem entrou só pelo escopo de dirigentes não tem a aba "Irmãos": abrir nela
  // deixaria a tela vazia.
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FuncaoId | "todos">("todos");
  // Filtro à parte do de função: com irmãs no cadastro (elas não têm função mecânica), o
  // filtro por função não alcança metade das pessoas.
  const [genero, setGenero] = useState<GeneroPessoa | "todos">("todos");

  const filtrados = useMemo(
    () =>
      (irmaos ?? []).filter((i) => {
        const okBusca = i.nome.toLowerCase().includes(busca.toLowerCase());
        const okFiltro = filtro === "todos" || i.funcoes.includes(filtro);
        const okGenero = genero === "todos" || i.genero === genero;
        return okBusca && okFiltro && okGenero;
      }),
    [irmaos, busca, filtro, genero],
  );

  // Cadastro de publicadores e do admin geral. As saidas de campo, que dividiam esta tela
  // com ele, foram para o Territorio — sao lugar, nao pessoa.
  const geral = ehAdminGeral(usuario);

  // O menu já esconde a entrada, mas a rota continua alcançável (deep link,
  // rebaixamento com o app aberto). O backend também barra as escritas.
  if (!geral) {
    return (
      <View style={styles.screen}>
        <GradientHeader
          title="Publicadores"
          description="Acesso restrito"
          icon="lock-closed"
        />
        <EmptyState
          icon="lock-closed-outline"
          title="Acesso restrito"
          message="Somente administradores podem mexer no cadastro da congregação."
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Publicadores"
        description="Irmãos e irmãs da congregação"
        icon="people"
      />

      {isLoading ? (
          <Loading />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} automaticallyAdjustKeyboardInsets>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={17} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                value={busca}
                onChangeText={setBusca}
                placeholder="Buscar irmão..."
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
            >
              {(["todos", "irmao", "irma"] as const).map((g) => {
                const active = genero === g;
                const label =
                  g === "todos" ? "Todos" : g === "irmao" ? "Irmãos" : "Irmãs";
                return (
                  <Pressable
                    key={g}
                    onPress={() => setGenero(g)}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
            >
              {(["todos", ...FUNCOES.map((f) => f.id)] as (FuncaoId | "todos")[]).map((f) => {
                const active = filtro === f;
                const label = f === "todos" ? "Todos" : funcaoLabel(f);
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFiltro(f)}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable style={styles.primaryBtn} onPress={() => router.push("/irmao")}>
              <Ionicons name="add" size={18} color={colors.textOnPrimary} />
              <Text style={styles.primaryBtnText}>Novo Irmão</Text>
            </Pressable>

            <Text style={styles.counter}>{filtrados.length} pessoa(s)</Text>

            <View style={styles.list}>
              {filtrados.map((irmao, i) => (
                <Animated.View key={irmao.id} entering={FadeInDown.delay(i * 35).duration(260)}>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: "/irmao", params: { id: String(irmao.id) } })
                  }
                  style={[styles.irmaoCard, !irmao.ativo && styles.irmaoInativo]}
                >
                  <View style={styles.irmaoTop}>
                    <View style={styles.irmaoAvatar}>
                      <Text style={styles.irmaoInitials}>
                        {irmao.nome.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.irmaoNome} numberOfLines={1}>
                      {irmao.nome}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#C6BAA0" />
                  </View>
                  {irmao.privilegio || irmao.funcoes.length > 0 ? (
                    <View style={styles.funcoesRow}>
                      <PrivilegioBadge privilegio={irmao.privilegio} size="sm" abreviado />
                      {irmao.funcoes.map((f) => (
                        <View
                          key={f}
                          style={[styles.funcaoTag, { backgroundColor: funcaoColor(f) + "1a" }]}
                        >
                          <Text style={[styles.funcaoTagText, { color: funcaoColor(f) }]}>
                            {funcaoLabel(f)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
                </Animated.View>
              ))}
              {filtrados.length === 0 ? (
                <Text style={styles.empty}>Nenhum irmão encontrado.</Text>
              ) : null}
            </View>
        </ScrollView>
      )}
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  segmented: {
    flexDirection: "row",
    marginHorizontal: 18,
    marginTop: 2,
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
    paddingVertical: 9,
    borderRadius: radius.sm,
  },
  segmentActive: { backgroundColor: colors.surface, ...shadow.card },
  segmentText: { fontWeight: "700", color: colors.textSecondary, fontSize: 13.5 },
  segmentTextActive: { color: colors.primaryDark },

  scroll: { padding: 18, paddingBottom: 44 },

  // search
  searchWrap: { justifyContent: "center" },
  searchIcon: { position: "absolute", left: 15, zIndex: 1 },
  searchInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingLeft: 42,
    paddingRight: 15,
    fontSize: 15,
    color: colors.text,
  },
  filtersRow: { gap: 8, paddingVertical: 14, paddingRight: 4 },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  filterChipTextActive: { color: colors.textOnPrimary },

  primaryBtn: {
    height: 50,
    borderRadius: 15,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...shadow.card,
  },
  primaryBtnText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: "600" },
  counter: { color: colors.textMuted, marginVertical: 14, fontSize: 12.5 },
  list: { gap: 11 },
  irmaoCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    ...shadow.card,
  },
  irmaoInativo: { opacity: 0.6 },
  irmaoTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  irmaoAvatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.sand,
    alignItems: "center",
    justifyContent: "center",
  },
  irmaoInitials: { fontSize: 13, fontWeight: "700", color: colors.brown },
  irmaoNome: { flex: 1, fontWeight: "600", color: colors.text, fontSize: 16 },
  funcoesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 11 },
  funcaoTag: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  funcaoTagText: { fontSize: 11, fontWeight: "700" },
  empty: { color: colors.textMuted, textAlign: "center", padding: 20 },

  // sistema cards
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    ...shadow.card,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 9 },
  cardHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  cardSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 6 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginTop: 14,
  },
  input: {
    marginTop: 8,
    height: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: 15,
    fontSize: 15,
    color: colors.text,
  },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: colors.primary,
  },
  smallBtnText: { color: colors.textOnPrimary, fontSize: 13, fontWeight: "600" },
  outingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  outingWhen: { width: 46, alignItems: "center" },
  outingWd: { fontSize: 13, fontWeight: "700", color: colors.primaryDark },
  outingTime: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  outingGroup: { fontSize: 14.5, fontWeight: "600", color: colors.text },
  outingHost: { fontSize: 12.5, color: "#9A8F7D", marginTop: 1 },

  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  prefDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  prefLabel: { fontSize: 15, fontWeight: "500", color: colors.text },
  prefValue: { fontSize: 13, color: colors.textMuted },
  flex: { flex: 1 },
  });
