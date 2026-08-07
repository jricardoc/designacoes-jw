import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useMemo, useRef, useState } from "react";
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
import { CompartilharReuniaoSheet } from "@/components/reuniao/CompartilharReuniaoSheet";
import { ImportIndisponibilidadeSheet } from "@/components/reuniao/ImportIndisponibilidadeSheet";
import { useAuth } from "@/context/AuthContext";
import { SemanaCard } from "@/components/reuniao/SemanaCard";
import { SemanaShareCard } from "@/components/reuniao/SemanaShareCard";
import { MESES, radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { exportarImagem } from "@/utils/exportImagem";
import { exportarPdf } from "@/utils/exportPdf";
import { gerarHtmlSemana } from "@/utils/pdfHtml";
import { datasDaSemana } from "@/utils/semanaReuniao";

/** A semana escolhida junto do mês/ano dela — o PDF precisa dos dois para o cabeçalho. */
interface Alvo {
  reuniao: Reuniao;
  semana: SemanaReuniao;
}

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

export default function ReuniaoScreen() {
  const { colors, styles } = useTema(criarEstilos);
  // Importar programação muda dados da congregação inteira: só admin. PDF e
  // compartilhar continuam para todos — são exportações de leitura.
  const { usuario } = useAuth();
  const isAdmin = !!usuario?.isAdmin;
  const { data: reunioes, isLoading, refetch, isRefetching } = useReunioes();
  const importar = useImportarReuniao();
  const toast = useToast();

  const [preview, setPreview] = useState<IndisponibilidadePreview | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  // Mesma mecânica do quadro: montar o cartão fora da tela é o que dispara a captura.
  const [alvoImagem, setAlvoImagem] = useState<Alvo | null>(null);
  // A semana cujo leque de opções de compartilhamento está aberto.
  const [alvoShare, setAlvoShare] = useState<Alvo | null>(null);
  const [pdfDe, setPdfDe] = useState<number | null>(null);
  const shotRef = useRef<View>(null);
  const capturando = useRef(false);

  const semanaAtual = useMemo(() => encontrarSemanaAtual(reunioes), [reunioes]);

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

  const renderSemana = (reuniao: Reuniao, semana: SemanaReuniao, index: number, destaque = false) => (
    <SemanaCard
      key={semana.id}
      semana={semana}
      index={index}
      destaque={destaque}
      onPdf={() => gerarPdf({ reuniao, semana })}
      onCompartilhar={() => setAlvoShare({ reuniao, semana })}
      gerandoPdf={pdfDe === semana.id}
      compartilhando={alvoImagem?.semana.id === semana.id}
    />
  );

  return (
    <View style={styles.flex}>
      <GradientHeader
        title="Reunião"
        description="Programação da reunião do meio de semana"
        icon="people"
        colorsGradient={[colors.purple, colors.purpleDark]}
        right={
          isAdmin ? (
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
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
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
            reunioes.map((r) => {
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
            })
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="Nenhuma reunião importada"
              message={
                isAdmin
                  ? 'Toque em "Importar PDF" no topo para enviar a programação.'
                  : "Quando um administrador importar a programação, ela aparece aqui."
              }
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

      <CompartilharReuniaoSheet
        semana={alvoShare?.semana ?? null}
        onClose={() => setAlvoShare(null)}
        onImagem={() => {
          if (alvoShare) setAlvoImagem(alvoShare);
        }}
      />

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
    // Longe da área visível, sem opacity 0: view invisível por opacidade sai em branco no
    // print de alguns Android.
    shotHost: { position: "absolute", left: -10000, top: 0 },
  });
