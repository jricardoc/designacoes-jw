import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useDefinirSecretario, usePainelGrupos, useResumoRelatorio } from "@/api/hooks/useGrupos";
import { useIrmaos } from "@/api/hooks/useIrmaos";
import type { GrupoNoPainel, TotaisRelatorio } from "@/api/types";
import { BarraProgresso, diaMes, mesDeReferencia, SeletorMes } from "@/components/grupos/comum";
import { useBarraFlutuante } from "@/components/layout/contextoRolagem";
import { EmptyState, GradientHeader, Loading, SelectSheet, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { nomeMes } from "@/utils/assistenciaMensal";
import { ehAdminGeral, podeVerGrupos } from "@/utils/permissoes";
import { usePuxar } from "@/utils/usePuxar";

const primeiroNome = (nome: string) => nome.split(/\s+/)[0];

/**
 * Os grupos de campo e o relatório de serviço do mês.
 *
 * O dirigente e o ajudante veem o próprio grupo; o secretário e o admin geral veem todos e,
 * em cima, o total da congregação. O admin importa daqui a nova divisão dos grupos (PDF).
 */
export default function GruposScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const { rolagem, recuo } = useBarraFlutuante();
  const { usuario } = useAuth();
  const toast = useToast();
  const [mes, setMes] = useState(mesDeReferencia);
  const [escolhendoSecretario, setEscolhendoSecretario] = useState(false);
  const { data, isLoading, refetch } = usePainelGrupos(mes);
  const admin = ehAdminGeral(usuario);
  // A lista de irmãos só para o admin, e só quando ele for escolher o secretário.
  const { data: irmaos } = useIrmaos(admin && escolhendoSecretario);
  const definirSecretario = useDefinirSecretario();
  const resumo = useResumoRelatorio(mes, !!data?.veTodos);
  const puxar = usePuxar(() => Promise.all([refetch(), data?.veTodos ? resumo.refetch() : null]));

  if (!podeVerGrupos(usuario)) {
    return (
      <View style={styles.tela}>
        <GradientHeader title="Grupos" description="Acesso restrito" icon="lock-closed" />
        <EmptyState
          icon="lock-closed-outline"
          title="Área dos dirigentes de grupo"
          message="Esta tela é do dirigente e do ajudante de cada grupo, do secretário e dos administradores."
        />
      </View>
    );
  }

  const grupos = data?.grupos ?? [];
  const meus = grupos.filter((g) => usuario?.irmao?.gruposQueLidera?.includes(g.id));
  // O pedido é do mês que acabou de passar; em meses antigos não há o que pedir.
  const aPedir = data?.pedir ? meus.filter((g) => !g.concluidoEm) : [];
  const abrir = (g: GrupoNoPainel) => router.push({ pathname: "/grupos/[id]", params: { id: String(g.id), mes } });

  return (
    <View style={styles.tela}>
      <GradientHeader title="Grupos" description="Relatório de campo e membros" icon="people" />
      {isLoading && !data ? (
        <Loading label="Carregando os grupos..." />
      ) : (
        <ScrollView
          {...rolagem}
          contentContainerStyle={[styles.scroll, recuo]}
          refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}
        >
          <SeletorMes mes={mes} onMudar={setMes} />

          {aPedir.map((g) => (
            <Animated.View key={g.id} entering={FadeInDown.duration(240)}>
              <Pressable style={styles.tarefa} onPress={() => abrir(g)} accessibilityRole="button">
                <View style={styles.tarefaIcone}>
                  <Ionicons name="document-text-outline" size={18} color={colors.amber} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.tarefaTitulo}>
                    Peça o relatório de {nomeMes(mes).split(" de ")[0]} ao {g.rotulo.replace(/^Grupo/, "grupo")}
                  </Text>
                  <Text style={styles.tarefaDetalhe}>
                    {g.entregues} de {g.membros} já entregaram · a mensagem pronta está no grupo
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            </Animated.View>
          ))}

          {data?.veTodos && resumo.data ? (
            <Totais
              totais={resumo.data.totais}
              concluidos={resumo.data.grupos.filter((g) => g.concluidoEm).length}
              total={resumo.data.grupos.length}
              completo={resumo.data.completo}
            />
          ) : null}

          {grupos.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="Nenhum grupo ainda"
              message={
                ehAdminGeral(usuario)
                  ? "Importe a lista de grupos (PDF) para montar os grupos de campo."
                  : "Você ainda não está em nenhum grupo como dirigente ou ajudante."
              }
            />
          ) : (
            grupos.map((g, i) => (
              <Animated.View key={g.id} entering={FadeInDown.duration(240).delay(Math.min(i, 8) * 30)}>
                <Pressable
                  style={({ pressed }) => [styles.grupo, pressed && { opacity: 0.85 }]}
                  onPress={() => abrir(g)}
                  accessibilityRole="button"
                  accessibilityLabel={`${g.rotulo}. ${g.entregues} de ${g.membros} entregaram`}
                >
                  <View style={styles.grupoTopo}>
                    <View style={[styles.numero, g.concluidoEm && { backgroundColor: colors.successBg }]}>
                      {g.concluidoEm ? (
                        <Ionicons name="checkmark" size={18} color={colors.greenDark} />
                      ) : (
                        <Text style={styles.numeroTexto}>{g.numero ?? "–"}</Text>
                      )}
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.grupoNome}>{g.rotulo}</Text>
                      <Text style={styles.grupoSub} numberOfLines={1}>
                        {[g.local, g.ajudante ? `Ajudante: ${primeiroNome(g.ajudante.nome)}` : null]
                          .filter(Boolean)
                          .join(" · ") || `${g.membros} membros`}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </View>
                  <BarraProgresso feitos={g.entregues} total={g.membros} />
                  <Text style={[styles.grupoStatus, g.concluidoEm && { color: colors.greenDark }]}>
                    {g.concluidoEm
                      ? `Concluído em ${diaMes(g.concluidoEm)} · ${g.membros} relatórios`
                      : `${g.entregues} de ${g.membros} entregaram`}
                  </Text>
                </Pressable>
              </Animated.View>
            ))
          )}

          {admin ? (
            <Pressable style={styles.importar} onPress={() => setEscolhendoSecretario(true)} accessibilityRole="button">
              <Ionicons name="ribbon-outline" size={18} color={colors.primaryDark} />
              <View style={styles.flex}>
                <Text style={styles.importarTitulo}>
                  {data?.secretario ? `Secretário: ${data.secretario.nome}` : "Escolher o secretário"}
                </Text>
                <Text style={styles.importarDetalhe}>
                  Vê todos os grupos e o total da congregação, e é avisado quando cada grupo conclui
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}

          {admin ? (
            <Pressable style={styles.importar} onPress={() => router.push("/grupos/importar")} accessibilityRole="button">
              <Ionicons name="cloud-upload-outline" size={18} color={colors.primaryDark} />
              <View style={styles.flex}>
                <Text style={styles.importarTitulo}>Importar nova divisão dos grupos</Text>
                <Text style={styles.importarDetalhe}>
                  O PDF da lista de grupos: atualiza dirigentes, ajudantes, membros e pioneiros regulares
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </ScrollView>
      )}

      <SelectSheet
        visible={escolhendoSecretario}
        title="Quem é o secretário?"
        options={(irmaos ?? [])
          .filter((i) => i.ativo && i.genero !== "irma")
          .map((i) => ({ value: String(i.id), label: i.nome }))
          .sort((a, b) => a.label.localeCompare(b.label))}
        selected={data?.secretario ? String(data.secretario.id) : undefined}
        allowClear
        onSelect={(v) =>
          definirSecretario.mutate(v ? Number(v) : null, {
            onSuccess: () => toast.show(v ? "Secretário definido" : "Secretário removido"),
            onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para salvar", "error"),
          })
        }
        onClose={() => setEscolhendoSecretario(false)}
      />
    </View>
  );
}

