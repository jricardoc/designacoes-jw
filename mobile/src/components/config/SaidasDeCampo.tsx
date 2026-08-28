import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSaidasCampo } from "@/api/hooks/useDirigentes";
import type { SaidaCampo } from "@/api/types";
import { SaidaCampoModal } from "@/components/config/SaidaCampoModal";
import { useAuth } from "@/context/AuthContext";
import { podeGerenciar } from "@/utils/permissoes";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/**
 * Os locais e horários das saídas de campo.
 *
 * Morava na aba "Sistema" da tela de cadastro, que sumiu — cadastro é de pessoas, e saída de
 * campo é lugar. Aqui, junto do Território, fica ao lado do que se parece com ela.
 *
 * Some inteiro para quem não cuida de dirigentes: é o escopo que o backend exige em
 * `/saidas-campo`, e mostrar a lista sem poder mexer só confunde.
 */

const DIA_ABBR: Record<string, string> = {
  domingo: "DOM",
  segunda: "SEG",
  terca: "TER",
  quarta: "QUA",
  quinta: "QUI",
  sexta: "SEX",
  sabado: "SÁB",
};

/**
 * "Grupo 1 — Casa da irmã Ana" vira as duas metades. O campo é texto livre e quem cadastra
 * escreve os dois juntos; separado, o grupo fica em destaque e a casa vira apoio.
 */
function partirLocal(local: string, turno?: number | null) {
  const [antes, ...resto] = String(local || "").split(/\s+[—–-]\s+/);
  const grupo = antes?.trim() || (turno ? `Turno ${turno}` : "Saída");
  return { grupo, casa: resto.join(" — ").trim() };
}

export function SaidasDeCampo() {
  const { colors, styles } = useTema(criarEstilos);
  const { usuario } = useAuth();
  const { data: saidas } = useSaidasCampo();
  const [modal, setModal] = useState<{ open: boolean; saida: SaidaCampo | null }>({
    open: false,
    saida: null,
  });

  if (!podeGerenciar(usuario, "dirigentes")) return null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.titulo}>
          <Ionicons name="send-outline" size={17} color={colors.oliveSoft} />
          <Text style={styles.tituloTexto}>Saída de Campo</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
          onPress={() => setModal({ open: true, saida: null })}
          accessibilityRole="button"
          accessibilityLabel="Nova saída de campo"
        >
          <Ionicons name="add" size={14} color={colors.textOnPrimary} />
          <Text style={styles.botaoTexto}>Nova</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>{saidas?.length ?? 0} saída(s) cadastrada(s)</Text>

      <View style={styles.lista}>
        {(saidas ?? []).map((o) => {
          const { grupo, casa } = partirLocal(o.local, o.turno);
          return (
            <Pressable
              key={o.id}
              style={({ pressed }) => [styles.linha, pressed && styles.pressionado]}
              onPress={() => setModal({ open: true, saida: o })}
            >
              <View style={styles.quando}>
                <Text style={styles.diaSemana}>{DIA_ABBR[o.diaSemana] ?? o.diaSemana}</Text>
                <Text style={styles.horario}>{o.horario}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.grupo} numberOfLines={1}>
                  {grupo}
                </Text>
                {casa ? (
                  <Text style={styles.casa} numberOfLines={1}>
                    {casa}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="create-outline" size={17} color={colors.textMuted} />
            </Pressable>
          );
        })}

        {(saidas?.length ?? 0) === 0 ? (
          <Text style={styles.vazio}>Nenhuma saída cadastrada.</Text>
        ) : null}
      </View>

      <SaidaCampoModal
        visible={modal.open}
        saida={modal.saida}
        onClose={() => setModal({ open: false, saida: null })}
      />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 14,
      ...shadow.card,
    },
    head: { flexDirection: "row", alignItems: "center", gap: 10 },
    titulo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
    tituloTexto: { fontSize: 15, fontWeight: "800", color: colors.text },
    sub: { fontSize: 12.5, color: colors.textMuted, marginTop: 3 },
    botao: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    botaoTexto: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 12.5 },
    pressionado: { opacity: 0.6 },
    lista: { marginTop: 8 },
    linha: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingVertical: 9,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    quando: { width: 54 },
    diaSemana: { fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.5 },
    horario: { fontSize: 13.5, fontWeight: "700", color: colors.text, marginTop: 1 },
    grupo: { fontSize: 14, fontWeight: "600", color: colors.text },
    casa: { fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
    vazio: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 16 },
  });
