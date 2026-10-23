import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DIAS_CURTOS, radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/*
 * Escolhas de dia, hora e número feitas com toques, sem o seletor nativo de data (que exigiria
 * um build novo do app). Datas sempre no fuso do aparelho, que é o da congregação.
 */

export const doisDig = (n: number) => String(n).padStart(2, "0");

/** Date -> "2026-10-23" (no fuso do aparelho). */
export const isoDoDia = (d: Date) => `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}`;

/** 90 -> "1 h 30", 60 -> "1 h", 25 -> "25 min" */
export function duracao(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${doisDig(m)}` : `${h} h`;
}

/** "2026-10-23" -> "Qui, 23/10" */
export function diaCurto(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${DIAS_CURTOS[new Date(a, m - 1, d).getDay()]}, ${doisDig(d)}/${doisDig(m)}`;
}

/** Data e hora (ISO) -> "Sáb, 25/10 às 15:00" */
export function quando(isoDataHora: string) {
  const d = new Date(isoDataHora);
  return `${diaCurto(isoDoDia(d))} às ${doisDig(d.getHours())}:${doisDig(d.getMinutes())}`;
}

/** Dia ("2026-10-25") e hora ("15:30") no fuso do aparelho -> ISO. */
export const dataHoraISO = (dia: string, hora: string) => {
  const [a, m, d] = dia.split("-").map(Number);
  const [h, min] = hora.split(":").map(Number);
  return new Date(a, m - 1, d, h, min).toISOString();
};

/** Os dias da fileira: hoje e os de trás (horas lançadas) ou os da frente (visita marcada). */
function diasDaFileira(sentido: "passado" | "futuro", quantos: number) {
  const hoje = new Date();
  return Array.from({ length: quantos }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + (sentido === "futuro" ? i : -i));
    const rotulo = i === 0 ? "Hoje" : i === 1 ? (sentido === "futuro" ? "Amanhã" : "Ontem") : `${DIAS_CURTOS[d.getDay()]} ${doisDig(d.getDate())}`;
    return { iso: isoDoDia(d), rotulo };
  });
}

export function SeletorDia({
  valor,
  onMudar,
  sentido,
  quantos = 21,
}: {
  valor: string;
  onMudar: (iso: string) => void;
  sentido: "passado" | "futuro";
  quantos?: number;
}) {
  const { styles } = useTema(criarEstilos);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fileira} keyboardShouldPersistTaps="handled">
      {diasDaFileira(sentido, quantos).map((d) => {
        const ativo = d.iso === valor;
        return (
          <Pressable
            key={d.iso}
            style={[styles.chip, ativo && styles.chipAtivo]}
            onPress={() => onMudar(d.iso)}
            accessibilityRole="radio"
            accessibilityState={{ selected: ativo }}
            accessibilityLabel={diaCurto(d.iso)}
          >
            <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{d.rotulo}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const HORAS = Array.from({ length: 31 }, (_, i) => `${doisDig(6 + Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);

export function SeletorHora({ valor, onMudar }: { valor: string; onMudar: (hora: string) => void }) {
  const { styles } = useTema(criarEstilos);
  const rolagem = useRef<ScrollView>(null);
  // Abre já perto da hora escolhida (cada chip tem uns 72 pt).
  useEffect(() => {
    const i = HORAS.indexOf(valor);
    if (i > 2) setTimeout(() => rolagem.current?.scrollTo({ x: (i - 2) * 72, animated: false }), 50);
    // Só na abertura: rolar a cada toque tiraria o chip do lugar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <ScrollView ref={rolagem} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fileira} keyboardShouldPersistTaps="handled">
      {HORAS.map((h) => {
        const ativo = h === valor;
        return (
          <Pressable key={h} style={[styles.chip, ativo && styles.chipAtivo]} onPress={() => onMudar(h)} accessibilityRole="radio" accessibilityState={{ selected: ativo }}>
            <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{h}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** "−  3  +" */
export function Contador({
  valor,
  onMudar,
  min = 0,
  max = 99,
  passo = 1,
  rotulo,
}: {
  valor: number;
  onMudar: (n: number) => void;
  min?: number;
  max?: number;
  passo?: number;
  rotulo: string;
}) {
  const { colors, styles } = useTema(criarEstilos);
  return (
    <View style={styles.contador}>
      <Pressable
        style={[styles.passo, valor <= min && { opacity: 0.35 }]}
        onPress={() => onMudar(Math.max(min, valor - passo))}
        disabled={valor <= min}
        hitSlop={6}
        accessibilityLabel={`Menos (${rotulo})`}
      >
        <Ionicons name="remove" size={18} color={colors.primaryDark} />
      </Pressable>
      <Text style={styles.valor} accessibilityLabel={`${rotulo}: ${valor}`}>
        {valor}
      </Text>
      <Pressable
        style={[styles.passo, valor >= max && { opacity: 0.35 }]}
        onPress={() => onMudar(Math.min(max, valor + passo))}
        disabled={valor >= max}
        hitSlop={6}
        accessibilityLabel={`Mais (${rotulo})`}
      >
        <Ionicons name="add" size={18} color={colors.primaryDark} />
      </Pressable>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    fileira: { gap: 8, paddingVertical: 2 },
    chip: {
      minWidth: 64,
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipTexto: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
    chipTextoAtivo: { color: colors.textOnPrimary },
    contador: { flexDirection: "row", alignItems: "center", gap: 10 },
    passo: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    valor: { minWidth: 34, textAlign: "center", fontSize: 20, fontWeight: "900", color: colors.text },
  });
