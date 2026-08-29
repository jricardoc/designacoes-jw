import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useConcluirTarefa } from "@/api/hooks/useTarefas";
import type { Tarefa } from "@/api/types";
import { useToast } from "@/components/ui";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/**
 * O To-Do da tela de início: o que o irmão tem de fazer para o sistema andar.
 *
 * Diferente de "Suas designações", que diz onde ele PARTICIPA, esta lista diz o que ele
 * ENTREGA — mandar o link do Zoom, montar o quadro, fazer as confirmações. Por isso ela vem
 * antes: é a única parte da tela que cobra alguma coisa de quem está olhando.
 *
 * O prazo e o texto dele são calculados no backend (ver RegrasTarefas), nunca aqui. As mesmas
 * datas governam o push, e duas contas separadas acabariam discordando sobre a mesma tarefa.
 */

/** Para onde cada tarefa leva. As chaves são o `acao.destino` que o backend manda. */
const DESTINOS: Record<string, string> = {
  reuniao: "/(tabs)/reuniao",
  dirigentes: "/(tabs)/dirigentes",
  designacoes: "/(tabs)",
  confirmacoes: "/(tabs)/confirmacoes",
};

interface Props {
  tarefas: Tarefa[];
  /** Nome do grupo de campo do irmão, quando há — explica de onde a limpeza saiu. */
  grupo?: string | null;
}

