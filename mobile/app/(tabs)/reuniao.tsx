import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
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
import type { IndisponibilidadePreview } from "@/api/types";
import { EmptyState, GradientHeader, Loading, useToast } from "@/components/ui";
import { ImportIndisponibilidadeSheet } from "@/components/reuniao/ImportIndisponibilidadeSheet";
import { SemanaCard } from "@/components/reuniao/SemanaCard";
import { colors, MESES, radius } from "@/theme";

export default function ReuniaoScreen() {
  const { data: reunioes, isLoading, refetch, isRefetching } = useReunioes();
  const importar = useImportarReuniao();
  const toast = useToast();

  const [preview, setPreview] = useState<IndisponibilidadePreview | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

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
                    <SemanaCard key={s.id} semana={s} index={i} />
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
});
