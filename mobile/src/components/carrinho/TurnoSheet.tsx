import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  useAtualizarTurno,
  useCriarTurno,
  useExcluirTurno,
} from "@/api/hooks/useCarrinho";
import type {
  CarrinhoPonto,
  CarrinhoPublicador,
  CarrinhoTurno,
} from "@/api/types";
import {
  ConfirmDialog,
  SelectSheet,
  Sheet,
  useConfirm,
  useToast,
  type SelectOption,
} from "@/components/ui";
import { DIAS_CURTOS, radius, type Cores } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { podeGerenciar } from "@/utils/permissoes";
import { useTema } from "@/theme/TemaContext";

/** Faixas que a planilha da congregação já usava — servem de atalho para não digitar. */
const FAIXAS_PADRAO: [string, string][] = [
  ["06:00", "08:00"],
  ["08:00", "10:00"],
  ["10:00", "12:00"],
  ["12:00", "14:00"],
  ["14:00", "16:00"],
  ["16:00", "18:00"],
  ["18:00", "20:00"],
  ["20:00", "21:00"],
];

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A lista de pessoas rola sozinha porque a folha inteira não pode rolar (já é um Modal). */
const PESSOAS_MAX = Math.max(120, Math.round(Dimensions.get("window").height * 0.2));

/** Insere o ":" sozinho: o teclado numérico não tem como digitá-lo. */
function mascaraHora(texto: string) {
  const digitos = texto.replace(/\D/g, "").slice(0, 4);
  return digitos.length <= 2 ? digitos : `${digitos.slice(0, 2)}:${digitos.slice(2)}`;
}

interface Props {
  visible: boolean;
  turno: CarrinhoTurno | null;
  ponto: CarrinhoPonto | null;
  pontos: CarrinhoPonto[];
  publicadores: CarrinhoPublicador[];
  diaInicial?: number;
  onClose: () => void;
}

/**
 * Cria ou edita um turno — um horário fixo semanal de um ponto — e define quem serve nele.
 *
 * Os turnos se repetem toda semana, então aqui não existe data: só dia da semana
 * e faixa de horário.
 */
