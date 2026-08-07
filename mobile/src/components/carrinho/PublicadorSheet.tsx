import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  useAtualizarPublicador,
  useCriarPublicador,
  useExcluirPublicador,
} from "@/api/hooks/useCarrinho";
import type { CarrinhoPonto, CarrinhoPublicador } from "@/api/types";
import { ConfirmDialog, Sheet, useConfirm, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { DIAS_CURTOS, radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

const TURNOS_MAX = Math.round(Dimensions.get("window").height * 0.3);

interface Props {
  visible: boolean;
  publicador: CarrinhoPublicador | null;
  pontos: CarrinhoPonto[];
  onClose: () => void;
}

/**
 * Cadastro de quem serve no carrinho — próprio, separado do cadastro de irmãos:
 * a maioria são irmãs e o vínculo não tem relação com funções de reunião.
 */
export function PublicadorSheet({ visible, publicador, pontos, onClose }: Props) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const confirm = useConfirm();
  const { usuario } = useAuth();
  const criar = useCriarPublicador();
  const atualizar = useAtualizarPublicador();
  const excluir = useExcluirPublicador();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [turnoIds, setTurnoIds] = useState<number[]>([]);

  // `pontos` fica fora das dependências de propósito: a lista muda de identidade a
  // cada refetch do carrinho e reiniciar aqui apagaria a seleção em andamento.
  useEffect(() => {
    if (!visible) return;
    setNome(publicador?.nome ?? "");
    setTelefone(publicador?.telefone ?? "");
    setAtivo(publicador?.ativo ?? true);
    setTurnoIds(
      publicador
        ? pontos.flatMap((p) =>
            p.turnos
              .filter((t) => t.publicadores.some((x) => x.id === publicador.id))
              .map((t) => t.id),
          )
        : [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, publicador]);

  const editando = !!publicador;
  const salvando = criar.isPending || atualizar.isPending;
  const podeExcluir = editando && !!usuario?.isAdmin;

  const alternarTurno = (id: number) =>
    setTurnoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const salvar = async () => {
    if (!nome.trim()) {
      toast.show("O nome é obrigatório", "error");
      return;
    }
    try {
      if (publicador) {
        await atualizar.mutateAsync({
          id: publicador.id,
          nome: nome.trim(),
          telefone: telefone.trim(),
          ativo,
          turnoIds,
        });
        toast.show("Pessoa atualizada");
      } else {
        await criar.mutateAsync({
          nome: nome.trim(),
          telefone: telefone.trim(),
          turnoIds,
        });
        toast.show("Pessoa adicionada");
      }
      onClose();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao salvar", "error");
    }
  };

  const remover = () => {
    if (!publicador) return;
    confirm.confirm({
      title: `Excluir ${publicador.nome}?`,
      message: "Ela sai de todos os turnos do carrinho.",
      type: "danger",
      confirmText: "Excluir",
      onConfirm: async () => {
        try {
          await excluir.mutateAsync(publicador.id);
          toast.show("Pessoa removida");
        } catch (err) {
          toast.show(err instanceof Error ? err.message : "Erro ao excluir", "error");
        }
        confirm.close();
        onClose();
      },
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose} maxHeightPct={0.94}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{editando ? "Editar pessoa" : "Nova pessoa"}</Text>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
          <Ionicons name="close" size={18} color="#7A7060" />
        </Pressable>
      </View>

      <Text style={styles.label}>Nome</Text>
      <TextInput
        value={nome}
        onChangeText={setNome}
        placeholder="Nome completo"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />

      <Text style={[styles.label, styles.labelEspacado]}>Telefone</Text>
      <TextInput
        value={telefone}
        onChangeText={setTelefone}
        placeholder="(71) 90000-0000"
        placeholderTextColor={colors.textMuted}
        keyboardType="phone-pad"
        style={styles.input}
      />
      <Text style={styles.ajuda}>
        Usado pelo lembrete automático de WhatsApp. Pode deixar em branco por enquanto.
      </Text>

      {editando ? (
        <View style={styles.ativaRow}>
          <View style={styles.flex}>
            <Text style={styles.ativaTitulo}>Ativa</Text>
            <Text style={styles.ativaDesc}>
              Quem está inativa continua na grade, mas não recebe lembrete.
            </Text>
          </View>
          <Switch
            value={ativo}
            onValueChange={setAtivo}
            trackColor={{ true: colors.oliveSoft, false: "#D8CDBA" }}
            thumbColor="#fff"
          />
        </View>
      ) : null}

      <Text style={[styles.label, styles.labelEspacado]}>
        Turnos ({turnoIds.length} selecionado{turnoIds.length === 1 ? "" : "s"})
      </Text>
      <ScrollView
        style={styles.turnosBox}
        contentContainerStyle={styles.turnosConteudo}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {pontos.length === 0 ? (
          <Text style={styles.ajuda}>Nenhum ponto cadastrado ainda.</Text>
        ) : (
          pontos.map((ponto) => (
            <View key={ponto.id} style={styles.pontoBloco}>
              <View style={[styles.pontoNomeWrap, { borderLeftColor: ponto.cor }]}>
                <Text style={styles.pontoNome} numberOfLines={1}>
                  {ponto.nome}
                </Text>
              </View>
              {ponto.turnos.length === 0 ? (
                <Text style={styles.ajuda}>Sem turnos cadastrados.</Text>
              ) : (
                <View style={styles.chips}>
                  {ponto.turnos.map((t) => {
                    const marcado = turnoIds.includes(t.id);
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => alternarTurno(t.id)}
                        style={[
                          styles.chip,
                          marcado && { backgroundColor: ponto.cor, borderColor: ponto.cor },
                        ]}
                      >
                        <Text style={[styles.chipText, marcado && styles.chipTextOn]}>
                          {DIAS_CURTOS[t.diaSemana]} {t.horaInicio}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        {podeExcluir ? (
          <Pressable onPress={remover} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.red} />
          </Pressable>
        ) : null}
        <Pressable onPress={salvar} disabled={salvando} style={styles.saveBtn}>
          <Text style={styles.saveText}>{salvando ? "Salvando..." : "Salvar"}</Text>
        </Pressable>
      </View>

      <ConfirmDialog config={confirm.config} onClose={confirm.close} />
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
    },
    title: { fontSize: 23, fontWeight: "600", color: colors.text },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: colors.textMuted,
    },
    labelEspacado: { marginTop: 18 },
    input: {
      marginTop: 9,
      height: 48,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      paddingHorizontal: 15,
      fontSize: 15,
      color: colors.text,
    },
    ajuda: { fontSize: 12.5, color: colors.textSecondary, marginTop: 7, lineHeight: 18 },
    ativaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: radius.md,
      padding: 14,
      marginTop: 18,
    },
    ativaTitulo: { fontSize: 15, fontWeight: "600", color: colors.text },
    ativaDesc: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
    turnosBox: {
      maxHeight: TURNOS_MAX,
      // Em tela baixa a folha bate no teto: só a lista encolhe, para o Salvar
      // continuar visível em vez de ser empurrado para fora.
      flexShrink: 1,
      marginTop: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.slotBg,
      borderRadius: radius.md,
    },
    turnosConteudo: { padding: 12, gap: 14 },
    pontoBloco: { gap: 8 },
    pontoNomeWrap: { borderLeftWidth: 3, paddingLeft: 9 },
    pontoNome: { fontSize: 14, fontWeight: "600", color: colors.text },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    chipText: { fontSize: 12.5, fontWeight: "600", color: colors.textSecondary },
    chipTextOn: { color: colors.textOnPrimary },
    footer: { flexDirection: "row", gap: 11, marginTop: 20 },
    deleteBtn: {
      width: 52,
      height: 52,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: "#E7C9BC",
      backgroundColor: colors.dangerBg,
      alignItems: "center",
      justifyContent: "center",
    },
    saveBtn: {
      flex: 1,
      height: 52,
      borderRadius: 15,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    saveText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: "600" },
    flex: { flex: 1 },
  });
