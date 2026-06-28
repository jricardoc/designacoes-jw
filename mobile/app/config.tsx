import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  useAtualizarConfig,
  useConfig,
} from "@/api/hooks/useMisc";
import { useSaidasCampo } from "@/api/hooks/useDirigentes";
import { useIrmaos } from "@/api/hooks/useIrmaos";
import type { FuncaoId, SaidaCampo } from "@/api/types";
import { GradientHeader, Loading, useToast } from "@/components/ui";
import { SaidaCampoModal } from "@/components/config/SaidaCampoModal";
import { useNotifPref } from "@/notifications/notifPref";
import { colors, radius, shadow } from "@/theme";
import { FUNCOES, funcaoColor, funcaoLabel } from "@/utils/funcoes";

type Secao = "irmaos" | "sistema";

const APP_VERSION = "2.4.0";

const DIA_ABBR: Record<string, string> = {
  segunda: "SEG",
  terca: "TER",
  quarta: "QUA",
  quinta: "QUI",
  sexta: "SEX",
  sabado: "SÁB",
  domingo: "DOM",
};

function splitLocal(local: string, turno: number) {
  const parts = (local || "").split(" - ");
  const group = parts[0] || `Turno ${turno}`;
  const host = parts.slice(1).join(" - ");
  return { group, host };
}

export default function ConfigScreen() {
  const { data: irmaos, isLoading } = useIrmaos();
  const { data: config } = useConfig();
  const atualizarConfig = useAtualizarConfig();
  const { data: saidas } = useSaidasCampo();
  const notif = useNotifPref();
  const toast = useToast();

  const [secao, setSecao] = useState<Secao>("irmaos");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FuncaoId | "todos">("todos");
  const [congName, setCongName] = useState("");
  const [saidaModal, setSaidaModal] = useState<{ open: boolean; saida: SaidaCampo | null }>({
    open: false,
    saida: null,
  });

  useEffect(() => {
    if (config) setCongName(config.subtitulo ?? "");
  }, [config]);

  const filtrados = useMemo(
    () =>
      (irmaos ?? []).filter((i) => {
        const okBusca = i.nome.toLowerCase().includes(busca.toLowerCase());
        const okFiltro = filtro === "todos" || i.funcoes.includes(filtro);
        return okBusca && okFiltro;
      }),
    [irmaos, busca, filtro],
  );

  const salvarCong = () => {
    const v = congName.trim();
    if (!v || v === config?.subtitulo) return;
    atualizarConfig.mutate(
      { subtitulo: v },
      {
        onSuccess: () => toast.show("Congregação atualizada!"),
        onError: () => toast.show("Erro ao salvar", "error"),
      },
    );
  };

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Configurações"
        description="Irmãos, funções e sistema"
        showBack
      />

      <View style={styles.segmented}>
        {(["irmaos", "sistema"] as const).map((s) => {
          const active = secao === s;
          return (
            <Pressable
              key={s}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => setSecao(s)}
            >
              <Ionicons
                name={s === "irmaos" ? "people-outline" : "construct-outline"}
                size={16}
                color={active ? colors.primaryDark : colors.textSecondary}
              />
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {s === "irmaos" ? "Irmãos" : "Sistema"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {secao === "irmaos" ? (
        isLoading ? (
          <Loading />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
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

            <Text style={styles.counter}>{filtrados.length} irmão(s)</Text>

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
                  {irmao.funcoes.length > 0 ? (
                    <View style={styles.funcoesRow}>
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
        )
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Congregação */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Ionicons name="business-outline" size={18} color={colors.oliveSoft} />
              <Text style={styles.cardTitle}>Congregação</Text>
            </View>
            <Text style={styles.fieldLabel}>Nome</Text>
            <TextInput
              value={congName}
              onChangeText={setCongName}
              onBlur={salvarCong}
              placeholder="Congregação..."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          </View>

          {/* Saídas de Campo */}
          <View style={[styles.card, { paddingBottom: 8 }]}>
            <View style={styles.cardHeadRow}>
              <View style={styles.cardHead}>
                <Ionicons name="send-outline" size={17} color={colors.oliveSoft} />
                <Text style={styles.cardTitle}>Saídas de Campo</Text>
              </View>
              <Pressable
                style={styles.smallBtn}
                onPress={() => setSaidaModal({ open: true, saida: null })}
              >
                <Ionicons name="add" size={14} color={colors.textOnPrimary} />
                <Text style={styles.smallBtnText}>Nova</Text>
              </Pressable>
            </View>
            <Text style={styles.cardSub}>{saidas?.length ?? 0} saída(s) cadastrada(s)</Text>

            <View style={{ marginTop: 4 }}>
              {(saidas ?? []).map((o) => {
                const { group, host } = splitLocal(o.local, o.turno);
                return (
                  <Pressable
                    key={o.id}
                    style={styles.outingRow}
                    onPress={() => setSaidaModal({ open: true, saida: o })}
                  >
                    <View style={styles.outingWhen}>
                      <Text style={styles.outingWd}>{DIA_ABBR[o.diaSemana] ?? o.diaSemana}</Text>
                      <Text style={styles.outingTime}>{o.horario}</Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.outingGroup} numberOfLines={1}>
                        {group}
                      </Text>
                      {host ? (
                        <Text style={styles.outingHost} numberOfLines={1}>
                          {host}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="create-outline" size={17} color="#C2B79D" />
                  </Pressable>
                );
              })}
              {(saidas?.length ?? 0) === 0 ? (
                <Text style={[styles.empty, { paddingVertical: 16 }]}>
                  Nenhuma saída cadastrada.
                </Text>
              ) : null}
            </View>
          </View>

          {/* Preferências */}
          <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
            <View style={[styles.prefRow, styles.prefDivider]}>
              <Text style={styles.prefLabel}>Notificações</Text>
              <Switch
                value={notif.enabled}
                onValueChange={notif.toggle}
                trackColor={{ true: colors.primary, false: colors.borderStrong }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.prefRow}>
              <Text style={styles.prefLabel}>Tema</Text>
              <Text style={styles.prefValue}>Terroso claro</Text>
            </View>
          </View>

          <Text style={styles.version}>
            Quadro de Designações · Versão {APP_VERSION}
          </Text>
        </ScrollView>
      )}

      <SaidaCampoModal
        visible={saidaModal.open}
        saida={saidaModal.saida}
        onClose={() => setSaidaModal({ open: false, saida: null })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  segmented: {
    flexDirection: "row",
    marginHorizontal: 18,
    marginTop: 2,
    backgroundColor: "#EBE1CF",
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
    borderTopColor: "#F1EAD9",
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
  prefDivider: { borderBottomWidth: 1, borderBottomColor: "#F1EAD9" },
  prefLabel: { fontSize: 15, fontWeight: "500", color: colors.text },
  prefValue: { fontSize: 13, color: colors.textMuted },
  version: { textAlign: "center", fontSize: 12, color: "#B7AC97", marginTop: 6 },
  flex: { flex: 1 },
});