export function TurnoSheet({
  visible,
  turno,
  ponto,
  pontos,
  publicadores,
  diaInicial,
  onClose,
}: Props) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const confirm = useConfirm();
  const criar = useCriarTurno();
  const atualizar = useAtualizarTurno();
  const excluir = useExcluirTurno();

  const [pontoId, setPontoId] = useState<number | null>(null);
  const [diaSemana, setDiaSemana] = useState(2);
  const [horaInicio, setHoraInicio] = useState("06:00");
  const [horaFim, setHoraFim] = useState("08:00");
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [busca, setBusca] = useState("");
  const [escolhendoPonto, setEscolhendoPonto] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPontoId(ponto?.id ?? null);
    setDiaSemana(turno?.diaSemana ?? diaInicial ?? 2);
    setHoraInicio(turno?.horaInicio ?? "06:00");
    setHoraFim(turno?.horaFim ?? "08:00");
    setSelecionados(new Set((turno?.publicadores ?? []).map((p) => p.id)));
    setBusca("");
    setEscolhendoPonto(false);
  }, [visible, turno, ponto, diaInicial]);

  const editando = !!turno;
  const salvando = criar.isPending || atualizar.isPending;

  const pontoAtual = useMemo(
    () => pontos.find((p) => p.id === pontoId) ?? ponto ?? null,
    [pontos, pontoId, ponto],
  );
  const cor = pontoAtual?.cor ?? colors.primary;

  // Ao editar o ponto não muda (o PUT de turno não aceita pontoId) e ao criar a partir
  // de um ponto ele já vem definido — nos dois casos o subtítulo basta.
  const podeEscolherPonto = !editando && !ponto;

  const opcoesPonto: SelectOption[] = useMemo(
    () =>
      pontos.map((p) => ({
        value: String(p.id),
        label: p.nome,
        color: p.cor,
      })),
    [pontos],
  );

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return publicadores;
    return publicadores.filter((p) => p.nome.toLowerCase().includes(termo));
  }, [publicadores, busca]);

  const alternar = (id: number) =>
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  // Mesma regra das outras folhas do carrinho: sem escopo, só consulta.
  const { usuario } = useAuth();
  const podeEditar = podeGerenciar(usuario, "carrinho");

  const salvar = async () => {
    if (!editando && !pontoId) {
      toast.show("Escolha o ponto", "error");
      return;
    }
    if (!HORA.test(horaInicio)) {
      toast.show("Hora de início inválida (use HH:MM)", "error");
      return;
    }
    if (!HORA.test(horaFim)) {
      toast.show("Hora de término inválida (use HH:MM)", "error");
      return;
    }
    if (horaFim <= horaInicio) {
      toast.show("O término precisa ser depois do início", "error");
      return;
    }

    const publicadorIds = [...selecionados];
    try {
      if (editando && turno) {
        await atualizar.mutateAsync({
          id: turno.id,
          diaSemana,
          horaInicio,
          horaFim,
          publicadorIds,
        });
        toast.show("Turno atualizado");
      } else {
        await criar.mutateAsync({
          pontoId: pontoId as number,
          diaSemana,
          horaInicio,
          horaFim,
          publicadorIds,
        });
        toast.show("Turno criado");
      }
      onClose();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao salvar", "error");
    }
  };

  const remover = () => {
    if (!turno) return;
    confirm.confirm({
      title: "Excluir turno",
      message: "As pessoas continuam cadastradas — só este horário sai da grade.",
      type: "danger",
      confirmText: "Excluir",
      onConfirm: async () => {
        try {
          await excluir.mutateAsync(turno.id);
          toast.show("Turno excluído");
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
        <View style={styles.flex}>
          <Text style={styles.title}>{editando ? "Editar turno" : "Novo turno"}</Text>
          {pontoAtual ? (
            <Text style={[styles.sub, { color: pontoAtual.cor }]} numberOfLines={1}>
              {pontoAtual.nome}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
          <Ionicons name="close" size={18} color="#7A7060" />
        </Pressable>
      </View>

      {podeEscolherPonto ? (
        <View style={styles.bloco}>
          <Text style={styles.label}>Ponto</Text>
          <Pressable onPress={() => setEscolhendoPonto(true)} style={styles.seletor}>
            <View style={[styles.bolinha, { backgroundColor: cor }]} />
            <Text
              style={[styles.seletorTexto, !pontoAtual && styles.seletorVazio]}
              numberOfLines={1}
            >
              {pontoAtual?.nome ?? "Escolha o ponto"}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.bloco}>
        <Text style={styles.label}>Dia da semana</Text>
        <View style={styles.diasRow}>
          {DIAS_CURTOS.map((d, i) => {
            const active = i === diaSemana;
            return (
              <Pressable
                key={d}
                onPress={() => setDiaSemana(i)}
                style={[
                  styles.diaChip,
                  active && { backgroundColor: cor, borderColor: cor },
                ]}
              >
                <Text style={[styles.diaChipText, active && styles.diaChipTextActive]}>
                  {d}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.bloco}>
        <Text style={styles.label}>Faixa de horário</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.faixasRow}
          keyboardShouldPersistTaps="handled"
        >
          {FAIXAS_PADRAO.map(([inicio, fim]) => {
            const active = inicio === horaInicio && fim === horaFim;
            return (
              <Pressable
                key={`${inicio}-${fim}`}
                onPress={() => {
                  setHoraInicio(inicio);
                  setHoraFim(fim);
                }}
                style={[
                  styles.faixaChip,
                  active && { backgroundColor: cor, borderColor: cor },
                ]}
              >
                <Text style={[styles.faixaText, active && styles.faixaTextActive]}>
                  {inicio} - {fim}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.horasRow}>
          <View style={styles.flex}>
            <Text style={styles.labelLeve}>Início</Text>
            <TextInput
              value={horaInicio}
              onChangeText={(t) => setHoraInicio(mascaraHora(t))}
              placeholder="06:00"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={5}
              style={styles.input}
            />
          </View>
          <View style={styles.flex}>
            <Text style={styles.labelLeve}>Término</Text>
            <TextInput
              value={horaFim}
              onChangeText={(t) => setHoraFim(mascaraHora(t))}
              placeholder="08:00"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={5}
              style={styles.input}
            />
          </View>
        </View>
      </View>

      <View style={[styles.bloco, styles.blocoPessoas]}>
        <Text style={styles.label}>Quem serve ({selecionados.size})</Text>
        <View style={styles.buscaWrap}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar pessoa..."
            placeholderTextColor={colors.textMuted}
            style={styles.buscaInput}
          />
        </View>

        <ScrollView
          style={styles.pessoasScroll}
          contentContainerStyle={styles.pessoasWrap}
          keyboardShouldPersistTaps="handled"
        >
          {lista.length === 0 ? (
            <Text style={styles.vazio}>
              {publicadores.length === 0
                ? "Nenhuma pessoa cadastrada ainda."
                : "Ninguém encontrado."}
            </Text>
          ) : (
            lista.map((p) => {
              const marcado = selecionados.has(p.id);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => alternar(p.id)}
                  style={[
                    styles.pessoaChip,
                    marcado && { backgroundColor: cor, borderColor: cor },
                  ]}
                >
                  <Text
                    style={[
                      styles.pessoaNome,
                      !p.ativo && styles.pessoaNomeInativa,
                      marcado && styles.pessoaNomeMarcada,
                    ]}
                    numberOfLines={1}
                  >
                    {p.nome}
                  </Text>
                  {!p.ativo ? (
                    <Text style={[styles.tagInativa, marcado && styles.tagInativaMarcada]}>
                      (inativa)
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        {editando && podeEditar ? (
          <Pressable onPress={remover} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.red} />
          </Pressable>
        ) : null}
        <Pressable onPress={podeEditar ? salvar : undefined} disabled={salvando || !podeEditar} style={styles.saveBtn}>
          <Text style={styles.saveText}>{salvando ? "Salvando..." : "Salvar"}</Text>
        </Pressable>
      </View>

      <SelectSheet
        visible={escolhendoPonto}
        title="Ponto do carrinho"
        options={opcoesPonto}
        selected={pontoId ? String(pontoId) : undefined}
        onSelect={(v) => setPontoId(Number(v))}
        onClose={() => setEscolhendoPonto(false)}
        allowClear={false}
      />

      <ConfirmDialog config={confirm.config} onClose={confirm.close} />
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
    },
    title: { fontSize: 23, fontWeight: "600", color: colors.text },
    sub: { fontSize: 13, fontWeight: "600", marginTop: 2 },
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
    bloco: { marginBottom: 16 },
    // Em tela baixa a folha bate no teto: só esta parte encolhe, para o Salvar
    // continuar visível em vez de ser empurrado para fora.
    blocoPessoas: { flexShrink: 1 },
    label: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: colors.textMuted,
    },
    labelLeve: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
    seletor: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 9,
      height: 48,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      paddingHorizontal: 14,
    },
    bolinha: { width: 12, height: 12, borderRadius: radius.pill },
    seletorTexto: { flex: 1, fontSize: 15, color: colors.text },
    seletorVazio: { color: colors.textMuted },
    diasRow: { flexDirection: "row", gap: 6, marginTop: 9 },
    diaChip: {
      flex: 1,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    diaChipText: { fontSize: 12.5, fontWeight: "600", color: colors.textSecondary },
    diaChipTextActive: { color: colors.textOnPrimary },
    faixasRow: { gap: 6, paddingVertical: 9, paddingRight: 4 },
    faixaChip: {
      height: 34,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    faixaText: { fontSize: 12.5, fontWeight: "600", color: colors.textSecondary },
    faixaTextActive: { color: colors.textOnPrimary },
    horasRow: { flexDirection: "row", gap: 11, marginTop: 4 },
    input: {
      marginTop: 6,
      height: 46,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      paddingHorizontal: 14,
      fontSize: 15,
      color: colors.text,
      textAlign: "center",
    },
    buscaWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 9,
      height: 44,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      paddingHorizontal: 13,
    },
    buscaInput: { flex: 1, fontSize: 14.5, color: colors.text, paddingVertical: 0 },
    pessoasScroll: { maxHeight: PESSOAS_MAX, marginTop: 10, flexShrink: 1 },
    pessoasWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, paddingBottom: 4 },
    pessoaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      maxWidth: "100%",
      height: 34,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 13,
    },
    pessoaNome: { flexShrink: 1, fontSize: 13.5, fontWeight: "500", color: colors.text },
    pessoaNomeInativa: { color: colors.textMuted },
    pessoaNomeMarcada: { color: colors.textOnPrimary },
    tagInativa: { fontSize: 11, color: colors.textMuted },
    tagInativaMarcada: { color: colors.sand },
    vazio: { fontSize: 13.5, color: colors.textMuted, paddingVertical: 12 },
    footer: { flexDirection: "row", gap: 11, marginTop: 4 },
    deleteBtn: {
      width: 52,
      height: 52,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: `${colors.red}44`,
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
    flex: { flex: 1, minWidth: 0 },
  });
