import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCarrinho } from "@/api/hooks/useCarrinho";
import type {
  CarrinhoPonto,
  CarrinhoPublicador,
  CarrinhoTurno,
} from "@/api/types";
import { PontoSheet } from "@/components/carrinho/PontoSheet";
import { PublicadorSheet } from "@/components/carrinho/PublicadorSheet";
import { TurnoSheet } from "@/components/carrinho/TurnoSheet";
import {
  Button,
  Card,
  EmptyState,
  GradientHeader,
  Loading,
} from "@/components/ui";
import { DIAS_CURTOS, radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/** O turno não carrega o ponto dono, mas a leitura por dia mistura todos os pontos. */
type TurnoDoDia = { turno: CarrinhoTurno; ponto: CarrinhoPonto };

export default function CarrinhoScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const { data, isLoading, isError, refetch, isRefetching } = useCarrinho();

  const [dia, setDia] = useState(() => new Date().getDay());
  const [pontoSheet, setPontoSheet] = useState<{
    open: boolean;
    ponto: CarrinhoPonto | null;
  }>({ open: false, ponto: null });
  const [turnoSheet, setTurnoSheet] = useState<{
    open: boolean;
    turno: CarrinhoTurno | null;
    ponto: CarrinhoPonto | null;
  }>({ open: false, turno: null, ponto: null });
  const [pessoaSheet, setPessoaSheet] = useState<{
    open: boolean;
    publicador: CarrinhoPublicador | null;
  }>({ open: false, publicador: null });

  const pontos = useMemo(() => data?.pontos ?? [], [data]);
  const publicadores = useMemo(() => data?.publicadores ?? [], [data]);

  const totais = useMemo(() => {
    const ativas = publicadores.filter((p) => p.ativo);
    return {
      pontosAtivos: pontos.filter((p) => p.ativo).length,
      turnos: pontos.reduce((soma, p) => soma + p.turnos.length, 0),
      pessoas: ativas.length,
      semTelefone: ativas.filter((p) => !p.telefone).length,
    };
  }, [pontos, publicadores]);

  const kpis = useMemo(
    () => [
      {
        label: "Pontos ativos",
        value: totais.pontosAtivos,
        icon: "location" as const,
        color: colors.terracotta,
      },
      {
        label: "Turnos",
        value: totais.turnos,
        icon: "time" as const,
        color: colors.orange,
      },
      {
        label: "Pessoas",
        value: totais.pessoas,
        icon: "people" as const,
        color: colors.green,
      },
      {
        label: "Sem telefone",
        value: totais.semTelefone,
        icon: "call" as const,
        color: colors.red,
      },
    ],
    [totais, colors],
  );

  const turnosPorDia = useMemo(() => {
    const contagem = new Array(7).fill(0) as number[];
    pontos.forEach((p) =>
      p.turnos.forEach((t) => {
        contagem[t.diaSemana] += 1;
      }),
    );
    return contagem;
  }, [pontos]);

  const turnosDoDia = useMemo(() => {
    const lista: TurnoDoDia[] = [];
    pontos.forEach((ponto) =>
      ponto.turnos.forEach((turno) => {
        if (turno.diaSemana === dia) lista.push({ turno, ponto });
      }),
    );
    return lista.sort(
      (a, b) =>
        a.turno.horaInicio.localeCompare(b.turno.horaInicio) ||
        a.ponto.nome.localeCompare(b.ponto.nome),
    );
  }, [pontos, dia]);

  const nomeDoDia = data?.dias?.[dia] ?? "";
  const semPontos = pontos.length === 0;

  const novoTurno = () =>
    setTurnoSheet({ open: true, turno: null, ponto: null });

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Carrinho"
        description="Turnos fixos semanais por ponto de testemunho público."
        icon="book"
        colorsGradient={[colors.green, colors.greenDark]}
      />

      {isLoading ? (
        <Loading label="Carregando o carrinho..." />
      ) : isError ? (
        <View style={styles.erroWrap}>
          <EmptyState
            icon="cloud-offline"
            title="Não foi possível carregar o carrinho"
            message="Verifique a conexão e tente novamente."
          >
            <Button label="Tentar de novo" onPress={() => refetch()} />
          </EmptyState>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.kpiRow}>
            {kpis.map((k) => (
              <Card key={k.label} style={styles.kpiCard}>
                <View
                  style={[styles.kpiIcon, { backgroundColor: k.color + "1a" }]}
                >
                  <Ionicons name={k.icon} size={20} color={k.color} />
                </View>
                <Text style={styles.kpiValue}>
                  {String(k.value).padStart(2, "0")}
                </Text>
                <Text style={styles.kpiLabel}>{k.label}</Text>
              </Card>
            ))}
          </View>

          {totais.semTelefone > 0 ? (
            <View style={styles.aviso}>
              <Ionicons name="warning" size={18} color={colors.red} />
              <Text style={styles.avisoTexto}>
                <Text style={styles.avisoForte}>{totais.semTelefone}</Text>{" "}
                pessoa(s) ainda sem telefone. O lembrete automático de WhatsApp
                só alcança quem tiver o número cadastrado.
              </Text>
            </View>
          ) : null}

          <View style={styles.diasRow}>
            {DIAS_CURTOS.map((sigla, i) => {
              const ativo = i === dia;
              return (
                <Pressable
                  key={sigla}
                  onPress={() => setDia(i)}
                  style={[styles.diaChip, ativo && styles.diaChipAtivo]}
                >
                  <Text
                    style={[styles.diaSigla, ativo && styles.diaTextoAtivo]}
                  >
                    {sigla}
                  </Text>
                  <Text
                    style={[styles.diaContagem, ativo && styles.diaTextoAtivo]}
                  >
                    {turnosPorDia[i]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.secao}>
            <View style={styles.secaoTopo}>
              <View style={styles.flex}>
                <Text style={styles.secaoTitulo}>Turnos</Text>
                <Text style={styles.secaoSub}>{nomeDoDia}</Text>
              </View>
              <Button
                label="Turno"
                icon="add"
                onPress={novoTurno}
                disabled={semPontos}
              />
            </View>

            {turnosDoDia.length > 0 ? (
              <View style={styles.lista}>
                {turnosDoDia.map(({ turno, ponto }) => (
                  <Card
                    key={turno.id}
                    accentColor={ponto.cor}
                    style={[styles.turnoCard, !ponto.ativo && styles.esmaecido]}
                    onPress={() =>
                      setTurnoSheet({ open: true, turno, ponto })
                    }
                  >
                    <View style={styles.turnoTopo}>
                      <View style={styles.turnoPonto}>
                        <View
                          style={[styles.bolinha, { backgroundColor: ponto.cor }]}
                        />
                        <Text style={styles.turnoPontoNome} numberOfLines={1}>
                          {ponto.nome}
                        </Text>
                        {!ponto.ativo ? (
                          <Text style={styles.tag}>ponto inativo</Text>
                        ) : null}
                      </View>
                      <Text style={styles.turnoHora}>
                        {turno.horaInicio} - {turno.horaFim}
                      </Text>
                    </View>

                    <View style={styles.pessoasChips}>
                      {turno.publicadores.length === 0 ? (
                        <Text style={styles.definir}>definir</Text>
                      ) : (
                        turno.publicadores.map((p) => (
                          <View
                            key={p.id}
                            style={[
                              styles.pessoaChip,
                              !p.ativo && styles.pessoaChipInativa,
                            ]}
                          >
                            <Text
                              style={[
                                styles.pessoaChipTexto,
                                !p.ativo && styles.pessoaChipTextoInativa,
                              ]}
                            >
                              {p.nome}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  </Card>
                ))}
              </View>
            ) : (
              <EmptyState
                icon="calendar-outline"
                title="Nenhum turno nesse dia"
                message={
                  semPontos
                    ? "Cadastre um ponto antes de montar a escala."
                    : undefined
                }
              >
                {semPontos ? null : (
                  <Button label="Adicionar turno" onPress={novoTurno} />
                )}
              </EmptyState>
            )}
          </View>

          <View style={styles.secao}>
            <View style={styles.secaoTopo}>
              <View style={styles.flex}>
                <Text style={styles.secaoTitulo}>Pontos</Text>
                <Text style={styles.secaoSub}>
                  {pontos.length} cadastrado(s)
                </Text>
              </View>
              <Button
                label="Ponto"
                icon="add"
                variant="secondary"
                onPress={() => setPontoSheet({ open: true, ponto: null })}
              />
            </View>

            {semPontos ? (
              <EmptyState
                icon="location-outline"
                title="Nenhum ponto cadastrado"
                message="Crie o primeiro ponto para montar a grade de turnos."
              >
                <Button
                  label="Criar Primeiro Ponto"
                  onPress={() => setPontoSheet({ open: true, ponto: null })}
                />
              </EmptyState>
            ) : (
              <View style={styles.listaCard}>
                {pontos.map((ponto, i) => (
                  <Pressable
                    key={ponto.id}
                    onPress={() => setPontoSheet({ open: true, ponto })}
                    style={[
                      styles.linha,
                      i > 0 && styles.linhaDivisor,
                      !ponto.ativo && styles.esmaecido,
                    ]}
                  >
                    <View
                      style={[styles.bolinha, { backgroundColor: ponto.cor }]}
                    />
                    <View style={styles.flex}>
                      <Text style={styles.linhaNome} numberOfLines={1}>
                        {ponto.nome}
                      </Text>
                      <Text style={styles.linhaSub}>
                        {ponto.turnos.length}{" "}
                        {ponto.turnos.length === 1 ? "turno" : "turnos"}
                      </Text>
                    </View>
                    {!ponto.ativo ? (
                      <Text style={styles.tag}>inativo</Text>
                    ) : null}
                    <Ionicons
                      name="create-outline"
                      size={17}
                      color={colors.textMuted}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.secao}>
            <View style={styles.secaoTopo}>
              <View style={styles.flex}>
                <Text style={styles.secaoTitulo}>Pessoas do carrinho</Text>
                <Text style={styles.secaoSub}>
                  {publicadores.length} cadastrada(s)
                </Text>
              </View>
              <Button
                label="Pessoa"
                icon="add"
                variant="secondary"
                onPress={() => setPessoaSheet({ open: true, publicador: null })}
              />
            </View>

            {publicadores.length > 0 ? (
              <View style={styles.listaCard}>
                {publicadores.map((p, i) => (
                  <Pressable
                    key={p.id}
                    onPress={() =>
                      setPessoaSheet({ open: true, publicador: p })
                    }
                    style={[
                      styles.linha,
                      i > 0 && styles.linhaDivisor,
                      !p.ativo && styles.esmaecido,
                    ]}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.linhaNome} numberOfLines={1}>
                        {p.nome}
                      </Text>
                      <View style={styles.telefoneLinha}>
                        <Ionicons
                          name={p.telefone ? "call" : "call-outline"}
                          size={12}
                          color={p.telefone ? colors.textSecondary : colors.red}
                        />
                        <Text
                          style={[
                            styles.linhaSub,
                            !p.telefone && styles.semTelefone,
                          ]}
                        >
                          {p.telefone ?? "sem telefone"}
                        </Text>
                      </View>
                    </View>
                    {!p.ativo ? <Text style={styles.tag}>inativa</Text> : null}
                    <Ionicons
                      name="create-outline"
                      size={17}
                      color={colors.textMuted}
                    />
                  </Pressable>
                ))}
              </View>
            ) : (
              <EmptyState
                icon="people-outline"
                title="Nenhuma pessoa cadastrada"
                message="Cadastre quem serve no carrinho para montar os turnos."
              >
                <Button
                  label="Cadastrar Pessoa"
                  onPress={() =>
                    setPessoaSheet({ open: true, publicador: null })
                  }
                />
              </EmptyState>
            )}
          </View>
        </ScrollView>
      )}

      <PontoSheet
        visible={pontoSheet.open}
        ponto={pontoSheet.ponto}
        onClose={() => setPontoSheet({ open: false, ponto: null })}
      />
      <TurnoSheet
        visible={turnoSheet.open}
        turno={turnoSheet.turno}
        ponto={turnoSheet.ponto}
        pontos={pontos}
        publicadores={publicadores}
        diaInicial={dia}
        onClose={() => setTurnoSheet({ open: false, turno: null, ponto: null })}
      />
      <PublicadorSheet
        visible={pessoaSheet.open}
        publicador={pessoaSheet.publicador}
        pontos={pontos}
        onClose={() => setPessoaSheet({ open: false, publicador: null })}
      />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  erroWrap: { padding: 16 },
  scroll: { padding: 16, paddingBottom: 40, gap: 16 },

  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: {
    flexGrow: 1,
    flexBasis: "45%",
    alignItems: "center",
    paddingVertical: 16,
  },
  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiValue: { fontSize: 22, fontWeight: "800", color: colors.text },
  kpiLabel: { fontSize: 11, color: colors.textSecondary, textAlign: "center" },

  aviso: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: 14,
  },
  avisoTexto: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  avisoForte: { fontWeight: "800", color: colors.red },

  diasRow: { flexDirection: "row", gap: 6 },
  diaChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    gap: 2,
  },
  diaChipAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  diaSigla: { fontSize: 12.5, fontWeight: "700", color: colors.textSecondary },
  diaContagem: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
  diaTextoAtivo: { color: colors.textOnPrimary },

  secao: { gap: 12 },
  secaoTopo: { flexDirection: "row", alignItems: "center", gap: 12 },
  secaoTitulo: { fontSize: 18, fontWeight: "700", color: colors.text },
  secaoSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  lista: { gap: 12 },

  turnoCard: { gap: 10 },
  turnoTopo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  turnoPonto: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexShrink: 1,
  },
  turnoPontoNome: {
    fontSize: 14.5,
    fontWeight: "700",
    color: colors.text,
    flexShrink: 1,
  },
  turnoHora: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  pessoasChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pessoaChip: {
    backgroundColor: colors.infoBg,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pessoaChipInativa: { backgroundColor: colors.surfaceMuted, opacity: 0.7 },
  pessoaChipTexto: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.primaryDark,
  },
  pessoaChipTextoInativa: { color: colors.textMuted, fontWeight: "500" },
  definir: { fontSize: 13, fontStyle: "italic", color: colors.textMuted },

  listaCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadow.card,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  linhaDivisor: { borderTopWidth: 1, borderTopColor: colors.border },
  linhaNome: { fontSize: 14.5, fontWeight: "600", color: colors.text },
  linhaSub: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  telefoneLinha: { flexDirection: "row", alignItems: "center", gap: 5 },
  semTelefone: { color: colors.red },
  bolinha: { width: 12, height: 12, borderRadius: radius.pill },
  tag: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.textMuted,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  esmaecido: { opacity: 0.62 },
  });
