import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAtualizarDirigenteDisponibilidade,
  useDirigenteDisponibilidade,
  useSaidasCampo,
} from "@/api/hooks/useDirigentes";
import {
  useAtualizarIrmao,
  useCriarIrmao,
  useExcluirIrmao,
  useIrmaos,
} from "@/api/hooks/useIrmaos";
import type { FuncaoId, NivelAudioVideo } from "@/api/types";
import { ConfirmDialog, useConfirm, useToast } from "@/components/ui";
import { CalendarioIndisponibilidade } from "@/components/config/CalendarioIndisponibilidade";
import { colors } from "@/theme";
import { FUNCOES } from "@/utils/funcoes";

const WD_LABEL: Record<string, string> = {
  domingo: "Domingo",
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
};

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export default function IrmaoScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const irmaoId = id ? Number(id) : undefined;
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const confirm = useConfirm();

  const { data: irmaos } = useIrmaos();
  const existente = useMemo(() => irmaos?.find((i) => i.id === irmaoId), [irmaos, irmaoId]);

  const criar = useCriarIrmao();
  const atualizar = useAtualizarIrmao();
  const excluir = useExcluirIrmao();
  const { data: saidasCampo = [] } = useSaidasCampo();
  const { data: dispDirigente } = useDirigenteDisponibilidade(irmaoId);
  const salvarDisponibilidade = useAtualizarDirigenteDisponibilidade();

  const [nome, setNome] = useState("");
  const [funcoes, setFuncoes] = useState<FuncaoId[]>([]);
  const [nivel, setNivel] = useState<NivelAudioVideo>("experiente");
  const [ativo, setAtivo] = useState(true);
  const [saidas, setSaidas] = useState<number[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (existente && !hydrated) {
      setNome(existente.nome);
      setFuncoes(existente.funcoes);
      setNivel(existente.nivelAudioVideo);
      setAtivo(existente.ativo);
      setHydrated(true);
    }
  }, [existente, hydrated]);

  useEffect(() => {
    if (dispDirigente) setSaidas(dispDirigente.map((d) => d.saidaCampoId));
  }, [dispDirigente]);

  const toggleFuncao = (f: FuncaoId) =>
    setFuncoes((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  const toggleSaida = (sid: number) =>
    setSaidas((prev) => (prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]));

  const allSaidas = saidasCampo.length > 0 && saidasCampo.every((s) => saidas.includes(s.id));
  const toggleAllSaidas = () =>
    setSaidas(allSaidas ? [] : saidasCampo.map((s) => s.id));

  const isDirigente = funcoes.includes("dirigente");
  const isAV = funcoes.includes("audioVideo");
  const saving = criar.isPending || atualizar.isPending;

  const summary =
    (funcoes.length
      ? `${funcoes.length} ${funcoes.length === 1 ? "função" : "funções"}`
      : "Sem funções") + (ativo ? "" : " · inativo");

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.show("Nome é obrigatório", "error");
      return;
    }
    try {
      let savedId = irmaoId;
      if (irmaoId) {
        await atualizar.mutateAsync({ id: irmaoId, nome: nome.trim(), funcoes, nivelAudioVideo: nivel, ativo });
      } else {
        const novo = await criar.mutateAsync({ nome: nome.trim(), funcoes, nivelAudioVideo: nivel });
        savedId = novo.id;
      }
      if (isDirigente && savedId) {
        await salvarDisponibilidade.mutateAsync({ irmaoId: savedId, saidasCampoIds: saidas });
      }
      toast.show("Irmão salvo!");
      router.back();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao salvar", "error");
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.headerWrap, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color="#7A7060" />
          <Text style={styles.backText}>Voltar</Text>
        </Pressable>
        <View style={styles.headerRow}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{initials(nome) || "+"}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.h1}>{irmaoId ? "Editar Irmão" : "Novo Irmão"}</Text>
            <Text style={styles.summary}>{summary}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(280)} style={styles.card}>
          <Text style={styles.label}>Nome</Text>
          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Nome do irmão"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 18 }]}>Funções</Text>
          <View style={styles.chips}>
            {FUNCOES.map((f) => {
              const active = funcoes.includes(f.id);
              return (
                <Pressable
                  key={f.id}
                  onPress={() => toggleFuncao(f.id)}
                  style={[
                    styles.chip,
                    active
                      ? { backgroundColor: f.color, borderColor: f.color }
                      : { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                  ]}
                >
                  {active ? <Ionicons name="checkmark" size={14} color="#FBF7EF" /> : null}
                  <Text style={[styles.chipText, { color: active ? "#FBF7EF" : "#7A7060" }]}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {isAV ? (
            <Animated.View entering={FadeInDown.duration(220)} style={{ marginTop: 18 }}>
              <Text style={styles.label}>Nível em Áudio e Vídeo</Text>
              <View style={styles.segTrack}>
                {(["experiente", "treinando"] as const).map((n) => {
                  const on = nivel === n;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setNivel(n)}
                      style={[styles.seg, on && styles.segOn]}
                    >
                      <Text style={[styles.segText, on && styles.segTextOn]}>
                        {n === "experiente" ? "Experiente" : "Treinando"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>

        {isDirigente ? (
          <Animated.View entering={FadeInDown.duration(260)} style={styles.dirCard}>
            <View style={styles.dirHead}>
              <View style={styles.flex}>
                <Text style={styles.dirTitle}>Saídas de Campo</Text>
                <Text style={styles.dirSub}>Em quais saídas este irmão pode dirigir</Text>
              </View>
              <Pressable onPress={toggleAllSaidas} style={styles.dirAllBtn}>
                <Text style={styles.dirAllText}>{allSaidas ? "Limpar" : "Marcar todas"}</Text>
              </Pressable>
            </View>
            <View style={{ marginTop: 8 }}>
              {saidasCampo.map((s) => {
                const checked = saidas.includes(s.id);
                const group = (s.local || "").split(" - ")[0];
                return (
                  <Pressable key={s.id} onPress={() => toggleSaida(s.id)} style={styles.dirRow}>
                    <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
                      {checked ? <Ionicons name="checkmark" size={13} color="#FBF7EF" /> : null}
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.dirRowTitle}>
                        {WD_LABEL[s.diaSemana] ?? s.diaSemana} · {s.horario}
                      </Text>
                      <Text style={styles.dirRowSub} numberOfLines={1}>
                        {group || s.local}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {saidasCampo.length === 0 ? (
                <Text style={styles.dirEmpty}>Nenhuma saída cadastrada.</Text>
              ) : null}
            </View>
          </Animated.View>
        ) : null}

        {irmaoId ? (
          <View style={styles.ativoCard}>
            <View style={styles.flex}>
              <Text style={styles.ativoTitle}>Ativo</Text>
              <Text style={styles.ativoSub}>Irmãos inativos não entram nas designações</Text>
            </View>
            <Switch
              value={ativo}
              onValueChange={setAtivo}
              trackColor={{ true: colors.oliveSoft, false: "#D8CDBA" }}
              thumbColor="#fff"
            />
          </View>
        ) : null}

        {irmaoId ? <CalendarioIndisponibilidade irmaoId={irmaoId} /> : null}

        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          <Ionicons name="checkmark" size={17} color="#FBF7EF" />
          <Text style={styles.saveText}>{saving ? "Salvando..." : "Salvar"}</Text>
        </Pressable>

        {irmaoId ? (
          <Pressable
            style={styles.deleteBtn}
            onPress={() =>
              confirm.confirm({
                title: "Excluir Irmão",
                message: `Excluir ${existente?.nome}? Esta ação não pode ser desfeita.`,
                type: "danger",
                confirmText: "Excluir",
                onConfirm: async () => {
                  try {
                    await excluir.mutateAsync(irmaoId);
                    toast.show("Irmão excluído!");
                    confirm.close();
                    router.back();
                  } catch {
                    toast.show("Erro ao excluir", "error");
                  }
                },
              })
            }
          >
            <Ionicons name="trash-outline" size={16} color="#FBF7EF" />
            <Text style={styles.saveText}>Excluir Irmão</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <ConfirmDialog config={confirm.config} onClose={confirm.close} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerWrap: { paddingHorizontal: 20, paddingBottom: 12 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  backText: { color: "#7A7060", fontSize: 15, fontWeight: "500" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 13, marginTop: 12 },
  headerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.oliveSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: { fontSize: 17, fontWeight: "700", color: colors.textOnPrimary },
  h1: { fontSize: 27, fontWeight: "600", letterSpacing: -0.5, color: colors.text },
  summary: { fontSize: 13.5, color: colors.textSecondary, marginTop: 5 },

  scroll: { padding: 18, paddingTop: 4, paddingBottom: 44, gap: 14 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  input: {
    marginTop: 8,
    height: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 15,
    color: colors.text,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: "600" },
  segTrack: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    backgroundColor: "#EBE1CF",
    borderRadius: 13,
    padding: 5,
  },
  seg: { flex: 1, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  segOn: {
    backgroundColor: colors.surface,
    shadowColor: "#2B2620",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.13,
    shadowRadius: 3,
    elevation: 2,
  },
  segText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  segTextOn: { color: colors.text },

  dirCard: {
    backgroundColor: "#FBF1EC",
    borderWidth: 1,
    borderColor: "#F0DED3",
    borderRadius: 20,
    padding: 18,
    paddingBottom: 12,
  },
  dirHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dirTitle: { fontSize: 16.5, fontWeight: "600", color: "#9A4632" },
  dirSub: { fontSize: 12.5, color: "#B07A66", marginTop: 3 },
  dirAllBtn: {
    height: 30,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E7C9BC",
    backgroundColor: "#FBF1EC",
    alignItems: "center",
    justifyContent: "center",
  },
  dirAllText: { color: "#9A4632", fontSize: 12, fontWeight: "600" },
  dirRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: "#F2E2D9",
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "#E0C7BB",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkBoxOn: { backgroundColor: "#A8503B", borderColor: "#A8503B" },
  dirRowTitle: { fontSize: 14, fontWeight: "600", color: "#7A3D2C" },
  dirRowSub: { fontSize: 12.5, color: "#A77863", marginTop: 1 },
  dirEmpty: { color: "#B07A66", fontSize: 13, paddingVertical: 10 },

  ativoCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ativoTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  ativoSub: { fontSize: 12.5, color: "#9A8F7D", marginTop: 2 },

  saveBtn: {
    height: 52,
    borderRadius: 15,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    shadowColor: "#5E6B48",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 4,
  },
  deleteBtn: {
    height: 52,
    borderRadius: 15,
    backgroundColor: "#A8503B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  saveText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: "600" },
  flex: { flex: 1, minWidth: 0 },
});
