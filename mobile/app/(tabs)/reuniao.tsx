import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAssistencias, useImportarReuniao } from "@/api/hooks/useReunioes";
import { useReunioes } from "@/api/hooks/useMisc";
import type { IndisponibilidadePreview, Reuniao } from "@/api/types";
import { EmptyState, GradientHeader, Loading, useToast } from "@/components/ui";
import { AssistenciaStats } from "@/components/reuniao/AssistenciaStats";
import { ImportIndisponibilidadeSheet } from "@/components/reuniao/ImportIndisponibilidadeSheet";
import { useSemanaAcoes, type Alvo } from "@/components/reuniao/useSemanaAcoes";
import { useAuth } from "@/context/AuthContext";
import { podeGerenciar } from "@/utils/permissoes";
import { MESES, radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { datasDaSemana } from "@/utils/semanaReuniao";

/**
 * A semana da programação que contém o dia de hoje (segunda a domingo,
 * inclusive). Semana sem data importada não concorre — melhor nenhum destaque
 * do que destacar a semana errada.
 */
function encontrarSemanaAtual(reunioes: Reuniao[] | undefined): Alvo | null {
  if (!reunioes) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  for (const reuniao of reunioes) {
    for (const semana of reuniao.semanas) {
      const { inicio, fds } = datasDaSemana(semana);
      if (!inicio || !fds) continue;
      if (hoje >= inicio.data && hoje <= fds.data) return { reuniao, semana };
    }
  }
  return null;
}

/**
 * Os meses que ficam NA tela: o atual e os futuros, do mais próximo para o mais
 * distante. Os anteriores moram atrás do botão "Todos os meses" — era a lista
 * deles, crescendo a cada importação, que fazia a tela ficar quilométrica. Se
 * só há passado importado, fica o mês mais recente para a tela não sair vazia.
 */
function separarMeses(reunioes: Reuniao[] | undefined): {
  emTela: Reuniao[];
  ocultos: number;
} {
  if (!reunioes || reunioes.length === 0) return { emTela: [], ocultos: 0 };
  const hoje = new Date();
  const chave = (ano: number, mes: number) => ano * 100 + mes;
  const chaveHoje = chave(hoje.getFullYear(), hoje.getMonth() + 1);
  const atuais = reunioes.filter((r) => chave(r.ano, r.mes) >= chaveHoje);
  // A API manda do mais novo para o mais velho (reunioes[0] é o mais recente).
  const emTela = (atuais.length > 0 ? atuais : [reunioes[0]])
    .slice()
    .sort((a, b) => chave(a.ano, a.mes) - chave(b.ano, b.mes));
  return { emTela, ocultos: reunioes.length - emTela.length };
}

export default function ReuniaoScreen() {
  const { colors, styles } = useTema(criarEstilos);
  // Importar programação muda dados da congregação inteira: só admin. PDF e
  // compartilhar continuam para todos — são exportações de leitura.
  const { usuario } = useAuth();
  const podeEditar = podeGerenciar(usuario, "reunioes");
  const { data: reunioes, isLoading, refetch, isRefetching } = useReunioes();
  // A mesma query que o AssistenciaStats lê — aqui só para o puxar-para-
  // atualizar renovar as estatísticas junto com a programação.
  const assistencias = useAssistencias();
  const importar = useImportarReuniao();
  const toast = useToast();
  const { renderSemana, overlays } = useSemanaAcoes();

  const [preview, setPreview] = useState<IndisponibilidadePreview | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const semanaAtual = useMemo(() => encontrarSemanaAtual(reunioes), [reunioes]);
  const { emTela, ocultos } = useMemo(() => separarMeses(reunioes), [reunioes]);

  const handleImport = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) return;

      const asset = res.assets[0];
      const resposta = await importar.mutateAsync({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
      });

      const indisp = resposta.indisponibilidades;
      const temMatches =
        indisp &&
        (indisp.confirmados?.length || 0) + (indisp.ambiguos?.length || 0) > 0;

      // O backend corrige o que dá para corrigir sozinho no arquivo (data que contradiz o
      // rótulo da semana, semana que veio sem título) e devolve o que mexeu. Vai em Alert,
      // não em toast: isso pede conferência, e o toast some sozinho em 3 segundos.
      const avisos = resposta.avisos ?? [];
      if (avisos.length > 0) {
        Alert.alert("Importado com avisos", avisos.join("\n\n"));
      }

      if (temMatches) {
        setPreview(indisp);
        setSheetVisible(true);
      } else if (avisos.length === 0) {
        toast.show(resposta.message || "Programação importada!");
      }
    } catch (err) {
      toast.show(
        err instanceof Error ? err.message : "Erro ao importar o PDF",
        "error",
      );
    }
  };

  return (
    <View style={styles.flex}>
      <GradientHeader
        title="Reunião"
        description="Programação da reunião do meio de semana"
        icon="people"
        colorsGradient={[colors.purple, colors.purpleDark]}
        right={
          podeEditar ? (
            <Pressable
              style={styles.importBtn}
              onPress={handleImport}
              disabled={importar.isPending}
              hitSlop={8}
            >
              {importar.isPending ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Ionicons name="cloud-upload-outline" size={16} color={colors.textOnPrimary} />
              )}
              <Text style={styles.importBtnText}>
                {importar.isPending ? "Enviando" : "Importar PDF"}
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      {isLoading ? (
        <Loading label="Carregando reuniões..." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching || assistencias.isRefetching}
              onRefresh={() => {
                refetch();
                assistencias.refetch();
              }}
            />
          }
        >
          {/* A semana em que estamos vem hasteada no topo, fora do mês dela:
              é o que o irmão procura em 9 de cada 10 aberturas da tela. */}
          {semanaAtual ? (
            <View style={styles.destaqueGrupo}>
              <View style={styles.destaqueBadge}>
                <Ionicons name="star" size={12} color={colors.textOnPrimary} />
                <Text style={styles.destaqueBadgeTexto}>Reunião desta semana</Text>
              </View>
              {renderSemana(semanaAtual.reuniao, semanaAtual.semana, 0, true)}
            </View>
          ) : null}

          {reunioes && reunioes.length > 0 ? (
            <>
              {emTela.map((r) => {
                // A semana destacada não repete na lista do mês.
                const semanas = r.semanas.filter(
                  (s) => s.id !== semanaAtual?.semana.id,
                );
                if (semanas.length === 0) return null;
                return (
                  <View key={r.id} style={styles.mesGroup}>
                    <Text style={styles.mesTitulo}>
                      {MESES[r.mes]} {r.ano}
                    </Text>
                    <View style={styles.semanas}>
                      {semanas.map((s, i) => renderSemana(r, s, i))}
                    </View>
                  </View>
                );
              })}

              {ocultos > 0 ? (
                <Pressable
                  style={styles.todosBtn}
                  onPress={() => router.push("/reuniao/meses")}
                >
                  <View style={styles.todosIcone}>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={colors.primaryDark}
                    />
                  </View>
                  <View style={styles.todosTextos}>
                    <Text style={styles.todosTitulo}>Todos os meses</Text>
                    <Text style={styles.todosDescricao}>
                      {ocultos === 1
                        ? "Ver mais 1 mês anterior"
                        : `Ver mais ${ocultos} meses anteriores`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}

              <AssistenciaStats podeRegistrar={podeEditar} />
            </>
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="Nenhuma reunião importada"
              message={
                podeEditar
                  ? 'Toque em "Importar PDF" no topo para enviar a programação.'
                  : "Quando um administrador importar a programação, ela aparece aqui."
              }
            />
          )}
        </ScrollView>
      )}

      {overlays}

      <ImportIndisponibilidadeSheet
        visible={sheetVisible}
        preview={preview}
        onClose={() => setSheetVisible(false)}
      />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: 40, gap: 20 },
    mesGroup: { gap: 12 },
    mesTitulo: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      textTransform: "capitalize",
    },
    semanas: { gap: 12 },
    destaqueGrupo: { gap: 8 },
    destaqueBadge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      paddingVertical: 5,
      paddingHorizontal: 11,
    },
    destaqueBadgeTexto: {
      color: colors.textOnPrimary,
      fontSize: 11.5,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    importBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
    },
    importBtnText: {
      color: colors.textOnPrimary,
      fontWeight: "700",
      fontSize: 13,
    },
    todosBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 14,
    },
    todosIcone: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.infoBg,
      alignItems: "center",
      justifyContent: "center",
    },
    todosTextos: { flex: 1, gap: 2 },
    todosTitulo: { fontSize: 15.5, fontWeight: "700", color: colors.text },
    todosDescricao: { fontSize: 13, color: colors.textSecondary },
  });
