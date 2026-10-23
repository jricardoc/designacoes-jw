import { Ionicons } from "@expo/vector-icons";
import { Alert, Linking, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useLinkCalendario } from "@/api/hooks/usePioneiro";
import { Button, useToast } from "@/components/ui";
import { API_URL } from "@/config/env";
import { type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { Vidro } from "./kit";

/**
 * "Acompanhamentos no Calendário": um link privado que o app Calendário do celular assina uma
 * vez. As visitas marcadas e os planos de saída aparecem lá e se atualizam sozinhos (o
 * servidor monta o .ics na hora; o celular busca de hora em hora).
 */
export function CartaoCalendario() {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const link = useLinkCalendario();

  const assinar = async (trocar: boolean) => {
    try {
      const { token } = await link.mutateAsync(trocar);
      const https = `${API_URL}/calendario/${token}.ics`;
      if (Platform.OS === "ios") {
        // webcal:// abre direto o "Assinar calendário" do iPhone.
        await Linking.openURL(https.replace(/^https?:/, "webcal:"));
      } else {
        // O Google Agenda assina por URL só no computador: o link vai por mensagem.
        await Share.share({ message: `Calendário do ministério (Google Agenda > Outras agendas > Do URL):\n${https}` });
      }
      if (trocar) toast.show("Link trocado: o antigo parou de funcionar");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Não deu para abrir o calendário", "error");
    }
  };

  const trocar = () =>
    Alert.alert("Trocar o link do calendário?", "O link antigo para de funcionar. Use se mandou o link para alguém por engano.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Trocar", style: "destructive", onPress: () => assinar(true) },
    ]);

  return (
    <Vidro style={styles.cartao}>
      <View style={styles.linha}>
        <View style={styles.icone}>
          <Ionicons name="calendar" size={22} color={colors.primaryDark} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.titulo}>Acompanhamentos no Calendário</Text>
          <Text style={styles.texto}>Suas visitas marcadas e seus planos de saída no app Calendário do celular, sempre atualizados.</Text>
        </View>
      </View>
      <Button
        label={Platform.OS === "ios" ? "Assinar no Calendário" : "Mandar o link do calendário"}
        icon={Platform.OS === "ios" ? "add-circle-outline" : "share-social-outline"}
        variant="secondary"
        onPress={() => assinar(false)}
        loading={link.isPending}
        fullWidth
      />
      <Pressable onPress={trocar} hitSlop={8} accessibilityRole="button" style={styles.trocar}>
        <Text style={styles.trocarTexto}>Trocar o link</Text>
      </Pressable>
    </Vidro>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    cartao: { gap: 12 },
    linha: { flexDirection: "row", gap: 12 },
    flex: { flex: 1 },
    icone: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.sand },
    titulo: { fontSize: 16, fontWeight: "800", color: colors.text },
    texto: { fontSize: 13.5, color: colors.textSecondary, marginTop: 2, lineHeight: 19 },
    trocar: { alignSelf: "center" },
    trocarTexto: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  });
