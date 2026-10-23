import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePainelPioneiro } from "@/api/hooks/usePioneiro";
import { irParaAmbiente } from "@/components/layout/Ambientes";
import { useAuth } from "@/context/AuthContext";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { podeUsarPioneiro } from "@/utils/permissoes";
import { relogio, useControleCronometro } from "./cronometro";
import { mesAtual, type Icone } from "./kit";

/**
 * O cronômetro do Ministério no Início do Servir Mais: quem começou a contar lá e trocou de
 * ambiente continua vendo o tempo andar, e pausa ou para daqui. Some quando não há nada contando.
 */
export function CartaoCronometro() {
  const { colors, styles } = useTema(criarEstilos);
  const { usuario } = useAuth();
  const pode = podeUsarPioneiro(usuario);
  const { data: p } = usePainelPioneiro(mesAtual(), pode);
  const cron = useControleCronometro(p?.cronometro);
  if (!pode || !cron.emAndamento) return null;

  const estado = cron.rodando ? "contando" : "pausado";
  const botao = (icone: Icone, rotulo: string, onPress: () => void) => (
    <Pressable onPress={onPress} disabled={cron.pendente} style={({ pressed }) => [styles.botao, pressed && styles.pressionado]} hitSlop={6} accessibilityRole="button" accessibilityLabel={rotulo}>
      <Ionicons name={icone} size={20} color={colors.primaryDark} />
    </Pressable>
  );

  return (
    <Pressable
      onPress={() => irParaAmbiente("ministerio")}
      style={({ pressed }) => [styles.cartao, pressed && styles.pressionado]}
      accessibilityRole="button"
      accessibilityLabel={`Cronômetro do ministério, ${estado}. Abre o Ministério`}
    >
      <View style={styles.icone}>
        <Ionicons name="timer-outline" size={22} color={colors.primaryDark} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.rotulo}>Ministério · {estado}</Text>
        <Text style={styles.relogio}>{relogio(cron.segundos)}</Text>
      </View>
      {cron.rodando ? botao("pause", "Pausar", () => cron.acao("pausar")) : botao("play", "Continuar", () => cron.acao("iniciar"))}
      {botao("stop", "Parar", cron.parar)}
    </Pressable>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    cartao: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      marginBottom: 18,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      ...shadow.card,
    },
    pressionado: { opacity: 0.8 },
    icone: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.sand },
    flex: { flex: 1 },
    rotulo: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", color: colors.textMuted },
    relogio: { fontSize: 24, fontWeight: "900", color: colors.text, fontVariant: ["tabular-nums"], letterSpacing: -0.5 },
    botao: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.sand,
    },
  });
