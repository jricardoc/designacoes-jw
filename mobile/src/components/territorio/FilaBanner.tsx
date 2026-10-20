import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { descartar, enviarFila, useFilaTerritorios } from "@/territorios/fila";

/**
 * O que ainda não chegou ao servidor, À VISTA na tela do território — no app antigo isso ficava
 * escondido em "Minha conta", e o dirigente não sabia se a marcação tinha subido.
 *
 * Recusado pelo servidor aparece com o motivo e "Descartar": esse não vai ser reenviado.
 * `numero` filtra para um território; sem ele, mostra a fila inteira.
 */
export function FilaBanner({ numero }: { numero?: string }) {
  const { colors, styles } = useTema(criarEstilos);
  const { pendentes, recusados, enviando } = useFilaTerritorios();
  const meus = (lista: typeof pendentes) => (numero ? lista.filter((i) => i.numero === numero) : lista);
  const aguardando = meus(pendentes);
  const negados = meus(recusados);
  if (aguardando.length === 0 && negados.length === 0) return null;

  return (
    <View style={styles.caixa}>
      {aguardando.length > 0 ? (
        <View style={styles.linha}>
          <Ionicons name="cloud-upload-outline" size={20} color={colors.amber} />
          <Text style={styles.texto}>
            {aguardando.length === 1 ? "1 registro aguardando internet" : `${aguardando.length} registros aguardando internet`}
            {"\n"}
            <Text style={styles.sub}>Será enviado sozinho quando o sinal voltar.</Text>
          </Text>
          <Pressable style={styles.botao} onPress={() => enviarFila()} disabled={enviando} hitSlop={6}>
            {enviando ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.botaoTexto}>Enviar</Text>
            )}
          </Pressable>
        </View>
      ) : null}
      {negados.map((item) => (
        <View key={item.clientKey} style={[styles.linha, styles.recusado]}>
          <Ionicons name="alert-circle" size={20} color={colors.red} />
          <Text style={styles.texto}>
            {item.titulo}
            {"\n"}
            <Text style={styles.sub}>Não foi aceito: {item.erro}</Text>
          </Text>
          <Pressable onPress={() => descartar(item.clientKey)} hitSlop={8}>
            <Text style={styles.descartar}>Descartar</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    caixa: { gap: 8 },
    linha: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.warningBg,
      borderRadius: radius.md,
      padding: 12,
    },
    recusado: { backgroundColor: colors.dangerBg },
    texto: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text, lineHeight: 19 },
    sub: { fontSize: 12.5, fontWeight: "500", color: colors.textSecondary },
    botao: {
      backgroundColor: colors.amber,
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 8,
      minWidth: 72,
      alignItems: "center",
    },
    botaoTexto: { color: colors.textOnPrimary, fontWeight: "800", fontSize: 13 },
    descartar: { color: colors.red, fontWeight: "800", fontSize: 13 },
  });
