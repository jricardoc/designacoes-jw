import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIrmaos } from "@/api/hooks/useIrmaos";
import {
  useAssistencias,
  usePresencasZoom,
  useSalvarAssistencia,
  useSalvarPresencasZoom,
} from "@/api/hooks/useReunioes";
import type { PresencaZoom, TipoAssistencia } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { Button, GradientHeader, Loading, TextField, useToast } from "@/components/ui";
import { DIAS_CURTOS, radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/** Acentos e maiúsculas fora da busca: "joao" acha "João". */
const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const ROTULO: Record<TipoAssistencia, string> = { meio: "Meio de semana", fds: "Fim de semana" };

/**
 * Quem assistiu pelo Zoom numa reunião, e quem levantou a mão.
 *
 * Cada linha é uma conexão: um irmão do cadastro, ou o nome como aparece no Zoom (visitante).
 * "Pessoas" conta a família no mesmo aparelho; a soma é conferida com o número do Zoom que foi
 * contado na reunião, e dá para usar a soma como a contagem. Salvar regrava a lista inteira.
 */
export default function ZoomScreen() {
  const params = useLocalSearchParams<{ data: string; tipo: TipoAssistencia }>();
  const data = String(params.data ?? "").replace(/-/g, "/");
  const tipo: TipoAssistencia = params.tipo === "fds" ? "fds" : "meio";
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { feito } = useCelebracao();
  const { data: assistencias, isLoading: carregandoAssistencias } = useAssistencias();
  const registro = assistencias?.find((a) => a.data === data && a.tipo === tipo);
  const { data: salvas, isLoading: carregandoLista } = usePresencasZoom(registro?.id);
  const { data: irmaos } = useIrmaos();
  const salvar = useSalvarPresencasZoom();
  const salvarContagem = useSalvarAssistencia();

  const [lista, setLista] = useState<PresencaZoom[] | null>(null);
  const [busca, setBusca] = useState("");

  // Começa pelo que está salvo (ou vazia, se a reunião ainda não tem registro). Só uma vez:
  // um refetch depois de salvar não pode atropelar o que está sendo editado.
  useEffect(() => {
    if (lista !== null || carregandoAssistencias) return;
    if (!registro) setLista([]);
    else if (salvas) setLista(salvas.map(({ nome, irmaoId, pessoas, levantouMao }) => ({ nome, irmaoId, pessoas, levantouMao })));
  }, [lista, carregandoAssistencias, registro, salvas]);

  const sugestoes = useMemo(() => {
    const termo = normalizar(busca);
    if (termo.length < 2 || !irmaos || !lista) return [];
    return irmaos
      .filter((i) => i.ativo && normalizar(i.nome).includes(termo) && !lista.some((p) => p.irmaoId === i.id))
      .slice(0, 6);
  }, [busca, irmaos, lista]);

  if (carregandoAssistencias || (registro && carregandoLista) || lista === null) {
    return <Loading label="Carregando a lista do Zoom..." />;
  }

  const pessoas = lista.reduce((s, p) => s + p.pessoas, 0);
  const maos = lista.filter((p) => p.levantouMao).length;
  const contado = registro?.zoom ?? null;
  const original = JSON.stringify(
    (salvas ?? []).map(({ nome, irmaoId, pessoas: n, levantouMao }) => ({ nome, irmaoId, pessoas: n, levantouMao })),
  );
  const alterada = JSON.stringify(lista) !== original;

  const [d, m, a] = data.split("/").map(Number);
  const titulo = `${DIAS_CURTOS[new Date(a, m - 1, d).getDay()]}, ${data} · ${ROTULO[tipo]}`;

  const adicionar = (nome: string, irmaoId: number | null) => {
    const limpo = nome.replace(/\s+/g, " ").trim();
    if (!limpo) return;
    if (lista.some((p) => normalizar(p.nome) === normalizar(limpo))) {
      toast.show(`${limpo} já está na lista`);
      return;
    }
    setLista([...lista, { nome: limpo, irmaoId, pessoas: 1, levantouMao: false }]);
    setBusca("");
  };
  const alterar = (i: number, mudanca: Partial<PresencaZoom>) =>
    setLista(lista.map((p, j) => (j === i ? { ...p, ...mudanca } : p)));
  const remover = (i: number) => setLista(lista.filter((_, j) => j !== i));

  const gravar = () =>
    salvar.mutate(
      { data, tipo, presencas: lista },
      {
        onSuccess: () =>
          feito({
            titulo: "Lista do Zoom salva",
            detalhe: `${lista.length} ${lista.length === 1 ? "conexão" : "conexões"} · ${pessoas} pessoas`,
            icone: "videocam",
          }),
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para salvar", "error"),
      },
    );

  const usarSomaComoContagem = () =>
    salvarContagem.mutate(
      { data, tipo, presencial: registro?.presencial ?? 0, zoom: pessoas },
      {
        onSuccess: () => feito({ titulo: "Contagem do Zoom atualizada", detalhe: `${pessoas} pelo Zoom`, icone: "checkmark" }),
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para salvar", "error"),
      },
    );

  return (
    <View style={styles.tela}>
      <GradientHeader title="Pelo Zoom" description={titulo} showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.resumo}>
          <View style={styles.numero}>
            <Text style={styles.numeroValor}>{lista.length}</Text>
            <Text style={styles.numeroRotulo}>conexões</Text>
          </View>
          <View style={styles.numero}>
            <Text style={styles.numeroValor}>{pessoas}</Text>
            <Text style={styles.numeroRotulo}>pessoas</Text>
          </View>
          <View style={styles.numero}>
            <Text style={styles.numeroValor}>{maos}</Text>
            <Text style={styles.numeroRotulo}>mãos levantadas</Text>
          </View>
        </View>

        {contado === null ? (
          <Text style={styles.aviso}>A contagem desta reunião ainda não foi registrada.</Text>
        ) : contado === pessoas ? (
          <View style={[styles.conferencia, { backgroundColor: colors.successBg }]}>
            <Ionicons name="checkmark-circle" size={18} color={colors.greenDark} />
            <Text style={[styles.conferenciaTexto, { color: colors.greenDark }]}>
              Bate com a contagem do Zoom ({contado})
            </Text>
          </View>
        ) : (
          <View style={[styles.conferencia, { backgroundColor: colors.warningBg }]}>
            <Ionicons name="alert-circle" size={18} color={colors.amber} />
            <Text style={[styles.conferenciaTexto, { color: colors.amber }]}>
              A lista soma {pessoas}; a contagem registrada pelo Zoom é {contado}.
            </Text>
          </View>
        )}
        {contado !== pessoas && pessoas > 0 ? (
          <Button
            label={`Usar ${pessoas} como contagem do Zoom`}
            icon="calculator-outline"
            variant="secondary"
            onPress={usarSomaComoContagem}
            loading={salvarContagem.isPending}
            fullWidth
          />
        ) : null}

        <TextField
          label="Adicionar"
          icon="person-add-outline"
          placeholder="Nome do irmão, ou como aparece no Zoom"
          value={busca}
          onChangeText={setBusca}
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => adicionar(busca, null)}
        />
        {busca.trim().length >= 2 ? (
          <View style={styles.sugestoes}>
            {sugestoes.map((i) => (
              <Pressable key={i.id} style={styles.sugestao} onPress={() => adicionar(i.nome, i.id)}>
                <Ionicons name="person-circle-outline" size={20} color={colors.primaryDark} />
                <Text style={styles.sugestaoTexto}>{i.nome}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.sugestao} onPress={() => adicionar(busca, null)}>
              <Ionicons name="add-circle-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.sugestaoTexto}>Adicionar “{busca.trim()}” (sem cadastro)</Text>
            </Pressable>
          </View>
        ) : null}

        {lista.length === 0 ? (
          <Text style={styles.vazio}>Ninguém na lista ainda. Busque pelo nome acima.</Text>
        ) : (
          <View style={styles.lista}>
            {lista.map((p, i) => (
              <View key={p.nome} style={[styles.linha, i > 0 && styles.divisoria]}>
                <View style={styles.linhaTextos}>
                  <Text style={styles.nome} numberOfLines={1}>
                    {p.nome}
                  </Text>
                  <Text style={styles.origem}>{p.irmaoId ? "Cadastro" : "Sem cadastro"}</Text>
                </View>
                <View style={styles.contador}>
                  <Pressable
                    style={styles.contadorBotao}
                    onPress={() => alterar(i, { pessoas: Math.max(1, p.pessoas - 1) })}
                    hitSlop={6}
                    accessibilityLabel={`Menos uma pessoa em ${p.nome}`}
                  >
                    <Ionicons name="remove" size={16} color={colors.text} />
                  </Pressable>
                  <Text style={styles.contadorValor}>{p.pessoas}</Text>
                  <Pressable
                    style={styles.contadorBotao}
                    onPress={() => alterar(i, { pessoas: Math.min(30, p.pessoas + 1) })}
                    hitSlop={6}
                    accessibilityLabel={`Mais uma pessoa em ${p.nome}`}
                  >
                    <Ionicons name="add" size={16} color={colors.text} />
                  </Pressable>
                </View>
                <Pressable
                  style={[styles.mao, p.levantouMao && { backgroundColor: colors.primary }]}
                  onPress={() => alterar(i, { levantouMao: !p.levantouMao })}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: p.levantouMao }}
                  accessibilityLabel={`${p.nome} levantou a mão`}
                >
                  <Ionicons
                    name={p.levantouMao ? "hand-left" : "hand-left-outline"}
                    size={18}
                    color={p.levantouMao ? colors.textOnPrimary : colors.textSecondary}
                  />
                </Pressable>
                <Pressable onPress={() => remover(i)} hitSlop={8} accessibilityLabel={`Tirar ${p.nome} da lista`}>
                  <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Button
          label={alterada ? "Salvar lista" : "Lista salva"}
          icon="checkmark"
          onPress={gravar}
          loading={salvar.isPending}
          disabled={!alterada}
          fullWidth
        />
      </ScrollView>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, gap: 12 },
    resumo: { flexDirection: "row", gap: 10 },
    numero: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    numeroValor: { fontSize: 26, fontWeight: "900", color: colors.text },
    numeroRotulo: { fontSize: 12, color: colors.textSecondary, textAlign: "center" },
    aviso: { fontSize: 13.5, color: colors.textSecondary },
    conferencia: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: radius.md },
    conferenciaTexto: { flex: 1, fontSize: 13.5, fontWeight: "700" },
    sugestoes: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginTop: -4,
    },
    sugestao: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
    sugestaoTexto: { flex: 1, fontSize: 15, color: colors.text },
    vazio: { fontSize: 14, color: colors.textMuted, textAlign: "center", paddingVertical: 12 },
    lista: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
    },
    linha: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
    divisoria: { borderTopWidth: 1, borderTopColor: colors.border },
    linhaTextos: { flex: 1, gap: 1 },
    nome: { fontSize: 15, fontWeight: "700", color: colors.text },
    origem: { fontSize: 12, color: colors.textMuted },
    contador: { flexDirection: "row", alignItems: "center", gap: 6 },
    contadorBotao: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    contadorValor: { minWidth: 18, textAlign: "center", fontSize: 15, fontWeight: "800", color: colors.text },
    mao: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
