import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useMinhasDesignacoes } from "@/api/hooks/useMinhasDesignacoes";
import type { Compromisso, TipoCompromisso } from "@/api/types";
import { GradientHeader, Loading } from "@/components/ui";
import { PrivilegioBadge } from "@/components/PrivilegioBadge";
import { useAuth } from "@/context/AuthContext";
import { MESES, radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { funcaoColor, funcaoLabel } from "@/utils/funcoes";

interface VisualTipo {
  label: string;
  curto: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}

/**
 * As cores de categoria vêm do tema, não de hexes fixos: eram justamente elas
 * que ignoravam o modo daltônico. Oliva (quadro) × marrom (saída de campo) é o
 * par que colapsa em protanopia/deuteranopia — no daltônico viram azul × âmbar,
 * e o teal da reunião vira azul-esverdeado.
 */
const tiposDe = (colors: Cores): Record<TipoCompromisso, VisualTipo> => ({
  designacao: {
    label: "Quadro de designações",
    curto: "Quadro",
    icon: "document-text",
    color: colors.oliveSoft,
    bg: colors.infoBg,
  },
  dirigente: {
    label: "Saída de campo",
    curto: "Saída de campo",
    icon: "compass",
    color: colors.amber,
    bg: colors.warningBg,
  },
  reuniao: {
    label: "Reunião",
    curto: "Reunião",
    icon: "people",
    color: colors.greenDark,
    bg: colors.successBg,
  },
});

const ORDEM_TIPOS: TipoCompromisso[] = ["designacao", "dirigente", "reuniao"];

function rotuloDoMes(dataISO: string | null): string {
  if (!dataISO) return "Sem data definida";
  const [ano, mes] = dataISO.split("-").map(Number);
  return `${MESES[mes]} de ${ano}`;
}

function dataPorExtenso(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  return `${dia} de ${MESES[mes]} de ${ano}`;
}

/** "yyyy-MM-dd" de hoje em horário local — o backend compara as datas nesse formato. */
function chaveISOHoje(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

function saudacaoDaHora(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function primeiroNome(nome: string | null | undefined): string {
  const limpo = (nome ?? "").trim();
  if (!limpo) return "";
  return limpo.split(/\s+/)[0];
}

export default function InicioScreen() {
  const { colors, styles, statusConfig } = useTema(criarEstilos);
  const TIPOS = tiposDe(colors);
  // O número do painel fica direto sobre o cartão (colors.surface), não sobre o
  // chip claro — por isso usa o tom forte da categoria, não o `color` dela.
  const corNumero: Record<TipoCompromisso, string> = {
    designacao: colors.primaryDark,
    dirigente: colors.amber,
    reuniao: colors.greenDark,
  };
  const { usuario } = useAuth();
  const [filtro, setFiltro] = useState<"proximas" | "todas">("proximas");
  // Uma chamada só: "todas" traz o histórico inteiro e as próximas saem daqui por
  // filtro, então alternar a lista não custa outra ida à rede.
  const { data, isLoading, refetch, isRefetching } = useMinhasDesignacoes("todas");

  const saudacao = useMemo(() => saudacaoDaHora(), []);
  const nome = primeiroNome(usuario?.nome) || primeiroNome(data?.irmao?.nome) || "irmão";

  const resumo = useMemo(() => {
    const todos = data?.compromissos ?? [];
    const hoje = chaveISOHoje();
    // Sem data definida conta como algo ainda por vir, igual ao backend.
    const proximos = todos.filter((c) => !c.dataISO || c.dataISO >= hoje);

    const porTipo: Record<TipoCompromisso, number> = { designacao: 0, dirigente: 0, reuniao: 0 };
    for (const c of todos) {
      if (porTipo[c.tipo] !== undefined) porTipo[c.tipo] += 1;
    }

    // A lista vem ordenada por data crescente, então o último passado é o mais recente.
    let ultima: Compromisso | null = null;
    for (let i = todos.length - 1; i >= 0; i -= 1) {
      const c = todos[i];
      if (c.dataISO && c.dataISO < hoje) {
        ultima = c;
        break;
      }
    }

    return {
      todos,
      proximos,
      porTipo,
      ultima,
      total: data?.totais?.total ?? todos.length,
      totalProximas: data?.totais?.proximas ?? proximos.length,
    };
  }, [data]);

  const grupos = useMemo(() => {
    const lista = filtro === "todas" ? resumo.todos : resumo.proximos;
    const out: { mes: string; itens: Compromisso[] }[] = [];
    for (const c of lista) {
      const chave = rotuloDoMes(c.dataISO);
      if (!out.length || out[out.length - 1].mes !== chave) out.push({ mes: chave, itens: [] });
      out[out.length - 1].itens.push(c);
    }
    return out;
  }, [filtro, resumo]);

  const funcoes = data?.irmao?.funcoes ?? [];

  const subtitulo = !data?.vinculado
    ? "Vamos conectar sua conta ao cadastro"
    : resumo.totalProximas === 0
      ? "Nada agendado por enquanto"
      : resumo.totalProximas === 1
        ? "Você tem 1 compromisso pela frente"
        : `Você tem ${resumo.totalProximas} compromissos pela frente`;

  return (
    <View style={styles.screen}>
      <GradientHeader title={`${saudacao}, ${nome}`} description={subtitulo} icon="sunny" />

      {isLoading ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {!data?.vinculado ? (
            <View style={styles.aviso}>
              <Ionicons name="link-outline" size={34} color="#C6BAA0" />
              <Text style={styles.avisoTitulo}>Conta ainda não vinculada</Text>
              <Text style={styles.avisoTexto}>{data?.mensagem}</Text>
            </View>
          ) : (
            <>
              <Animated.View entering={FadeInDown.duration(240)}>
                <Text style={styles.secaoLabel}>Seu resumo</Text>

                <View style={styles.destaques}>
                  <View style={styles.destaque}>
                    <View style={[styles.destaqueIcone, { backgroundColor: colors.successBg }]}>
                      <Ionicons name="checkmark-done" size={16} color={colors.primaryDark} />
                    </View>
                    <Text style={styles.destaqueNumero}>{resumo.total}</Text>
                    <Text style={styles.destaqueLabel}>
                      {resumo.total === 1 ? "vez designado" : "vezes designado"}
                    </Text>
                  </View>

                  <View style={styles.destaque}>
                    <View style={[styles.destaqueIcone, { backgroundColor: colors.warningBg }]}>
                      <Ionicons name="hourglass" size={16} color={colors.amber} />
                    </View>
                    <Text style={styles.destaqueNumero}>{resumo.totalProximas}</Text>
                    <Text style={styles.destaqueLabel}>
                      {resumo.totalProximas === 1 ? "compromisso por vir" : "compromissos por vir"}
                    </Text>
                  </View>
                </View>

                <View style={styles.painel}>
                  {ORDEM_TIPOS.map((id, i) => {
                    const tipo = TIPOS[id];
                    return (
                      <View key={id} style={[styles.painelLinha, i > 0 && styles.painelLinhaBorda]}>
                        <View style={[styles.iconeBox, { backgroundColor: tipo.bg }]}>
                          <Ionicons name={tipo.icon} size={15} color={tipo.color} />
                        </View>
                        <Text style={styles.painelTexto}>{tipo.label}</Text>
                        <Text style={[styles.painelNumero, { color: corNumero[id] }]}>
                          {resumo.porTipo[id]}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View style={[styles.painel, styles.painelUltima]}>
                  <View style={[styles.iconeBox, { backgroundColor: colors.sand }]}>
                    <Ionicons name="time" size={15} color={colors.brown} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.ultimaLabel}>Última vez que serviu</Text>
                    {resumo.ultima?.dataISO ? (
                      <>
                        <Text style={styles.ultimaValor}>{dataPorExtenso(resumo.ultima.dataISO)}</Text>
                        <Text style={styles.detalhe} numberOfLines={2}>
                          {[TIPOS[resumo.ultima.tipo]?.curto, resumo.ultima.papel, resumo.ultima.titulo]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.ultimaValor}>Ainda não há registro anterior</Text>
                    )}
                  </View>
                </View>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(60).duration(240)}>
                <Text style={styles.secaoLabel}>Cargos e privilégio</Text>
                <View style={styles.painel}>
                  <View style={styles.irmaoLinha}>
                    <View style={[styles.iconeBox, { backgroundColor: colors.infoBg }]}>
                      <Ionicons name="person" size={15} color={colors.oliveSoft} />
                    </View>
                    <Text style={styles.irmaoNome} numberOfLines={1}>
                      {data.irmao?.nome ?? "—"}
                    </Text>
                    {data.irmao?.privilegio ? (
                      <PrivilegioBadge privilegio={data.irmao.privilegio} size="sm" abreviado />
                    ) : null}
                  </View>

                  {funcoes.length > 0 ? (
                    <View style={styles.chips}>
                      {funcoes.map((f) => (
                        <View key={f} style={[styles.chip, { borderColor: `${funcaoColor(f)}44` }]}>
                          <View style={[styles.chipPonto, { backgroundColor: funcaoColor(f) }]} />
                          <Text style={styles.chipTexto}>{funcaoLabel(f)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.detalhe}>
                      Nenhuma função cadastrada para você no quadro de designações.
                    </Text>
                  )}
                </View>
              </Animated.View>

              <Text style={styles.secaoLabel}>Suas designações</Text>

              <View style={styles.filtros}>
                {(["proximas", "todas"] as const).map((op) => {
                  const ativo = filtro === op;
                  return (
                    <Pressable
                      key={op}
                      onPress={() => setFiltro(op)}
                      style={[styles.filtro, ativo && styles.filtroAtivo]}
                    >
                      <Text style={[styles.filtroTexto, ativo && styles.filtroTextoAtivo]}>
                        {op === "proximas" ? "Próximas" : "Todas"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {grupos.length === 0 ? (
                <View style={styles.aviso}>
                  <Ionicons name="calendar-outline" size={34} color="#C6BAA0" />
                  <Text style={styles.avisoTitulo}>
                    {filtro === "proximas" ? "Nenhum compromisso à frente" : "Nenhuma designação"}
                  </Text>
                  <Text style={styles.avisoTexto}>
                    {filtro === "proximas"
                      ? 'Você não tem designações a partir de hoje. Toque em "Todas" para ver o histórico.'
                      : "Seu nome ainda não aparece em nenhum quadro, escala ou programação."}
                  </Text>
                </View>
              ) : (
                grupos.map((grupo, gi) => (
                  <View key={grupo.mes} style={{ marginBottom: 18 }}>
                    <Text style={styles.mesLabel}>{grupo.mes}</Text>
                    {grupo.itens.map((c, i) => {
                      const tipo = TIPOS[c.tipo] ?? TIPOS.designacao;
                      const rascunho = c.origem?.status === "rascunho";
                      return (
                        <Animated.View
                          key={c.id}
                          entering={FadeInDown.delay(Math.min((gi * 4 + i) * 25, 300)).duration(240)}
                          style={styles.card}
                        >
                          <View style={styles.dataBox}>
                            <Text style={styles.dataDia}>{c.data ? c.data.split("/")[0] : "—"}</Text>
                            <Text style={styles.dataSemana}>{(c.diaSemana || "").slice(0, 3)}</Text>
                          </View>

                          <View style={[styles.iconeBox, { backgroundColor: tipo.bg }]}>
                            <Ionicons name={tipo.icon} size={15} color={tipo.color} />
                          </View>

                          <View style={styles.flex}>
                            <View style={styles.tituloLinha}>
                              <Text style={styles.titulo} numberOfLines={2}>{c.titulo}</Text>
                              {c.papel ? (
                                <View style={[styles.tag, { backgroundColor: tipo.bg }]}>
                                  <Text style={[styles.tagTexto, { color: tipo.color }]}>{c.papel}</Text>
                                </View>
                              ) : null}
                              {rascunho ? (
                                <View style={[styles.tag, { backgroundColor: statusConfig.rascunho.bg }]}>
                                  <Text style={[styles.tagTexto, { color: statusConfig.rascunho.color }]}>Rascunho</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.detalhe} numberOfLines={2}>
                              {[tipo.label, c.detalhe, c.local, c.horario].filter(Boolean).join(" · ")}
                            </Text>
                            {c.dataAproximada ? (
                              <Text style={styles.aproximada}>
                                Data aproximada — confira na programação
                              </Text>
                            ) : null}
                          </View>
                        </Animated.View>
                      );
                    })}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: 32 },
    flex: { flex: 1, minWidth: 0 },

    secaoLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: colors.textMuted,
      marginBottom: 10,
      marginTop: 6,
    },

    destaques: { flexDirection: "row", gap: 10, marginBottom: 10 },
    destaque: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 2,
      ...shadow.card,
    },
    destaqueIcone: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    destaqueNumero: { fontSize: 26, fontWeight: "700", color: colors.text, letterSpacing: -0.6 },
    destaqueLabel: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },

    painel: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 4,
      marginBottom: 10,
    },
    painelLinha: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11 },
    painelLinhaBorda: { borderTopWidth: 1, borderTopColor: colors.border },
    painelTexto: { flex: 1, fontSize: 13.5, color: colors.textSecondary },
    painelNumero: { fontSize: 16, fontWeight: "700" },
    painelUltima: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingVertical: 13 },
    ultimaLabel: {
      fontSize: 10.5,
      fontWeight: "700",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: colors.textMuted,
    },
    ultimaValor: { fontSize: 14.5, fontWeight: "600", color: colors.text, marginTop: 3 },

    irmaoLinha: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11 },
    irmaoNome: { flex: 1, fontSize: 14.5, fontWeight: "600", color: colors.text },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      paddingTop: 11,
      paddingBottom: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    chipPonto: { width: 7, height: 7, borderRadius: 999 },
    chipTexto: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },

    filtros: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
    filtro: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    filtroAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    filtroTexto: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
    filtroTextoAtivo: { color: colors.textOnPrimary },

    mesLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: colors.textMuted,
      marginBottom: 8,
    },

    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: "#EFE7D8",
      padding: 12,
      marginBottom: 8,
    },
    dataBox: {
      width: 42,
      alignItems: "center",
      borderRightWidth: 1,
      borderRightColor: "#ECE3D3",
      paddingRight: 10,
    },
    dataDia: { fontSize: 17, fontWeight: "700", color: colors.text },
    dataSemana: { fontSize: 9.5, color: colors.textMuted, textTransform: "uppercase" },
    iconeBox: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },

    tituloLinha: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    titulo: { fontSize: 14.5, fontWeight: "600", color: colors.text, flexShrink: 1 },
    tag: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
    tagTexto: { fontSize: 10, fontWeight: "700" },
    detalhe: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    aproximada: { fontSize: 11, color: colors.amber, marginTop: 3 },

    aviso: { alignItems: "center", paddingVertical: 46, paddingHorizontal: 24, gap: 8 },
    avisoTitulo: { fontSize: 16, fontWeight: "600", color: colors.text, marginTop: 4 },
    avisoTexto: { fontSize: 13.5, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
  });
