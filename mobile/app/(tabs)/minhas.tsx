import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useConfig } from "@/api/hooks/useMisc";
import { useMinhasDesignacoes } from "@/api/hooks/useMinhasDesignacoes";
import type { Compromisso, Config, TipoCompromisso } from "@/api/types";
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
    color: colors.teal,
    bg: colors.tealBg,
  },
});

const ORDEM_TIPOS: TipoCompromisso[] = ["designacao", "dirigente", "reuniao"];

function rotuloDoMes(dataISO: string | null): string {
  if (!dataISO) return "Sem data definida";
  const [ano, mes] = dataISO.split("-").map(Number);
  return `${MESES[mes]} de ${ano}`;
}

/**
 * Quanto tempo um compromisso continua sendo "o de agora" depois da hora de
 * início. A reunião do meio de semana começa 19:30 e termina 21:15; 2h30 cobre
 * ela inteira com folga, e é o que separa "ainda é hoje" de "já passou".
 *
 * Sem isto a tela virava só no dia seguinte: às 21:30, com a reunião encerrada,
 * o app ainda apontava para ela como próximo compromisso.
 */
const DURACAO_COMPROMISSO_MS = 2.5 * 60 * 60 * 1000;

/** De quanto em quanto tempo a tela reavalia o relógio, com o app aberto. */
const INTERVALO_RELOGIO_MS = 60 * 1000;

/** "yyyy-MM-dd" -> [ano, mes, dia], ou null se vier truncado/ilegível. */
function partesDaData(dataISO: string): [number, number, number] | null {
  const partes = dataISO.split("-");
  if (partes.length !== 3) return null;
  const [ano, mes, dia] = partes.map(Number);
  if ([ano, mes, dia].some((n) => !Number.isFinite(n))) return null;
  return [ano, mes, dia];
}

function ehFimDeSemana(dataISO: string): boolean {
  const partes = partesDaData(dataISO);
  if (!partes) return false;
  const [ano, mes, dia] = partes;
  const d = new Date(ano, mes - 1, dia).getDay();
  return d === 0 || d === 6;
}

/**
 * Lê o horário próprio de um compromisso (só a saída de campo tem).
 *
 * `SaidaCampo.horario` é texto livre no banco, então aceita mais do que "08:45":
 * quem cadastra escreve "8h45" e antes disso caía no horário da reunião — a tela
 * mostrava 19:30 numa saída da manhã e escondia o valor real. Aqui as duas
 * formas são entendidas, e o que não der para ler devolve `null` em vez de
 * inventar hora.
 */
