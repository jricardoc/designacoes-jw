import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApagarRevisita, useRevisita, useSalvarRevisita } from "@/api/hooks/usePioneiro";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { diaCurto, isoDoDia, quando } from "@/components/ministerio/escolhas";
import { RevisitaSheet } from "@/components/ministerio/RevisitaSheet";
import { VisitaSheet } from "@/components/ministerio/VisitaSheet";
import { Button, EmptyState, GradientHeader, Loading, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { usePuxar } from "@/utils/usePuxar";

/** Uma revisita: a próxima visita, como chegar, o contato, as notas e o histórico de visitas. */
export default function RevisitaScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { feito } = useCelebracao();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data: r, isLoading, refetch } = useRevisita(id);
  const salvar = useSalvarRevisita();
  const apagar = useApagarRevisita();
  const puxar = usePuxar(refetch);
  const [editando, setEditando] = useState(false);
  const [visitando, setVisitando] = useState(false);

  if (isLoading && !r) return <Loading label="Carregando..." />;
  if (!r) {
    return (
      <View style={styles.tela}>
        <GradientHeader title="Revisita" showBack />
        <EmptyState icon="cloud-offline-outline" title="Não deu para carregar" message="Puxe para tentar de novo." />
      </View>
    );
  }

  const abrir = (url: string) => Linking.openURL(url).catch(() => toast.show("Não consegui abrir", "error"));
  const comoChegar = () => {
    if (r.lat != null && r.lng != null) {
      abrir(Platform.OS === "ios" ? `http://maps.apple.com/?daddr=${r.lat},${r.lng}` : `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`);
    } else if (r.endereco) {
      abrir(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.endereco)}`);
    }
  };
  const digitos = (r.telefone || "").replace(/\D/g, "");
  const whatsapp = digitos.length >= 10 ? `https://wa.me/${digitos.startsWith("55") ? digitos : `55${digitos}`}` : null;
  const hoje = isoDoDia(new Date());

  const arquivar = () =>
    salvar.mutate(
      { id: r.id, ativa: !r.ativa },
      {
        onSuccess: () => feito({ titulo: r.ativa ? "Revisita arquivada" : "Revisita de volta", detalhe: r.nome, icone: r.ativa ? "archive" : "refresh" }),
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu", "error"),
      },
    );
  const confirmarApagar = () =>
    Alert.alert("Apagar esta revisita?", "Some também o histórico de visitas. Para só tirar da lista, use Arquivar.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: () =>
          apagar.mutate(r.id, {
            onSuccess: () => router.back(),
            onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu", "error"),
          }),
      },
    ]);

  return (
    <View style={styles.tela}>
      <GradientHeader title={r.nome} description={r.estudo ? "Estudo bíblico" : "Revisita"} showBack />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]} refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}>
        {!r.ativa ? (
          <View style={styles.aviso}>
            <Ionicons name="archive-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.avisoTexto}>Arquivada: não aparece na lista nem conta nos estudos.</Text>
          </View>
        ) : null}

        <View style={styles.bloco}>
          <Text style={styles.rotulo}>Próxima visita</Text>
          <Text style={[styles.proxima, r.proximaVisita && isoDoDia(new Date(r.proximaVisita)) === hoje && { color: colors.amber }]}>
            {r.proximaVisita ? quando(r.proximaVisita) : "Nenhuma marcada"}
          </Text>
          <Button label="Registrar visita" icon="checkmark-done" onPress={() => setVisitando(true)} fullWidth />
        </View>

        {r.endereco || r.lat != null || r.telefone ? (
          <View style={styles.bloco}>
            {r.endereco ? <Text style={styles.texto}>{r.endereco}</Text> : null}
            <View style={styles.acoes}>
              {r.endereco || r.lat != null ? (
                <Pressable style={styles.acao} onPress={comoChegar} accessibilityRole="button">
                  <Ionicons name="navigate-outline" size={18} color={colors.primaryDark} />
                  <Text style={styles.acaoTexto}>Como chegar</Text>
                </Pressable>
              ) : null}
              {whatsapp ? (
                <Pressable style={styles.acao} onPress={() => abrir(whatsapp)} accessibilityRole="button">
                  <Ionicons name="logo-whatsapp" size={18} color={colors.greenDark} />
                  <Text style={styles.acaoTexto}>WhatsApp</Text>
                </Pressable>
              ) : null}
              {digitos ? (
                <Pressable style={styles.acao} onPress={() => abrir(`tel:${digitos}`)} accessibilityRole="button">
                  <Ionicons name="call-outline" size={18} color={colors.primaryDark} />
                  <Text style={styles.acaoTexto}>Ligar</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {r.observacao ? (
          <View style={styles.bloco}>
            <Text style={styles.rotulo}>Observações</Text>
            <Text style={styles.texto}>{r.observacao}</Text>
          </View>
        ) : null}

        <View style={styles.bloco}>
          <Text style={styles.rotulo}>Visitas ({r.visitas.length})</Text>
          {r.visitas.length === 0 ? (
            <Text style={styles.nota}>Nenhuma visita registrada ainda.</Text>
          ) : (
            r.visitas.map((v) => (
              <View key={v.id} style={styles.visita}>
                <Text style={styles.visitaData}>{diaCurto(isoDoDia(new Date(v.data)))}</Text>
                {v.observacao ? <Text style={styles.texto}>{v.observacao}</Text> : null}
              </View>
            ))
          )}
        </View>

        <View style={styles.acoes}>
          <Button label="Editar" icon="create-outline" variant="secondary" onPress={() => setEditando(true)} style={styles.flex} />
          <Button label={r.ativa ? "Arquivar" : "Desarquivar"} icon="archive-outline" variant="secondary" onPress={arquivar} style={styles.flex} />
        </View>
        <Button label="Apagar" icon="trash-outline" variant="ghost" onPress={confirmarApagar} loading={apagar.isPending} fullWidth />
      </ScrollView>

      <RevisitaSheet visible={editando} onClose={() => setEditando(false)} revisita={r} />
      <VisitaSheet revisitaId={visitando ? r.id : null} nome={r.nome} onClose={() => setVisitando(false)} />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, gap: 12 },
    flex: { flex: 1 },
    aviso: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
    avisoTexto: { flex: 1, fontSize: 13, color: colors.textSecondary },
    bloco: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border },
    rotulo: { fontSize: 12, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8 },
    proxima: { fontSize: 20, fontWeight: "800", color: colors.text },
    texto: { fontSize: 14.5, color: colors.text, lineHeight: 20 },
    nota: { fontSize: 13, color: colors.textMuted },
    acoes: { flexDirection: "row", gap: 10 },
    acao: {
      flex: 1,
      alignItems: "center",
      gap: 4,
      paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
    acaoTexto: { fontSize: 12.5, fontWeight: "800", color: colors.text },
    visita: { gap: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
    visitaData: { fontSize: 13.5, fontWeight: "800", color: colors.primaryDark },
  });