/** O relatório da congregação (como no S-1), para o secretário. */
function Totais({ totais, concluidos, total, completo }: { totais: TotaisRelatorio; concluidos: number; total: number; completo: boolean }) {
  const { colors, styles } = useTema(criarEstilos);
  const linhas = [
    { rotulo: "Publicadores", q: totais.publicadores.quantidade, h: null, e: totais.publicadores.estudos },
    { rotulo: "Pioneiros auxiliares", q: totais.auxiliares.quantidade, h: totais.auxiliares.horas, e: totais.auxiliares.estudos },
    { rotulo: "Pioneiros regulares", q: totais.regulares.quantidade, h: totais.regulares.horas, e: totais.regulares.estudos },
  ];
  return (
    <Animated.View entering={FadeInDown.duration(240)} style={styles.bloco}>
      <View style={styles.blocoTopo}>
        <Text style={styles.blocoTitulo}>Relatório da congregação</Text>
        {completo ? (
          <View style={styles.selo}>
            <Ionicons name="checkmark-circle" size={14} color={colors.greenDark} />
            <Text style={styles.seloTexto}>Completo</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.blocoSub}>
        {completo ? "Todos os grupos entregaram." : `${concluidos} de ${total} grupos concluíram. O total vai somando.`}
      </Text>
      <View style={styles.tabelaCabeca}>
        <Text style={[styles.tabelaRotulo, styles.flex]} />
        <Text style={styles.tabelaColuna}>Relatórios</Text>
        <Text style={styles.tabelaColuna}>Horas</Text>
        <Text style={styles.tabelaColuna}>Estudos</Text>
      </View>
      {linhas.map((l) => (
        <View key={l.rotulo} style={styles.tabelaLinha}>
          <Text style={[styles.tabelaRotulo, styles.flex]}>{l.rotulo}</Text>
          <Text style={styles.tabelaValor}>{l.q}</Text>
          <Text style={styles.tabelaValor}>{l.h ?? "—"}</Text>
          <Text style={styles.tabelaValor}>{l.e}</Text>
        </View>
      ))}
      <Text style={styles.blocoRodape}>
        {totais.entregues} relatórios entregues · {totais.naoParticiparam} não participaram
      </Text>
    </Animated.View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, gap: 12 },
    flex: { flex: 1 },
    tarefa: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: radius.lg,
      backgroundColor: colors.warningBg,
      borderLeftWidth: 4,
      borderLeftColor: colors.amber,
    },
    tarefaIcone: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    tarefaTitulo: { fontSize: 15, fontWeight: "800", color: colors.text },
    tarefaDetalhe: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    grupo: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.card,
    },
    grupoTopo: { flexDirection: "row", alignItems: "center", gap: 12 },
    numero: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.sand,
    },
    numeroTexto: { fontSize: 16, fontWeight: "900", color: colors.primaryDark },
    grupoNome: { fontSize: 17, fontWeight: "800", color: colors.text },
    grupoSub: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
    grupoStatus: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
    bloco: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 14,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    blocoTopo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    blocoTitulo: { fontSize: 16, fontWeight: "800", color: colors.text },
    blocoSub: { fontSize: 13, color: colors.textSecondary },
    blocoRodape: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
    selo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.successBg,
    },
    seloTexto: { fontSize: 12, fontWeight: "800", color: colors.greenDark },
    tabelaCabeca: { flexDirection: "row", alignItems: "center", marginTop: 4 },
    tabelaLinha: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    tabelaRotulo: { fontSize: 14, fontWeight: "700", color: colors.text },
    tabelaColuna: { width: 70, textAlign: "right", fontSize: 11.5, fontWeight: "700", color: colors.textMuted },
    tabelaValor: { width: 70, textAlign: "right", fontSize: 16, fontWeight: "800", color: colors.text },
    importar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.borderStrong,
      marginTop: 4,
    },
    importarTitulo: { fontSize: 14.5, fontWeight: "800", color: colors.primaryDark },
    importarDetalhe: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  });