function horaPropria(c: Compromisso): string | null {
  const bruto = String(c.horario ?? "").trim();
  if (!bruto) return null;
  const m = /^(\d{1,2})\s*[:hH]\s*(\d{2})$/.exec(bruto);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * Compromisso que ocupa o dia/semana inteiros e não tem hora nenhuma — a limpeza
 * do salão é o caso: o backend a marca com `dataAproximada` e a data da reunião
 * só para ela ter onde aparecer.
 *
 * Fingir uma hora para eles fazia dois estragos: empatavam com as designações
 * reais da mesma reunião e roubavam o card de destaque no desempate por título,
 * e a tela afirmava um horário que ninguém combinou.
 */
function semHoraDefinida(c: Compromisso): boolean {
  return !!c.dataAproximada && horaPropria(c) === null;
}

/**
 * A que horas o compromisso começa.
 *
 * Espelha `horaDoCompromisso` de backend/src/services/RegrasLembrete.js: a saída
 * de campo tem horário próprio gravado e ele ganha do horário da reunião — é o
 * único compromisso que não acontece no salão. Divergir daqui faria a tela e o
 * lembrete push discordarem sobre o mesmo compromisso.
 *
 * Ressalva conhecida: aqui a hora é interpretada no fuso do APARELHO, enquanto o
 * backend fixa America/Bahia. Para quem está na Bahia dá no mesmo; num aparelho
 * com outro fuso o corte desliza junto. Acertar isso exigiria carregar o fuso da
 * congregação, e não vale a complexidade enquanto o app é de uma congregação só.
 */
function horaDoCompromisso(c: Compromisso, config?: Config): string {
  const propria = horaPropria(c);
  if (propria) return propria;
  if (c.dataISO && ehFimDeSemana(c.dataISO)) return config?.horaFimDeSemana || "09:00";
  return config?.horaMeioSemana || "19:30";
}

/**
 * Instante de início em ms locais. `null` para compromisso sem data definida.
 *
 * O que não tem hora (ver `semHoraDefinida`) é ancorado no FIM do dia: assim
 * perde qualquer empate com os compromissos reais daquele dia e continua na
 * lista até a virada, que é o alcance que ele de fato tem.
 */
function instanteDoCompromisso(c: Compromisso, config?: Config): number | null {
  if (!c.dataISO) return null;
  const partes = partesDaData(c.dataISO);
  if (!partes) return null;
  const [ano, mes, dia] = partes;
  if (semHoraDefinida(c)) return new Date(ano, mes - 1, dia, 23, 59, 59, 999).getTime();
  const [h, m] = horaDoCompromisso(c, config).split(":").map(Number);
  if ([h, m].some((n) => !Number.isFinite(n))) return null;
  return new Date(ano, mes - 1, dia, h, m, 0, 0).getTime();
}

/**
 * Ainda está por vir? Vale até `DURACAO_COMPROMISSO_MS` depois do início.
 * Compromisso sem data conta como futuro, igual ao backend.
 *
 * `configPronta` é falso enquanto o horário da congregação não chegou (ou a
 * consulta falhou). Nesse caso o corte cai para o fim do dia: com o padrão
 * chutado de 09:00, uma congregação que se reúne às 17:00 teria o compromisso
 * de domingo APAGADO da tela ao meio-dia. Errar mostrando demais é recuperável;
 * errar escondendo, não.
 */
function aindaPorVir(
  c: Compromisso,
  agora: number,
  config: Config | undefined,
  configPronta: boolean,
): boolean {
  const inicio = instanteDoCompromisso(c, config);
  if (inicio === null) return true;
  if (semHoraDefinida(c) || !configPronta) {
    const fimDoDia = new Date(inicio);
    fimDoDia.setHours(23, 59, 59, 999);
    return agora <= fimDoDia.getTime();
  }
  return agora <= inicio + DURACAO_COMPROMISSO_MS;
}

/** "Hoje às 19:30", "Amanhã", "Quinta-Feira, 14/08 às 19:30". */
function rotuloQuando(c: Compromisso, agora: number, config?: Config): string {
  // Sem hora real, nenhuma hora é impressa: o card não pode afirmar um horário
  // que ninguém combinou (a linha "Data aproximada" logo abaixo explica).
  const sufixo = semHoraDefinida(c) ? "" : ` às ${horaDoCompromisso(c, config)}`;
  if (!c.dataISO) return sufixo ? `Data a confirmar ·${sufixo}` : "Data a confirmar";

  const inicio = instanteDoCompromisso(c, config);
  const hojeMeiaNoite = new Date(agora);
  hojeMeiaNoite.setHours(0, 0, 0, 0);
  const diaDoCompromisso = new Date(inicio ?? agora);
  diaDoCompromisso.setHours(0, 0, 0, 0);

  const dias = Math.round(
    (diaDoCompromisso.getTime() - hojeMeiaNoite.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (dias === 0) return `Hoje${sufixo}`;
  if (dias === 1) return `Amanhã${sufixo}`;

  const partes = c.dataISO.split("-");
  const dia = partes[2] ?? "";
  const mes = partes[1] ?? "";
  if (dias > 1 && dias < 7 && c.diaSemana) {
    return `${c.diaSemana}, ${dia}/${mes}${sufixo}`;
  }
  return `${dia}/${mes}${sufixo}`;
}

function saudacaoDaHora(agora: number): string {
  const hora = new Date(agora).getHours();
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
    reuniao: colors.teal,
  };
  const { usuario } = useAuth();
  const [filtro, setFiltro] = useState<"proximas" | "todas">("proximas");
  // Uma chamada só: "todas" traz o histórico inteiro e as próximas saem daqui por
  // filtro, então alternar a lista não custa outra ida à rede.
  const { data, isLoading, refetch, isRefetching } = useMinhasDesignacoes("todas");
  // Horário das reuniões da congregação: é dele que sai o início de tudo que não
  // é saída de campo. Enquanto não chega, o corte por hora fica desligado — ver
  // `aindaPorVir`.
  const { data: config, isSuccess: configPronta } = useConfig();

  /**
   * O relógio da tela. Sem ele o corte por hora só mudaria quando a tela
   * remontasse — quem deixa o app aberto durante a reunião continuaria vendo
   * ela como "próximo compromisso" mesmo depois de terminada.
   */
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), INTERVALO_RELOGIO_MS);
    return () => clearInterval(id);
  }, []);

  // Acompanha o relógio: com o app aberto desde cedo, "Bom dia" às 19h ficava.
  const saudacao = saudacaoDaHora(agora);
  const nome = primeiroNome(usuario?.nome) || primeiroNome(data?.irmao?.nome) || "irmão";

  const resumo = useMemo(() => {
    const brutos = data?.compromissos ?? [];

    /**
     * Reordena pelo instante de início. A lista do backend vem por DATA e
     * título — com a saída de campo das 08:45 e a reunião das 19:30 no mesmo
     * dia, "Leitura da Bíblia" aparecia antes da saída da manhã só por ordem
     * alfabética. Sem esta ordenação, o card de destaque e a primeira linha da
     * lista apontariam para compromissos diferentes na mesma tela.
     * Sem data vai para o fim, como no backend.
     */
    const porInstante = (a: Compromisso, b: Compromisso) =>
      (instanteDoCompromisso(a, config) ?? Number.POSITIVE_INFINITY) -
      (instanteDoCompromisso(b, config) ?? Number.POSITIVE_INFINITY);

    const todos = [...brutos].sort(porInstante);
    // O corte é por HORA, não por data: um compromisso de hoje que já aconteceu
    // sai daqui na mesma hora em que termina, sem esperar a virada do dia.
    const proximos = todos.filter((c) => aindaPorVir(c, agora, config, configPronta));

    const porTipo: Record<TipoCompromisso, number> = { designacao: 0, dirigente: 0, reuniao: 0 };
    for (const c of todos) {
      if (porTipo[c.tipo] !== undefined) porTipo[c.tipo] += 1;
    }

    /**
     * O primeiro que vem — e ele precisa ter data. Um compromisso sem data
     * nunca "passa", então promovê-lo ao destaque o deixaria fixo no topo para
     * sempre, ainda por cima com uma hora inventada. Ele continua na lista.
     */
    const proximo = proximos.find((c) => !!c.dataISO) ?? null;

    return {
      todos,
      proximos,
      porTipo,
      proximo,
      total: data?.totais?.total ?? todos.length,
      // Contagem local, não a do backend: a dele é por data e diria "1
      // compromisso pela frente" para a reunião que acabou de terminar.
      totalProximas: proximos.length,
    };
  }, [data, agora, config, configPronta]);

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
              {/* O que o irmão abre o app para saber. Vem antes do resumo de
                  propósito, e some quando não há nada pela frente. */}
              {resumo.proximo ? (
                <Animated.View entering={FadeInDown.duration(240)}>
                  <Text style={styles.secaoLabel}>Próximo compromisso</Text>
                  {(() => {
                    const c = resumo.proximo;
                    const tipo = TIPOS[c.tipo] ?? TIPOS.designacao;
                    const rascunho = c.origem?.status === "rascunho";
                    return (
                      <View style={[styles.proximo, { borderLeftColor: tipo.color }]}>
                        <View style={styles.proximoTopo}>
                          <View style={[styles.iconeBox, { backgroundColor: tipo.bg }]}>
                            <Ionicons name={tipo.icon} size={15} color={tipo.color} />
                          </View>
                          <Text style={[styles.proximoQuando, { color: tipo.color }]}>
                            {rotuloQuando(c, agora, config)}
                          </Text>
                          {rascunho ? (
                            <View style={[styles.tag, { backgroundColor: statusConfig.rascunho.bg }]}>
                              <Text style={[styles.tagTexto, { color: statusConfig.rascunho.color }]}>
                                Rascunho
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={styles.proximoTitulo} numberOfLines={2}>
                          {c.titulo}
                        </Text>

                        {c.papel ? (
                          <View style={[styles.tag, styles.proximoPapel, { backgroundColor: tipo.bg }]}>
                            <Text style={[styles.tagTexto, { color: tipo.color }]}>{c.papel}</Text>
                          </View>
                        ) : null}

                        <Text style={styles.proximoDetalhe} numberOfLines={2}>
                          {[tipo.label, c.detalhe, c.local].filter(Boolean).join(" · ")}
                        </Text>

                        {c.dataAproximada ? (
                          <Text style={styles.aproximada}>
                            Data aproximada — confira na programação
                          </Text>
                        ) : null}
                      </View>
                    );
                  })()}
                </Animated.View>
              ) : null}

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
                      ? 'Nada pela frente por enquanto. Toque em "Todas" para ver o histórico.'
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
                          style={[styles.card, { borderLeftColor: tipo.color }]}
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
    /**
     * O cartão de destaque. Mesma faixa de categoria à esquerda dos itens da
     * lista, mais grossa, para o topo da tela ler como "isto aqui é o que
     * importa agora" sem precisar de outra cor de fundo.
     */
    proximo: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderLeftWidth: 5,
      padding: 15,
      marginBottom: 18,
      ...shadow.card,
    },
    proximoTopo: { flexDirection: "row", alignItems: "center", gap: 9, flexWrap: "wrap" },
    proximoQuando: { fontSize: 13, fontWeight: "800", letterSpacing: 0.2 },
    proximoTitulo: {
      fontSize: 19,
      fontWeight: "700",
      color: colors.text,
      marginTop: 10,
      letterSpacing: -0.3,
    },
    proximoPapel: { alignSelf: "flex-start", marginTop: 7, paddingVertical: 3, paddingHorizontal: 9 },
    proximoDetalhe: { fontSize: 13, color: colors.textSecondary, marginTop: 7, lineHeight: 18 },
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

    /**
     * Sem contorno em volta: um traço claro fechando cada item virava uma grade
     * de linhas brilhantes no tema escuro, e mesmo com a cor certa um retângulo
     * por compromisso deixa a lista pesada. A separação do fundo fica por conta
     * da superfície mais clara (mais a sombra suave, que só aparece no claro).
     *
     * No lugar do contorno, uma faixa à esquerda na cor da CATEGORIA: a borda
     * deixa de ser enfeite e passa a dizer, de relance, se a linha é quadro,
     * saída de campo ou reunião. Repetir a cor do ícone é de propósito —
     * informação redundante é o que faz a lista funcionar para quem é daltônico.
     */
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderLeftWidth: 3,
      padding: 12,
      marginBottom: 8,
      ...shadow.card,
    },
    dataBox: {
      width: 42,
      alignItems: "center",
      borderRightWidth: 1,
      borderRightColor: colors.border,
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
