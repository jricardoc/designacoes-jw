import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAssistencias } from "@/api/hooks/useReunioes";
import type { AssistenciaReuniao, TipoAssistencia } from "@/api/types";
import { radius, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/**
 * Quantas reuniões recentes entram na média e nas barrinhas. Oito ≈ dois meses
 * de cada tipo: o suficiente para tendência sem diluir com o passado distante.
 */
const JANELA = 8;

/** "dd/MM/yyyy" → Date. Registro com data ilegível vai para o fim da fila. */
function dataDe(registro: AssistenciaReuniao): Date {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(registro.data);
  if (!m) return new Date(0);
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

interface Resumo {
  media: number;
  mediaPresencial: number;
  mediaZoom: number;
  /** Totais em ordem cronológica (para as barrinhas). */
  totais: number[];
  ultimaTotal: number;
  /** "17/08" */
  ultimaData: string;
  quantidade: number;
}

/** Média e últimos totais de um tipo, sobre as JANELA reuniões mais recentes. */
function resumir(registros: AssistenciaReuniao[]): Resumo | null {
  if (registros.length === 0) return null;
  const ordenados = [...registros].sort(
    (a, b) => dataDe(b).getTime() - dataDe(a).getTime(),
  );
  const recentes = ordenados.slice(0, JANELA);
  const soma = (f: (r: AssistenciaReuniao) => number) =>
    recentes.reduce((acc, r) => acc + f(r), 0);
  const media = (f: (r: AssistenciaReuniao) => number) =>
    Math.round(soma(f) / recentes.length);

  return {
    media: media((r) => r.presencial + r.zoom),
    mediaPresencial: media((r) => r.presencial),
    mediaZoom: media((r) => r.zoom),
    totais: [...recentes].reverse().map((r) => r.presencial + r.zoom),
    ultimaTotal: recentes[0].presencial + recentes[0].zoom,
    ultimaData: recentes[0].data.slice(0, 5),
    quantidade: registros.length,
  };
}

function CartaoTipo({
  rotulo,
  cor,
  resumo,
}: {
  rotulo: string;
  cor: string;
  resumo: Resumo | null;
}) {
  const { colors, styles } = useTema(criarEstilos);

  if (!resumo) {
    return (
      <View style={styles.cartao}>
        <View style={styles.cartaoHeader}>
          <View style={[styles.ponto, { backgroundColor: cor }]} />
          <Text style={styles.cartaoRotulo}>{rotulo}</Text>
        </View>
        <Text style={styles.vazioTraco}>—</Text>
        <Text style={styles.vazioTexto}>Sem registros</Text>
      </View>
    );
  }

  const maior = Math.max(...resumo.totais, 1);

  return (
    <View style={styles.cartao}>
      <View style={styles.cartaoHeader}>
        <View style={[styles.ponto, { backgroundColor: cor }]} />
        <Text style={styles.cartaoRotulo}>{rotulo}</Text>
      </View>

      <Text style={styles.media}>{resumo.media}</Text>
      <Text style={styles.mediaLegenda}>média de assistência</Text>

      <View style={styles.quebra}>
        <View style={styles.quebraItem}>
          <Ionicons name="people-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.quebraTexto}>{resumo.mediaPresencial}</Text>
        </View>
        <View style={styles.quebraItem}>
          <Ionicons name="videocam-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.quebraTexto}>{resumo.mediaZoom}</Text>
        </View>
      </View>

      <View style={styles.barras}>
        {resumo.totais.map((total, i) => (
          <View
            // A lista é posicional (últimas N reuniões em ordem): o índice é a identidade.
            key={i}
            style={[
              styles.barra,
              {
                backgroundColor: cor,
                height: 6 + Math.round((total / maior) * 26),
              },
            ]}
          />
        ))}
      </View>

      <Text style={styles.ultima}>
        Última: {resumo.ultimaTotal} · {resumo.ultimaData}
      </Text>
    </View>
  );
}

/**
 * O resumo da assistência que ocupa o espaço liberado quando os meses antigos
 * saíram da tela de Reunião: média, divisão presencial/Zoom e as barrinhas das
 * últimas reuniões, separados por meio e fim de semana.
 *
 * O cálculo é do app, em cima de GET /reunioes/assistencias — são duas linhas
 * por semana, não vale endpoint de agregação.
 */
export function AssistenciaStats({ podeRegistrar }: { podeRegistrar: boolean }) {
  const { colors, styles } = useTema(criarEstilos);
  const { data: assistencias, isLoading } = useAssistencias();

  const { meio, fds } = useMemo(() => {
    const porTipo = (tipo: TipoAssistencia) =>
      resumir((assistencias ?? []).filter((a) => a.tipo === tipo));
    return { meio: porTipo("meio"), fds: porTipo("fds") };
  }, [assistencias]);

  // Enquanto carrega não reserva espaço; estatística é bônus, não esqueleto.
  if (isLoading || !assistencias) return null;

  if (assistencias.length === 0) {
    // Só quem pode registrar vê a dica — para os demais seria um convite a um
    // botão que não existe na tela deles.
    if (!podeRegistrar) return null;
    return (
      <View style={styles.grupo}>
        <Text style={styles.titulo}>Assistência</Text>
        <View style={styles.dica}>
          <Ionicons name="stats-chart-outline" size={18} color={colors.textMuted} />
          <Text style={styles.dicaTexto}>
            {'Nenhuma assistência registrada ainda. Toque em "Assistência" numa semana para anotar a primeira contagem — as estatísticas aparecem aqui.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.grupo}>
      <Text style={styles.titulo}>Assistência</Text>
      <Text style={styles.legenda}>
        Média das últimas {JANELA} reuniões registradas
      </Text>
      <View style={styles.linhaCartoes}>
        <CartaoTipo rotulo="Meio de semana" cor={colors.purple} resumo={meio} />
        <CartaoTipo rotulo="Fim de semana" cor={colors.amber} resumo={fds} />
      </View>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    grupo: { gap: 8 },
    titulo: { fontSize: 18, fontWeight: "800", color: colors.text },
    legenda: { fontSize: 12.5, color: colors.textSecondary, marginTop: -4 },
    linhaCartoes: { flexDirection: "row", gap: spacing.md, marginTop: 4 },
    cartao: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 14,
      gap: 2,
    },
    cartaoHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 6,
    },
    ponto: { width: 8, height: 8, borderRadius: 4 },
    cartaoRotulo: {
      flex: 1,
      fontSize: 11.5,
      fontWeight: "800",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    media: { fontSize: 30, fontWeight: "800", color: colors.text, lineHeight: 34 },
    mediaLegenda: { fontSize: 11.5, color: colors.textMuted },
    vazioTraco: {
      fontSize: 30,
      fontWeight: "800",
      color: colors.textMuted,
      lineHeight: 34,
    },
    vazioTexto: { fontSize: 11.5, color: colors.textMuted },
    quebra: { flexDirection: "row", gap: 12, marginTop: 8 },
    quebraItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    quebraTexto: { fontSize: 12.5, fontWeight: "700", color: colors.textSecondary },
    barras: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 3,
      height: 32,
      marginTop: 10,
    },
    barra: { flex: 1, maxWidth: 18, borderRadius: 3 },
    ultima: { fontSize: 11.5, color: colors.textMuted, marginTop: 8 },
    dica: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 14,
    },
    dicaTexto: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  });
