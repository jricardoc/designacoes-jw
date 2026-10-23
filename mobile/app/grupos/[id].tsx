import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError } from "@/api/client";
import { useDetalheGrupo } from "@/api/hooks/useGrupos";
import type { MembroGrupo, PeriodoGrupo } from "@/api/types";
import { PrivilegioBadge } from "@/components/PrivilegioBadge";
import { BarraProgresso, diaMes, mesDeReferencia, resumoDoRelatorio, SeletorMes } from "@/components/grupos/comum";
import { RelatorioSheet } from "@/components/grupos/RelatorioSheet";
import { Button, EmptyState, GradientHeader, Loading, useToast } from "@/components/ui";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { usePuxar } from "@/utils/usePuxar";

type Aba = "relatorio" | "membros";

const PERIODOS: { id: PeriodoGrupo; rotulo: string }[] = [
  { id: "mes", rotulo: "Este mês" },
  { id: "3m", rotulo: "3 meses" },
  { id: "ano", rotulo: "Ano de serviço" },
];

/** O que cada número dos membros conta. A ordem é a da linha de cada irmão. */
const NUMEROS = [
  { chave: "zoom", icone: "videocam-outline", rotulo: "Zoom", legenda: "reuniões assistidas pelo Zoom" },
  { chave: "mecanicas", icone: "clipboard-outline", rotulo: "Quadro", legenda: "designações do quadro (mecânicas)" },
  { chave: "reuniao", icone: "mic-outline", rotulo: "Reunião", legenda: "partes na reunião" },
  { chave: "dirigente", icone: "walk-outline", rotulo: "Campo", legenda: "saídas de campo como dirigente" },
] as const;

/**
 * Um grupo de campo: o relatório do mês (quem entregou, quem falta, a mensagem pronta para
 * pedir) e os membros com o que cada um fez no período.
 */