export function ListaTarefas({ tarefas, grupo }: Props) {
  const { colors, styles } = useTema(criarEstilos);
  const concluir = useConcluirTarefa();
  const toast = useToast();
  /**
   * Qual card está sendo marcado agora. Guarda o id, e não um booleano: com dois toques
   * rápidos em cards diferentes, um booleano deixaria os dois girando.
   */
  const [marcando, setMarcando] = useState<string | null>(null);

  /** Vermelho quando atrasada, âmbar quando é para já, oliva no resto. */
  const cores = (t: Tarefa) => {
    if (t.atrasada) return { cor: colors.red, fundo: colors.dangerBg };
    if ((t.diasAteVencer ?? 99) <= 1) return { cor: colors.amber, fundo: colors.warningBg };
    return { cor: colors.oliveSoft, fundo: colors.infoBg };
  };

  const marcar = (t: Tarefa) => {
    setMarcando(t.id);
    concluir.mutate(
      { tipo: t.tipo, ocorrencia: t.ocorrencia },
      {
        onSuccess: () => toast.show("Tarefa concluída!"),
        // Sem este aviso a falha seria muda: o card continuaria na lista e o irmão
        // tocaria de novo achando que o toque não pegou.
        onError: (erro) =>
          toast.show(erro instanceof Error ? erro.message : "Não deu para concluir", "error"),
        onSettled: () => setMarcando(null),
      },
    );
  };

  const abrir = (t: Tarefa) => {
    const destino = t.acao ? DESTINOS[t.acao.destino] : null;
    if (destino) router.push(destino as never);
  };

  if (tarefas.length === 0) {
    return (
      <Animated.View entering={FadeInDown.duration(240)}>
        <Text style={styles.secaoLabel}>Tarefas</Text>
        <View style={styles.vazio}>
          <View style={[styles.vazioIcone, { backgroundColor: colors.successBg }]}>
            <Ionicons name="checkmark-done" size={18} color={colors.greenDark} />
          </View>
          <Text style={styles.vazioTexto}>
            Nada pendente por aqui. Quando chegar a vez de uma tarefa sua, ela aparece nesta
            lista.
          </Text>
        </View>
      </Animated.View>
    );
  }

  const atrasadas = tarefas.filter((t) => t.atrasada).length;

  return (
    <Animated.View entering={FadeInDown.duration(240)}>
      <View style={styles.cabecalho}>
        <Text style={styles.secaoLabel}>Tarefas</Text>
        {atrasadas > 0 ? (
          <View style={[styles.selo, { backgroundColor: colors.dangerBg }]}>
            <Text style={[styles.seloTexto, { color: colors.redDark }]}>
              {atrasadas === 1 ? "1 atrasada" : `${atrasadas} atrasadas`}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.lista}>
        {tarefas.map((t) => {
          const { cor, fundo } = cores(t);
          const ocupado = marcando === t.id;

          return (
            <View key={t.id} style={[styles.card, { borderLeftColor: cor }]}>
              {/* O check fica à ESQUERDA e é o maior alvo de toque do card: é a ação
                  que o irmão vem fazer. Tarefa de quadro não tem check — ela se
                  resolve publicando o quadro (ver RegrasTarefas.TIPOS[].conclusao). */}
              {t.concluivel ? (
                <Pressable
                  onPress={() => marcar(t)}
                  disabled={ocupado}
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: false, disabled: ocupado }}
                  accessibilityLabel={`Marcar "${t.titulo}" como concluída`}
                  style={({ pressed }) => [
                    styles.caixa,
                    { borderColor: cor },
                    pressed && styles.caixaPressionada,
                  ]}
                >
                  {ocupado ? <ActivityIndicator size="small" color={cor} /> : null}
                </Pressable>
              ) : (
                <View style={[styles.iconeBox, { backgroundColor: fundo }]}>
                  <Ionicons
                    name={t.icone as keyof typeof Ionicons.glyphMap}
                    size={16}
                    color={cor}
                  />
                </View>
              )}

              <Pressable
                style={styles.corpo}
                onPress={() => abrir(t)}
                disabled={!t.acao}
                accessibilityRole={t.acao ? "button" : "text"}
                accessibilityLabel={
                  t.acao ? `${t.titulo}. ${t.prazo}. ${t.acao.titulo}` : `${t.titulo}. ${t.prazo}`
                }
              >
                <View style={styles.linhaTopo}>
                  <Text style={[styles.prazo, { color: cor }]}>{t.prazo}</Text>
                  <Text style={styles.cadencia}>{t.cadenciaLabel}</Text>
                </View>

                <Text style={styles.titulo} numberOfLines={2}>
                  {t.titulo}
                </Text>

                {t.detalhe ? (
                  <Text style={styles.detalhe} numberOfLines={2}>
                    {t.detalhe}
                  </Text>
                ) : null}

                {/* A limpeza não foi designada a ninguém: ela chegou pelo grupo de campo.
                    Sem esta linha o irmão não entende por que ela apareceu para ele. */}
                {t.tipo === "limpeza" ? (
                  <Text style={styles.origem}>
                    {grupo ? `Você está no grupo ${grupo}` : "Do seu grupo de campo"}
                  </Text>
                ) : null}

                {t.conclusao === "quadro" ? (
                  <Text style={styles.origem}>
                    Sai daqui sozinha quando o quadro for publicado
                  </Text>
                ) : null}
              </Pressable>

              {t.acao ? (
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              ) : null}
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    secaoLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: colors.textMuted,
      marginBottom: 10,
      marginTop: 6,
    },
    cabecalho: { flexDirection: "row", alignItems: "center", gap: 8 },
    selo: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
    seloTexto: { fontSize: 11, fontWeight: "700" },

    lista: { gap: 8, marginBottom: 10 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderLeftWidth: 4,
      paddingVertical: 12,
      paddingLeft: 12,
      paddingRight: 14,
      ...shadow.card,
    },
    caixa: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    caixaPressionada: { opacity: 0.55 },
    iconeBox: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },

    corpo: { flex: 1, gap: 2 },
    linhaTopo: { flexDirection: "row", alignItems: "center", gap: 8 },
    prazo: { fontSize: 11.5, fontWeight: "700", letterSpacing: 0.2 },
    cadencia: { fontSize: 11, color: colors.textMuted },
    titulo: { fontSize: 14.5, fontWeight: "600", color: colors.text, lineHeight: 19 },
    detalhe: { fontSize: 12.5, color: colors.textSecondary, lineHeight: 17 },
    origem: { fontSize: 11.5, color: colors.textMuted, fontStyle: "italic", marginTop: 2 },

    vazio: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
    },
    vazioIcone: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    vazioTexto: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  });
