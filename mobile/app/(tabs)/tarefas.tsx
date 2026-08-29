import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useDefinirTarefas, useLembrarTarefa, usePainelTarefas } from "@/api/hooks/useTarefas";
import type { MembroDaEquipe, PendenciaTarefa, SituacaoTarefa } from "@/api/types";
import { TarefasSheet } from "@/components/conta/TarefasSheet";
import { useBarraFlutuante } from "@/components/layout/contextoRolagem";
import { BarraDeTaxa } from "@/components/tarefas/BarraDeTaxa";
import { EmptyState, GradientHeader, Loading, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { ehAdminGeral } from "@/utils/permissoes";

/**
 * O painel de tarefas do admin geral.
 *
 * A tela de início responde "o que EU tenho de fazer". Esta responde "as tarefas estão sendo
 * feitas?" — quem está com o quê, o que atrasou, e como a congregação vem se saindo. E, já que
 * é daqui que se vê a lacuna, é daqui também que se designa.
 *
 * SÓ ADMIN GERAL. O backend recusa a rota, e a tela não a pede sequer: quem chegar por um link
 * antigo vê a explicação em vez de um erro.
 */

const JANELAS = [
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
  { dias: 180, rotulo: "6 meses" },
];

export default function PainelTarefasScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const { rolagem, recuo } = useBarraFlutuante();
  const { usuario } = useAuth();
  const toast = useToast();

  const admin = ehAdminGeral(usuario);
  const [janela, setJanela] = useState(90);
  const [designando, setDesignando] = useState<MembroDaEquipe | null>(null);

  const { data, isLoading, refetch, isRefetching } = usePainelTarefas(janela, admin);
  const lembrar = useLembrarTarefa();
  const salvarTarefas = useDefinirTarefas();
  /** Qual pendência está com o lembrete em voo. Por id, para dois toques não girarem juntos. */
  const [enviando, setEnviando] = useState<string | null>(null);

  if (!admin) {
    return (
      <View style={styles.tela}>
        <GradientHeader title="Tarefas" description="Acompanhamento" icon="clipboard" />
        <EmptyState
          icon="lock-closed"
          title="Só para o admin geral"
          message="Este painel mostra as tarefas de toda a congregação, e por isso é restrito."
        />
      </View>
    );
  }

  const corDa = (situacao: SituacaoTarefa) => {
    if (situacao === "atrasada") return { cor: colors.red, fundo: colors.dangerBg };
    if (situacao === "alerta") return { cor: colors.amber, fundo: colors.warningBg };
    return { cor: colors.oliveSoft, fundo: colors.infoBg };
  };

  const cobrar = (p: PendenciaTarefa) => {
    const id = `${p.usuarioId}|${p.tipo}|${p.ocorrencia}`;
    setEnviando(id);
    lembrar.mutate(
      { usuarioId: p.usuarioId, tipo: p.tipo, ocorrencia: p.ocorrencia },
      {
        onSuccess: (r) => toast.show(r.mensagem),
        onError: (erro) =>
          toast.show(erro instanceof Error ? erro.message : "Não deu para lembrar", "error"),
        onSettled: () => setEnviando(null),
      },
    );
  };

  const salvar = async (tarefas: Parameters<typeof salvarTarefas.mutateAsync>[0]["tarefas"]) => {
    if (!designando) return;
    try {
      await salvarTarefas.mutateAsync({ id: designando.id, tarefas });
      toast.show("Tarefas atualizadas!");
      setDesignando(null);
      refetch();
    } catch (erro) {
      toast.show(erro instanceof Error ? erro.message : "Erro ao salvar", "error");
    }
  };

  return (
    <View style={styles.tela}>
      <GradientHeader title="Tarefas" description="Como a congregação está indo" icon="clipboard" />

      {isLoading ? (
        <Loading label="Montando o painel..." />
      ) : !data ? (
        <EmptyState icon="cloud-offline" title="Não deu para carregar" message="Puxe para tentar de novo." />
      ) : (
        <ScrollView
          {...rolagem}
          contentContainerStyle={[styles.scroll, recuo]}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {/* ---------- o retrato de agora ---------- */}
          <Animated.View entering={FadeInDown.duration(240)} style={styles.tiles}>
            <Tile numero={data.resumo.atrasadas} rotulo="atrasadas" cor={colors.red} fundo={colors.dangerBg} icone="alert-circle" />
            <Tile numero={data.resumo.alerta} rotulo="para agora" cor={colors.amber} fundo={colors.warningBg} icone="hourglass" />
            <Tile numero={data.resumo.pendentes} rotulo="pendentes" cor={colors.primaryDark} fundo={colors.infoBg} icone="list" />
          </Animated.View>

          {/* ---------- tarefa que ninguém faz ---------- */}
          {data.semResponsavel.length > 0 ? (
            <View style={styles.avisoSemDono}>
              <Ionicons name="warning-outline" size={17} color={colors.amber} />
              <View style={styles.flex}>
                <Text style={styles.avisoTitulo}>Sem responsável</Text>
                <Text style={styles.avisoTexto}>
                  Ninguém está com {data.semResponsavel.map((t) => t.label).join(", ")}. Enquanto
                  não houver alguém, essas tarefas não aparecem para irmão nenhum.
                </Text>
              </View>
            </View>
          ) : null}

          {/* ---------- pendências ---------- */}
          <Text style={styles.secao}>Pendências</Text>
          {data.pendencias.length === 0 ? (
            <View style={styles.vazio}>
              <Ionicons name="checkmark-done" size={18} color={colors.greenDark} />
              <Text style={styles.vazioTexto}>Nada pendente agora. Tudo em dia.</Text>
            </View>
          ) : (
            <View style={styles.lista}>
              {data.pendencias.map((p) => {
                const { cor, fundo } = corDa(p.situacao);
                const id = `${p.usuarioId}|${p.tipo}|${p.ocorrencia}`;
                return (
                  <View key={id} style={[styles.card, { borderLeftColor: cor }]}>
                    <View style={[styles.icone, { backgroundColor: fundo }]}>
                      <Ionicons name={p.icone as keyof typeof Ionicons.glyphMap} size={15} color={cor} />
                    </View>

                    <View style={styles.flex}>
                      <Text style={styles.nome} numberOfLines={1}>
                        {p.nome}
                      </Text>
                      <Text style={styles.tarefa} numberOfLines={1}>
                        {p.label}
                      </Text>
                      <Text style={[styles.prazo, { color: cor }]}>
                        {p.prazo}
                        {p.detalhe ? ` · ${p.detalhe}` : ""}
                      </Text>
                    </View>

                    {/* Sem aparelho o push não chega. Dizer isso é melhor do que um botão
                        que some sem explicação — ou pior, que finge ter enviado. */}
                    {p.temAparelho ? (
                      <Pressable
                        onPress={() => cobrar(p)}
                        disabled={enviando === id}
                        style={({ pressed }) => [styles.lembrar, pressed && styles.pressionado]}
                        accessibilityRole="button"
                        accessibilityLabel={`Lembrar ${p.nome} de ${p.label}`}
                      >
                        {enviando === id ? (
                          <ActivityIndicator size="small" color={colors.primaryDark} />
                        ) : (
                          <Ionicons name="notifications-outline" size={17} color={colors.primaryDark} />
                        )}
                      </Pressable>
                    ) : (
                      <View style={styles.semAparelho}>
                        <Ionicons name="phone-portrait-outline" size={13} color={colors.textMuted} />
                        <Text style={styles.semAparelhoTexto}>sem app</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* ---------- desempenho ---------- */}
          <View style={styles.tituloComFiltro}>
            <Text style={styles.secao}>Desempenho</Text>
            <View style={styles.filtros}>
              {JANELAS.map((j) => (
                <Pressable
                  key={j.dias}
                  onPress={() => setJanela(j.dias)}
                  style={[styles.filtro, janela === j.dias && styles.filtroAtivo]}
                >
                  <Text style={[styles.filtroTexto, janela === j.dias && styles.filtroTextoAtivo]}>
                    {j.rotulo}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.painel}>
            <BarraDeTaxa
              rotulo="Geral"
              previstas={data.desempenho.geral.previstas}
              cumpridas={data.desempenho.geral.cumpridas}
              noPrazo={data.desempenho.geral.noPrazo}
            />
            <Text style={styles.nota}>
              A barra clara é o que foi cumprido; a escura, o que saiu dentro do prazo. Conta só
              Zoom, Compartilhar Quadro e Confirmações — os quadros aparecem mais abaixo, porque
              publicar é trabalho de mais de um e ratear isso daria número inventado.
            </Text>
          </View>

          <Text style={styles.subsecao}>Por tarefa</Text>
          <View style={styles.painel}>
            {data.desempenho.porTarefa.map((t) => (
              <BarraDeTaxa
                key={t.tipo}
                rotulo={t.label}
                previstas={t.previstas}
                cumpridas={t.cumpridas}
                noPrazo={t.noPrazo}
              />
            ))}
          </View>

          <Text style={styles.subsecao}>Por irmão</Text>
          {data.desempenho.porPessoa.length === 0 ? (
            <View style={styles.vazio}>
              <Ionicons name="information-circle-outline" size={18} color={colors.teal} />
              <Text style={styles.vazioTexto}>
                Ninguém teve tarefa dessas no período — sem dado para comparar.
              </Text>
            </View>
          ) : (
            <View style={styles.painel}>
              {/* Do pior para o melhor: quem precisa de conversa aparece primeiro. */}
              {data.desempenho.porPessoa.map((p) => (
                <BarraDeTaxa
                  key={p.usuarioId}
                  rotulo={p.nome}
                  previstas={p.previstas}
                  cumpridas={p.cumpridas}
                  noPrazo={p.noPrazo}
                />
              ))}
            </View>
          )}

          {/* ---------- quadros ---------- */}
          <Text style={styles.secao}>Quadros, mês a mês</Text>
          {data.quadros.length === 0 ? (
            <View style={styles.vazio}>
              <Ionicons name="information-circle-outline" size={18} color={colors.teal} />
              <Text style={styles.vazioTexto}>Nenhum quadro publicado no período.</Text>
            </View>
          ) : (
            <View style={styles.painel}>
              {data.quadros.map((q) => {
                const cor =
                  q.situacao === "noPrazo"
                    ? colors.greenDark
                    : q.situacao === "atrasado"
                      ? colors.red
                      : colors.textMuted;
                return (
                  <View key={`${q.tipo}-${q.referencia}`} style={styles.quadroLinha}>
                    <View style={[styles.pontinho, { backgroundColor: cor }]} />
                    <View style={styles.flex}>
                      <Text style={styles.quadroTitulo} numberOfLines={1}>
                        {q.label} · {q.referencia}
                      </Text>
                      <Text style={styles.quadroDetalhe}>
                        {q.situacao === "semRegistro"
                          ? "Publicado antes de o app guardar a data"
                          : q.situacao === "noPrazo"
                            ? `No prazo${q.publicadoPor ? ` · ${q.publicadoPor}` : ""}`
                            : `${q.diasDeAtraso} dia(s) de atraso${q.publicadoPor ? ` · ${q.publicadoPor}` : ""}`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ---------- equipe ---------- */}
          <Text style={styles.secao}>Quem está com o quê</Text>
          <View style={styles.painel}>
            {data.equipe.map((m, i) => (
              <Pressable
                key={m.id}
                onPress={() => setDesignando(m)}
                style={({ pressed }) => [
                  styles.membro,
                  i > 0 && styles.divisoria,
                  pressed && styles.pressionado,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Designar tarefas para ${m.nome}`}
              >
                <View style={styles.flex}>
                  <Text style={styles.nome} numberOfLines={1}>
                    {m.nome}
                  </Text>
                  <Text style={styles.membroTarefas} numberOfLines={2}>
                    {m.tarefas.length === 0
                      ? "Nenhuma tarefa"
                      : `${m.tarefas.length} tarefa(s)`}
                    {m.vinculado ? "" : " · sem vínculo com o cadastro"}
                    {m.temAparelho ? "" : " · sem app"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      <TarefasSheet
        user={designando}
        salvando={salvarTarefas.isPending}
        onClose={() => setDesignando(null)}
        onSalvar={salvar}
      />
    </View>
  );
}

function Tile({
  numero,
  rotulo,
  cor,
  fundo,
  icone,
}: {
  numero: number;
  rotulo: string;
  cor: string;
  fundo: string;
  icone: keyof typeof Ionicons.glyphMap;
}) {
  const { styles } = useTema(criarEstilos);
  return (
    <View style={styles.tile}>
      <View style={[styles.tileIcone, { backgroundColor: fundo }]}>
        <Ionicons name={icone} size={15} color={cor} />
      </View>
      <Text style={[styles.tileNumero, { color: cor }]}>{numero}</Text>
      <Text style={styles.tileRotulo}>{rotulo}</Text>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    scroll: { padding: 16, gap: 4 },

    tiles: { flexDirection: "row", gap: 10, marginBottom: 6 },
    tile: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 13,
      gap: 2,
      ...shadow.card,
    },
    tileIcone: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    tileNumero: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
    tileRotulo: { fontSize: 12, color: colors.textSecondary },

    avisoSemDono: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
      backgroundColor: colors.warningBg,
      borderRadius: radius.md,
      padding: 13,
      marginTop: 8,
    },
    avisoTitulo: { fontSize: 13.5, fontWeight: "700", color: colors.amber },
    avisoTexto: { fontSize: 12.5, color: colors.amber, lineHeight: 17, marginTop: 2 },

    secao: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: colors.textMuted,
      marginTop: 20,
      marginBottom: 10,
    },
    subsecao: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, marginTop: 16, marginBottom: 8 },
    tituloComFiltro: { gap: 8 },
    filtros: { flexDirection: "row", gap: 6, marginBottom: 10 },
    filtro: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
    },
    filtroAtivo: { backgroundColor: colors.primary },
    filtroTexto: { fontSize: 12.5, color: colors.textSecondary, fontWeight: "600" },
    filtroTextoAtivo: { color: colors.textOnPrimary },

    lista: { gap: 8 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderLeftWidth: 4,
      paddingVertical: 11,
      paddingLeft: 11,
      paddingRight: 12,
      ...shadow.card,
    },
    icone: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    nome: { fontSize: 14.5, fontWeight: "700", color: colors.text },
    tarefa: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
    prazo: { fontSize: 11.5, fontWeight: "600", marginTop: 2 },
    lembrar: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.infoBg,
    },
    pressionado: { opacity: 0.6 },
    semAparelho: { alignItems: "center", gap: 2, width: 46 },
    semAparelhoTexto: { fontSize: 10, color: colors.textMuted },

    painel: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    nota: { fontSize: 11.5, color: colors.textMuted, lineHeight: 16, paddingBottom: 10, paddingTop: 2 },

    vazio: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    vazioTexto: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

    quadroLinha: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10 },
    pontinho: { width: 9, height: 9, borderRadius: radius.pill },
    quadroTitulo: { fontSize: 13.5, fontWeight: "600", color: colors.text },
    quadroDetalhe: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

    membro: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
    divisoria: { borderTopWidth: 1, borderTopColor: colors.border },
    membroTarefas: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  });