export default function GrupoScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams<{ id: string; mes?: string }>();
  const id = Number(params.id);
  const [mes, setMes] = useState(() => (/^\d{4}-\d{2}$/.test(params.mes ?? "") ? params.mes! : mesDeReferencia()));
  const [aba, setAba] = useState<Aba>("relatorio");
  const [periodo, setPeriodo] = useState<PeriodoGrupo>("3m");
  const [aberto, setAberto] = useState<MembroGrupo | null>(null);
  const { data, isLoading, error, refetch } = useDetalheGrupo(id, mes, periodo);
  const puxar = usePuxar(refetch);

  if (isLoading && !data) return <Loading label="Carregando o grupo..." />;
  if (!data) {
    const semAcesso = error instanceof ApiError && (error.status === 403 || error.status === 404);
    return (
      <View style={styles.tela}>
        <GradientHeader title="Grupo" showBack />
        <EmptyState
          icon={semAcesso ? "lock-closed-outline" : "cloud-offline-outline"}
          title={semAcesso ? "Você não tem acesso a este grupo" : "Não deu para carregar"}
          message={semAcesso ? "Só o dirigente e o ajudante do grupo, o secretário e os administradores abrem esta tela." : "Puxe para tentar de novo."}
        />
      </View>
    );
  }

  const { grupo, membros } = data;
  const faltam = membros.filter((m) => !m.relatorio);
  const entregaram = membros.filter((m) => m.relatorio);
  const mesCurto = data.nomeMes.split(" de ")[0];

  const pedirNoGrupo = () => Share.share({ message: data.textoPedido }).catch(() => {});
  const pedirA = async (m: MembroGrupo) => {
    if (!m.whatsapp) return;
    try {
      await Linking.openURL(m.whatsapp);
    } catch {
      toast.show("Não consegui abrir o WhatsApp", "error");
    }
  };

  const etiquetas = (m: MembroGrupo) => (
    <View style={styles.etiquetas}>
      {m.lider ? (
        <View style={[styles.etiqueta, { backgroundColor: colors.infoBg }]}>
          <Text style={[styles.etiquetaTexto, { color: colors.primaryDark }]}>{m.lider === "dirigente" ? "Dirigente" : "Ajudante"}</Text>
        </View>
      ) : null}
      {m.pioneiro === "regular" ? (
        <View style={[styles.etiqueta, { backgroundColor: colors.successBg }]}>
          <Ionicons name="leaf" size={11} color={colors.greenDark} />
          <Text style={[styles.etiquetaTexto, { color: colors.greenDark }]}>Pioneiro regular</Text>
        </View>
      ) : null}
      {m.privilegio ? <PrivilegioBadge privilegio={m.privilegio} size="sm" abreviado /> : null}
    </View>
  );

  const linhaRelatorio = (m: MembroGrupo, i: number) => (
    <Animated.View key={m.id} entering={FadeInDown.duration(220).delay(Math.min(i, 10) * 25)}>
      <Pressable
        style={({ pressed }) => [styles.membro, pressed && { opacity: 0.8 }]}
        onPress={() => setAberto(m)}
        accessibilityRole="button"
        accessibilityLabel={`${m.nome}. ${m.relatorio ? resumoDoRelatorio(m.relatorio) : "Pendente"}`}
      >
        <View style={[styles.situacao, { backgroundColor: m.relatorio ? colors.successBg : colors.warningBg }]}>
          <Ionicons name={m.relatorio ? "checkmark" : "time-outline"} size={15} color={m.relatorio ? colors.greenDark : colors.amber} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.membroNome}>{m.nome}</Text>
          {etiquetas(m)}
          <Text style={[styles.membroRelatorio, !m.relatorio && { color: colors.amber }]}>
            {m.relatorio ? resumoDoRelatorio(m.relatorio) : "Falta entregar"}
          </Text>
        </View>
        {!m.relatorio && m.whatsapp ? (
          <Pressable style={styles.whats} onPress={() => pedirA(m)} hitSlop={6} accessibilityLabel={`Pedir o relatório para ${m.nome} no WhatsApp`}>
            <Ionicons name="logo-whatsapp" size={18} color={colors.greenDark} />
          </Pressable>
        ) : (
          <Ionicons name="create-outline" size={18} color={colors.textMuted} />
        )}
      </Pressable>
    </Animated.View>
  );

  const total = (chave: (typeof NUMEROS)[number]["chave"]) => membros.reduce((s, m) => s + m.estatisticas[chave], 0);

  return (
    <View style={styles.tela}>
      <GradientHeader
        title={grupo.rotulo}
        description={[grupo.numero ? `Grupo ${grupo.numero}` : null, grupo.local].filter(Boolean).join(" · ") || `${membros.length} membros`}
        showBack
      />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}
      >
        <View style={styles.abas}>
          {(
            [
              { id: "relatorio", rotulo: "Relatório", icone: "document-text-outline" },
              { id: "membros", rotulo: `Membros (${membros.length})`, icone: "people-outline" },
            ] as const
          ).map((a) => {
            const ativa = aba === a.id;
            return (
              <Pressable
                key={a.id}
                style={[styles.aba, ativa && styles.abaAtiva]}
                onPress={() => setAba(a.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativa }}
              >
                <Ionicons name={a.icone} size={16} color={ativa ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.abaTexto, ativa && styles.abaTextoAtiva]}>{a.rotulo}</Text>
              </Pressable>
            );
          })}
        </View>

        {aba === "relatorio" ? (
          <Animated.View key="relatorio" entering={FadeIn.duration(200)} style={styles.secao}>
            <SeletorMes mes={mes} onMudar={setMes} />

            <View style={styles.cartao}>
              <View style={styles.cartaoTopo}>
                <Text style={styles.contagem}>
                  {data.entregues}
                  <Text style={styles.contagemDe}> de {membros.length}</Text>
                </Text>
                {data.concluidoEm ? (
                  <View style={styles.selo}>
                    <Ionicons name="checkmark-circle" size={15} color={colors.greenDark} />
                    <Text style={styles.seloTexto}>Concluído em {diaMes(data.concluidoEm)}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.cartaoLegenda}>entregaram o relatório de {mesCurto}</Text>
              <BarraProgresso feitos={data.entregues} total={membros.length} />
              {!data.concluidoEm ? (
                <Button label="Pedir no grupo do WhatsApp" icon="logo-whatsapp" onPress={pedirNoGrupo} fullWidth />
              ) : (
                <Text style={styles.cartaoNota}>O secretário já foi avisado de que o grupo concluiu.</Text>
              )}
            </View>

            {faltam.length > 0 ? (
              <View style={styles.bloco}>
                <Text style={styles.blocoTitulo}>Faltam ({faltam.length})</Text>
                <Text style={styles.blocoAjuda}>Toque no irmão para anotar o relatório dele.</Text>
                {faltam.map(linhaRelatorio)}
              </View>
            ) : null}

            {entregaram.length > 0 ? (
              <View style={styles.bloco}>
                <Text style={styles.blocoTitulo}>Entregaram ({entregaram.length})</Text>
                {entregaram.map(linhaRelatorio)}
              </View>
            ) : null}
          </Animated.View>
        ) : (
          <Animated.View key="membros" entering={FadeIn.duration(200)} style={styles.secao}>
            <View style={styles.filtros}>
              {PERIODOS.map((p) => {
                const ativo = periodo === p.id;
                return (
                  <Pressable
                    key={p.id}
                    style={[styles.filtro, ativo && styles.filtroAtivo]}
                    onPress={() => setPeriodo(p.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: ativo }}
                  >
                    <Text style={[styles.filtroTexto, ativo && styles.filtroTextoAtivo]}>{p.rotulo}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.totais}>
              {NUMEROS.map((n) => (
                <View key={n.chave} style={styles.total}>
                  <Ionicons name={n.icone} size={16} color={colors.primaryDark} />
                  <Text style={styles.totalNumero}>{total(n.chave)}</Text>
                  <Text style={styles.totalRotulo}>{n.rotulo}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.legenda}>
              {NUMEROS.map((n) => `${n.rotulo}: ${n.legenda}`).join(" · ")}. Só conta o que já aconteceu.
            </Text>

            <View style={styles.bloco}>
              {membros.map((m, i) => (
                <Animated.View key={m.id} entering={FadeInDown.duration(220).delay(Math.min(i, 10) * 25)} style={styles.membro}>
                  <View style={styles.flex}>
                    <Text style={styles.membroNome}>{m.nome}</Text>
                    {etiquetas(m)}
                    <View style={styles.numeros}>
                      {NUMEROS.map((n) => {
                        const valor = m.estatisticas[n.chave];
                        return (
                          <View key={n.chave} style={[styles.numero, valor === 0 && { opacity: 0.45 }]} accessibilityLabel={`${n.legenda}: ${valor}`}>
                            <Ionicons name={n.icone} size={13} color={colors.textSecondary} />
                            <Text style={styles.numeroTexto}>{valor}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <RelatorioSheet
        membro={aberto}
        mes={mes}
        nomeMes={mesCurto}
        rotuloGrupo={grupo.rotulo}
        fechaOGrupo={!data.concluidoEm && faltam.length === 1}
        onClose={() => setAberto(null)}
      />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, gap: 14 },
    secao: { gap: 14 },
    flex: { flex: 1 },
    abas: { flexDirection: "row", gap: 8 },
    aba: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    abaAtiva: { backgroundColor: colors.primary, borderColor: colors.primary },
    abaTexto: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
    abaTextoAtiva: { color: colors.textOnPrimary },
    cartao: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.card,
    },
    cartaoTopo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    contagem: { fontSize: 34, fontWeight: "900", color: colors.text },
    contagemDe: { fontSize: 18, fontWeight: "700", color: colors.textSecondary },
    cartaoLegenda: { fontSize: 13.5, color: colors.textSecondary, marginTop: -6 },
    cartaoNota: { fontSize: 13, color: colors.greenDark, fontWeight: "600" },
    selo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.successBg,
    },
    seloTexto: { fontSize: 12.5, fontWeight: "800", color: colors.greenDark },
    bloco: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    blocoTitulo: { fontSize: 15, fontWeight: "800", color: colors.text },
    blocoAjuda: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, marginBottom: 4 },
    membro: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 11,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    situacao: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    membroNome: { fontSize: 15, fontWeight: "700", color: colors.text },
    membroRelatorio: { fontSize: 13, color: colors.textSecondary, marginTop: 3, fontWeight: "600" },
    etiquetas: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 3 },
    etiqueta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    etiquetaTexto: { fontSize: 11, fontWeight: "700" },
    whats: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.successBg,
    },
    filtros: { flexDirection: "row", gap: 8 },
    filtro: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
    },
    filtroAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    filtroTexto: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
    filtroTextoAtivo: { color: colors.textOnPrimary },
    totais: { flexDirection: "row", gap: 8 },
    total: {
      flex: 1,
      alignItems: "center",
      gap: 2,
      paddingVertical: 10,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    totalNumero: { fontSize: 20, fontWeight: "900", color: colors.text },
    totalRotulo: { fontSize: 11.5, fontWeight: "700", color: colors.textSecondary },
    legenda: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
    numeros: { flexDirection: "row", gap: 14, marginTop: 6 },
    numero: { flexDirection: "row", alignItems: "center", gap: 4 },
    numeroTexto: { fontSize: 13.5, fontWeight: "800", color: colors.text },
  });
