import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useConfirmarParte } from "@/api/hooks/useMinhasDesignacoes";
import type { Compromisso } from "@/api/types";
import { useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/**
 * "Confirmo" / "Não posso" da parte de estudante. A resposta é a mesma linha que quem cuida das
 * Confirmações vê, e o "não posso" avisa essa pessoa na hora. Tocar de novo na escolhida desfaz.
 */
export function RespostaParte({ compromisso }: { compromisso: Compromisso }) {
  const { colors, styles } = useTema(criarEstilos);
  const confirmar = useConfirmarParte();
  const toast = useToast();
  const atual = compromisso.confirmacao?.confirmou ?? null;

  const responder = (confirmou: boolean) =>
    confirmar.mutate(
      { id: compromisso.id, confirmou: atual === confirmou ? null : confirmou },
      { onError: (e) => toast.show(e instanceof Error ? e.message : "Não consegui responder agora", "error") },
    );

  const opcao = (confirmou: boolean) => {
    const marcada = atual === confirmou;
    const cor = confirmou ? colors.greenDark : colors.red;
    return (
      <Pressable
        onPress={() => responder(confirmou)}
        style={({ pressed }) => [
          styles.opcao,
          { borderColor: marcada ? cor : colors.border, backgroundColor: marcada ? cor : colors.surface },
          pressed && styles.pressionado,
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: marcada }}
        accessibilityLabel={confirmou ? "Confirmo a parte" : "Não posso fazer a parte"}
      >
        <Ionicons name={confirmou ? "checkmark-circle" : "close-circle"} size={18} color={marcada ? colors.textOnPrimary : cor} />
        <Text style={[styles.opcaoTexto, { color: marcada ? colors.textOnPrimary : cor }]}>{confirmou ? "Confirmo" : "Não posso"}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.caixa}>
      <View style={styles.linha}>
        {opcao(true)}
        {opcao(false)}
      </View>
      <Text style={styles.dica}>
        {atual === true
          ? "Você confirmou. Quem cuida das confirmações já vê."
          : atual === false
            ? "Quem cuida das confirmações foi avisado para achar quem faça."
            : "Avise se vai fazer a parte: quem cuida das confirmações vê a sua resposta."}
      </Text>
    </View>
  );
}

/** A etiqueta da parte de estudante nos cartões: falta responder, confirmada ou "não posso". */
export function rotuloResposta(c: Compromisso, colors: Cores): { texto: string; cor: string; fundo: string } | null {
  if (!c.confirmacao) return null;
  if (c.confirmacao.confirmou === true) return { texto: "Confirmada", cor: colors.greenDark, fundo: colors.successBg };
  if (c.confirmacao.confirmou === false) return { texto: "Não posso", cor: colors.red, fundo: colors.dangerBg };
  return { texto: "Confirme", cor: colors.amber, fundo: colors.warningBg };
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    caixa: { gap: 8, marginTop: 12 },
    linha: { flexDirection: "row", gap: 10 },
    opcao: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 11,
      borderRadius: radius.pill,
      borderWidth: 1.5,
    },
    opcaoTexto: { fontSize: 15, fontWeight: "800" },
    pressionado: { opacity: 0.8 },
    dica: { fontSize: 12.5, color: colors.textSecondary, lineHeight: 17 },
  });
