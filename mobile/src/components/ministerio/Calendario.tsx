import { Ionicons } from "@expo/vector-icons";
import { Alert, Linking, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useLinkCalendario, usePainelPioneiro } from "@/api/hooks/usePioneiro";
import { Button, useToast } from "@/components/ui";
import { API_URL } from "@/config/env";
import { type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { mesAtual, Vidro } from "./kit";

/**
 * "Acompanhamentos no Calendário": um link privado que o app Calendário do celular assina uma
 * vez. As visitas marcadas e os planos de saída aparecem lá e se atualizam sozinhos (o
 * servidor monta o .ics na hora; o celular busca de hora em hora).
 * Depois que o link existe, o convite sai da Agenda (`ocultarSeAssinado`) e vira um resumo em Perfil.
 */
export function CartaoCalendario({ ocultarSeAssinado }: { ocultarSeAssinado?: boolean }) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const link = useLinkCalendario();
  const assinado = !!usePainelPioneiro(mesAtual()).data?.calendario;
  const ios = Platform.OS === "ios";

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

  if (assinado && ocultarSeAssinado) return null;

  return (
    <Vidro style={styles.cartao}>
      <View style={styles.linha}>
        <View style={styles.icone}>
          <Ionicons name={assinado ? "checkmark-circle" : "calendar"} size={22} color={colors.primaryDark} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.titulo}>{assinado ? "Calendário assinado" : "Acompanhamentos no Calendário"}</Text>
          <Text style={styles.texto}>
            {assinado
              ? "Suas visitas marcadas e seus planos de saída vão para o calendário “Ministério” do celular."
              : "Suas visitas marcadas e seus planos de saída aparecem no calendário do celular, num calendário chamado “Ministério”. Ele se atualiza sozinho, mas pode levar algumas horas."}
          </Text>
        </View>
      </View>
      {assinado ? null : (
        <Button
          label={ios ? "Assinar no Calendário" : "Mandar o link do calendário"}
          icon={ios ? "add-circle-outline" : "share-social-outline"}
          variant="secondary"
          onPress={() => assinar(false)}
          loading={link.isPending}
          fullWidth
        />
      )}
      <View style={styles.links}>
        {assinado ? (
          <Pressable onPress={() => assinar(false)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.linkTexto}>{ios ? "Assinar de novo" : "Mandar o link de novo"}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={trocar} hitSlop={8} accessibilityRole="button">
          <Text style={styles.linkTexto}>Trocar o link</Text>
        </Pressable>
      </View>
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
    links: { flexDirection: "row", justifyContent: "center", gap: 24 },
    linkTexto: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  });
