import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import type { GeneroPessoa, PrivilegioId, TipoPioneiro } from "@/api/types";
import { useTema } from "@/theme/TemaContext";
import { privilegioInfo, rotuloPioneiro } from "@/utils/funcoes";

interface Props {
  privilegio?: PrivilegioId | null;
  /** "sm" para listas, "md" para o cabeçalho do perfil. */
  size?: "sm" | "md";
  /** Usa o rótulo curto ("Servo Min.") quando o espaço é apertado. */
  abreviado?: boolean;
}

/**
 * Mostra o privilégio de serviço ao lado do nome, como um cargo.
 * Não renderiza nada quando não há privilégio, para poder ir direto no JSX.
 */
export function PrivilegioBadge({ privilegio, size = "md", abreviado = false }: Props) {
  const info = privilegioInfo(privilegio);
  if (!info) return null;

  const pequeno = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        pequeno ? styles.badgeSm : styles.badgeMd,
        { backgroundColor: info.bg, borderColor: `${info.color}33` },
      ]}
    >
      <Text
        style={[styles.texto, pequeno ? styles.textoSm : styles.textoMd, { color: info.color }]}
        numberOfLines={1}
      >
        {abreviado ? info.abreviacao : info.label}
      </Text>
    </View>
  );
}

/** O pioneiro do cadastro, no mesmo formato: verde, com a folha. Sem pioneiro, nada. */
export function PioneiroBadge({
  pioneiro,
  genero,
  size = "md",
}: {
  pioneiro?: TipoPioneiro | null;
  genero?: GeneroPessoa | null;
  size?: "sm" | "md";
}) {
  const { colors } = useTema();
  if (!pioneiro) return null;

  const pequeno = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        styles.comIcone,
        pequeno ? styles.badgeSm : styles.badgeMd,
        { backgroundColor: colors.successBg, borderColor: `${colors.greenDark}33` },
      ]}
    >
      <Ionicons name="leaf" size={pequeno ? 10 : 11} color={colors.greenDark} />
      <Text style={[styles.texto, pequeno ? styles.textoSm : styles.textoMd, { color: colors.greenDark }]} numberOfLines={1}>
        {rotuloPioneiro(pioneiro, genero)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  comIcone: { flexDirection: "row", alignItems: "center", gap: 3 },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 1,
  },
  badgeMd: { paddingHorizontal: 10, paddingVertical: 4 },
  badgeSm: { paddingHorizontal: 8, paddingVertical: 3 },
  texto: { fontWeight: "700", letterSpacing: 0.2 },
  textoMd: { fontSize: 11 },
  textoSm: { fontSize: 10 },
});
