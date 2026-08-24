import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

interface MarcadorCumprimentoProps {
  /** null/undefined = não avaliado, true = cumpriu, false = faltou. */
  valor: boolean | null | undefined;
  /**
   * Presente = modo edição (os dois botões). Ausente = só exibe o estado (um
   * ícone quando avaliado, nada quando não) — é o que o irmão comum vê.
   * Tocar no estado já marcado desmarca (volta a null).
   */
  onChange?: (novo: boolean | null) => void;
}

/**
 * O V/X de cumprimento ao lado do nome, compartilhado pelas telas de
 * Designações (quadro) e Dirigentes (escala). Verde+✓ e vermelho+✗: a forma
 * diferencia mesmo quando a cor não diferencia (modo daltônico).
 */
export function MarcadorCumprimento({ valor, onChange }: MarcadorCumprimentoProps) {
  const { colors, styles } = useTema(criarEstilos);

  if (!onChange) {
    if (valor === null || valor === undefined) return null;
    return (
      <Ionicons
        name={valor ? "checkmark-circle" : "close-circle"}
        size={16}
        color={valor ? colors.green : colors.red}
      />
    );
  }

  return (
    <View style={styles.row}>
      <Pressable
        // Assimétrico: os slops dos dois botões não podem se sobrepor no gap,
        // senão o toque na borda do ✓ registra ✗ (o irmão seguinte vence o
        // hit-test) — o oposto do que o dedo quis marcar.
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 1 }}
        accessibilityRole="button"
        accessibilityLabel="Cumpriu"
        accessibilityState={{ selected: valor === true }}
        onPress={() => onChange(valor === true ? null : true)}
        style={[styles.btn, valor === true && styles.btnSim]}
      >
        <Ionicons
          name="checkmark"
          size={13}
          color={valor === true ? colors.textOnPrimary : colors.textMuted}
        />
      </Pressable>
      <Pressable
        hitSlop={{ top: 6, bottom: 6, left: 1, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel="Não cumpriu"
        accessibilityState={{ selected: valor === false }}
        onPress={() => onChange(valor === false ? null : false)}
        style={[styles.btn, valor === false && styles.btnNao]}
      >
        <Ionicons
          name="close"
          size={13}
          color={valor === false ? colors.textOnPrimary : colors.textMuted}
        />
      </Pressable>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    row: { flexDirection: "row", gap: 4 },
    btn: {
      width: 22,
      height: 22,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    btnSim: { backgroundColor: colors.green, borderColor: colors.green },
    btnNao: { backgroundColor: colors.red, borderColor: colors.red },
  });
