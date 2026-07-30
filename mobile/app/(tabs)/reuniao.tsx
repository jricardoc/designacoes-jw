import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useImportarReuniao } from "@/api/hooks/useReunioes";
import { useReunioes } from "@/api/hooks/useMisc";
import type { IndisponibilidadePreview, Reuniao, SemanaReuniao } from "@/api/types";
import { EmptyState, GradientHeader, Loading, useToast } from "@/components/ui";
import { ImportIndisponibilidadeSheet } from "@/components/reuniao/ImportIndisponibilidadeSheet";
import { SemanaCard } from "@/components/reuniao/SemanaCard";
import { SemanaShareCard } from "@/components/reuniao/SemanaShareCard";
import { colors, MESES, radius } from "@/theme";
import { exportarImagem } from "@/utils/exportImagem";
import { exportarPdf } from "@/utils/exportPdf";
import { gerarHtmlSemana } from "@/utils/pdfHtml";
import { datasDaSemana } from "@/utils/semanaReuniao";

/** A semana escolhida junto do mês/ano dela — o PDF precisa dos dois para o cabeçalho. */
interface Alvo {
  reuniao: Reuniao;
  semana: SemanaReuniao;
}

export default function ReuniaoScreen() {
  const { data: reunioes, isLoading, refetch, isRefetching } = useReunioes();
  const importar = useImportarReuniao();
  const toast = useToast();

  const [preview, setPreview] = useState<IndisponibilidadePreview | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  // Mesma mecânica do quadro: montar o cartão fora da tela é o que dispara a captura.
  const [alvoImagem, setAlvoImagem] = useState<Alvo | null>(null);
  const [pdfDe, setPdfDe] = useState<number | null>(null);
  const shotRef = useRef<View>(null);
  const capturando = useRef(false);

  const nomeArquivo = (alvo: Alvo, ext: string) => {
    const { meio } = datasDaSemana(alvo.semana);
    const marca = meio ? meio.diaMes.replace("/", "-") : String(alvo.semana.id);
    const mes = (MESES[alvo.reuniao.mes] ?? "mes").toLowerCase();
    return `reuniao-${marca}-${mes}-${alvo.reuniao.ano}.${ext}`;
  };

  const gerarPdf = async (alvo: Alvo) => {
    setPdfDe(alvo.semana.id);
    try {
      const html = gerarHtmlSemana(
        alvo.reuniao,
        alvo.semana,
        datasDaSemana(alvo.semana),
      );
      await exportarPdf(html, nomeArquivo(alvo, "pdf"));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao gerar PDF", "error");
    } finally {
      setPdfDe(null);
    }
  };

  /** Chamado pelo onLayout do cartão escondido — antes disso a imagem sai em branco. */
  const capturarSemana = async () => {
    if (!alvoImagem || capturando.current) return;
    capturando.current = true;
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      await exportarImagem(shotRef, nomeArquivo(alvoImagem, "png"));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao gerar imagem", "error");
    } finally {
      setAlvoImagem(null);
      capturando.current = false;
    }
  };

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

      if (temMatches) {
        setPreview(indisp);
        setSheetVisible(true);
      } else {
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
        }
      />

      {isLoading ? (
        <Loading label="Carregando reuniões..." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
        >
          {reunioes && reunioes.length > 0 ? (
            reunioes.map((r) => (
              <View key={r.id} style={styles.mesGroup}>
                <Text style={styles.mesTitulo}>
                  {MESES[r.mes]} {r.ano}
                </Text>
                <View style={styles.semanas}>
                  {r.semanas.map((s, i) => (
                    <SemanaCard
                      key={s.id}
                      semana={s}
                      index={i}
                      onPdf={() => gerarPdf({ reuniao: r, semana: s })}
                      onCompartilhar={() => setAlvoImagem({ reuniao: r, semana: s })}
                      gerandoPdf={pdfDe === s.id}
                      compartilhando={alvoImagem?.semana.id === s.id}
                    />
                  ))}
                </View>
              </View>
            ))
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="Nenhuma reunião importada"
              message='Toque em "Importar PDF" no topo para enviar a programação.'
            />
          )}
        </ScrollView>
      )}

      {/* Fora da tela de propósito: precisa estar montado e com layout para o view-shot
          capturar, mas não pode aparecer para o usuário. */}
      {alvoImagem ? (
        <View style={styles.shotHost} pointerEvents="none" onLayout={capturarSemana}>
          <SemanaShareCard
            ref={shotRef}
            reuniao={alvoImagem.reuniao}
            semana={alvoImagem.semana}
          />
        </View>
      ) : null}

      <ImportIndisponibilidadeSheet
        visible={sheetVisible}
        preview={preview}
        onClose={() => setSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  // Longe da área visível, sem opacity 0: view invisível por opacidade sai em branco no
  // print de alguns Android.
  shotHost: { position: "absolute", left: -10000, top: 0 },
});
