import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { SemanaReuniao } from "@/api/types";
import { colors, radius } from "@/theme";

function Linha({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.linha}>
      <Text style={styles.linhaLabel}>{label}</Text>
      <Text style={styles.linhaValue}>{value}</Text>
    </View>
  );
}

function Secao({
  titulo,
  cor,
  children,
}: {
  titulo: string;
  cor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.secao}>
      <View style={[styles.secaoBar, { backgroundColor: cor }]} />
      <View style={styles.secaoBody}>
        <Text style={[styles.secaoTitulo, { color: cor }]}>{titulo}</Text>
        {children}
      </View>
    </View>
  );
}

function par(titulo?: string | null, irmao?: string | null) {
  if (!titulo && !irmao) return null;
  return [titulo, irmao].filter(Boolean).join(" — ");
}

export function SemanaCard({ semana, index = 0 }: { semana: SemanaReuniao; index?: number }) {
  const [open, setOpen] = useState(false);

  return (
    <Animated.View entering={FadeInDown.delay(index * 55).duration(300)} style={styles.card}>
      <Pressable style={styles.header} onPress={() => setOpen((o) => !o)}>
        <View style={styles.flex}>
          <Text style={styles.faixa}>{semana.faixaData}</Text>
          {semana.leituraSemanal ? (
            <Text style={styles.leitura}>📖 {semana.leituraSemanal}</Text>
          ) : null}
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.textSecondary}
        />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <Secao titulo="Presidência" cor={colors.primary}>
            <Linha label="Presidente" value={semana.presidente} />
            <Linha label="Oração Inicial" value={semana.oracaoInicial} />
            <Linha label="Cântico Inicial" value={semana.canticoInicial} />
          </Secao>

          {par(semana.tesouro1_titulo, semana.tesouro1_irmao) ||
          par(semana.tesouro2_titulo, semana.tesouro2_irmao) ||
          par(semana.tesouro3_titulo, semana.tesouro3_principal) ? (
            <Secao titulo="💎 Tesouros da Palavra de Deus" cor="#0ea5e9">
              <Linha label="1." value={par(semana.tesouro1_titulo, semana.tesouro1_irmao)} />
              <Linha label="2." value={par(semana.tesouro2_titulo, semana.tesouro2_irmao)} />
              <Linha label="3." value={par(semana.tesouro3_titulo, semana.tesouro3_principal)} />
            </Secao>
          ) : null}

          {par(semana.vidaCrista1_titulo, semana.vidaCrista1_irmao) ||
          par(semana.vidaCrista2_titulo, semana.vidaCrista2_irmao) ? (
            <Secao titulo="🌾 Nossa Vida Cristã" cor={colors.redDark}>
              <Linha label="1." value={par(semana.vidaCrista1_titulo, semana.vidaCrista1_irmao)} />
              <Linha label="2." value={par(semana.vidaCrista2_titulo, semana.vidaCrista2_irmao)} />
            </Secao>
          ) : null}

          {semana.estudoBiblico_dirigente || semana.estudoBiblico_leitor ? (
            <Secao titulo="Estudo Bíblico de Congregação" cor={colors.redDark}>
              <Linha label="Dirigente" value={semana.estudoBiblico_dirigente} />
              <Linha label="Leitor" value={semana.estudoBiblico_leitor} />
              <Linha label="Cântico Final" value={semana.canticoFinal} />
              <Linha label="Oração Final" value={semana.oracaoFinal} />
            </Secao>
          ) : null}

          {semana.mecanica_audioVideo ||
          semana.mecanica_indicadores ||
          semana.mecanica_microfone ? (
            <Secao titulo="🔧 Designações Mecânicas" cor={colors.purple}>
              <Linha label="Áudio e Vídeo" value={semana.mecanica_audioVideo} />
              <Linha label="Indicadores" value={semana.mecanica_indicadores} />
              <Linha label="Microfones" value={semana.mecanica_microfone} />
            </Secao>
          ) : null}

          {semana.fds_tema || semana.fds_orador || semana.fds_presidente ? (
            <Secao titulo="📅 Fim de Semana" cor={colors.amber}>
              <Linha label="Presidente" value={semana.fds_presidente} />
              <Linha label="Tema" value={semana.fds_tema} />
              <Linha label="Orador" value={semana.fds_orador} />
            </Secao>
          ) : null}

          {semana.limpeza ? (
            <Secao titulo="🧹 Limpeza" cor={colors.green}>
              <Linha label="Responsável" value={semana.limpeza} />
            </Secao>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 8,
  },
  flex: { flex: 1 },
  faixa: { fontSize: 15, fontWeight: "700", color: colors.text },
  leitura: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  body: {
    padding: 14,
    paddingTop: 0,
    gap: 10,
  },
  secao: { flexDirection: "row", gap: 10 },
  secaoBar: { width: 4, borderRadius: 2 },
  secaoBody: { flex: 1, paddingVertical: 4 },
  secaoTitulo: { fontSize: 13, fontWeight: "800", marginBottom: 4 },
  linha: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  linhaLabel: { fontSize: 13, color: colors.textMuted, minWidth: 90, fontWeight: "600" },
  linhaValue: { fontSize: 13, color: colors.text, flex: 1 },
});
