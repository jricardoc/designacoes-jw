import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ApiError } from "@/api/client";
import { useApagarHoras, useCronometro, useDefinirMeta, usePainelPioneiro } from "@/api/hooks/usePioneiro";
import type { RegistroHoras } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { useBarraFlutuante } from "@/components/layout/contextoRolagem";
import { Contador, diaCurto, duracao, doisDig, quando } from "@/components/ministerio/escolhas";
import { HorasSheet } from "@/components/ministerio/HorasSheet";
import { RelatorioPioneiroSheet } from "@/components/ministerio/RelatorioPioneiroSheet";
import { Button, EmptyState, GradientHeader, Loading, Sheet, useToast } from "@/components/ui";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { nomeMes, somarMeses } from "@/utils/assistenciaMensal";
import { usePuxar } from "@/utils/usePuxar";

const mesAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}`;
};
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** 5025 s -> "1:23:45" */
const relogio = (s: number) => `${Math.floor(s / 3600)}:${doisDig(Math.floor((s % 3600) / 60))}:${doisDig(s % 60)}`;

/**
 * O ministério do pioneiro: cronômetro, horas do mês contra a meta, o ano de serviço,
 * revisitas e estudos e o relatório que vai direto para o grupo. Tudo no servidor.
 */
export default function MinisterioScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const { rolagem, recuo } = useBarraFlutuante();
  const toast = useToast();
  const { feito } = useCelebracao();
  const atual = mesAtual();
  const [mes, setMes] = useState(atual);
  const { data: p, isLoading, error, refetch } = usePainelPioneiro(mes);
  const cronometro = useCronometro();
  const apagar = useApagarHoras();
  const definirMeta = useDefinirMeta();
  const puxar = usePuxar(refetch);
  const [horasAberto, setHorasAberto] = useState(false);
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [metaAberta, setMetaAberta] = useState(false);
  const [novaMeta, setNovaMeta] = useState(50);
  const [agora, setAgora] = useState(() => Date.now());

  const rodando = !!p?.cronometro.rodando;
  // O relógio anda na tela de segundo em segundo; quem guarda o tempo é o servidor.
  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [rodando]);

  if (isLoading && !p) return <Loading label="Carregando..." />;
  if (!p) {
    const negado = error instanceof ApiError && error.status === 403;
    return (
      <View style={styles.tela}>
        <GradientHeader title="Ministério" description="Horas, estudos e revisitas" icon="timer" />
        <EmptyState
          icon={negado ? "lock-closed-outline" : "cloud-offline-outline"}
          title={negado ? "Área dos pioneiros regulares" : "Não deu para carregar"}
          message={negado ? error.message : "Puxe para tentar de novo."}
        />
      </View>
    );
  }

  const segundos =
    p.cronometro.acumuladoSeg +
    (p.cronometro.rodando && p.cronometro.inicio ? Math.max(0, Math.floor((agora - new Date(p.cronometro.inicio).getTime()) / 1000)) : 0);
  const emAndamento = p.cronometro.rodando || p.cronometro.acumuladoSeg > 0;
  const metaMin = p.meta * 60;
  const fracao = Math.min(1, metaMin ? p.minutosMes / metaMin : 0);
  const fracaoAno = Math.min(1, p.metaAno ? p.minutosAno / (p.metaAno * 60) : 0);
  const maiorMes = Math.max(metaMin, ...p.porMes.map((m) => m.minutos));
  const mesCurto = p.nomeMes.split(" de ")[0];

  const acao = (a: "iniciar" | "pausar" | "parar" | "descartar") =>
    cronometro.mutate(a, {
      onSuccess: (r) => {
        if (a === "parar" && r.registro) feito({ titulo: "Horas lançadas", detalhe: `${duracao(r.registro.minutos)} de hoje`, icone: "time" });
        if (a === "iniciar") setAgora(Date.now());
      },
      onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu", "error"),
    });

  const parar = () => {
    const minutos = Math.round(segundos / 60);
    if (minutos < 1) {
      acao("descartar");
      toast.show("Menos de 1 minuto: não lançado");
      return;
    }
    Alert.alert("Parar o cronômetro?", `Lança ${duracao(minutos)} hoje.`, [
      { text: "Continuar", style: "cancel" },
      { text: "Descartar", style: "destructive", onPress: () => acao("descartar") },
      { text: "Lançar", onPress: () => acao("parar") },
    ]);
  };

  const apagarRegistro = (r: RegistroHoras) =>
    Alert.alert("Apagar estas horas?", `${duracao(r.minutos)} de ${diaCurto(r.data)}`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: () => apagar.mutate(r.id, { onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu", "error") }),
      },
    ]);

  return (
    <View style={styles.tela}>
      <GradientHeader title="Ministério" description="Horas, estudos e revisitas" icon="timer" />
      <ScrollView {...rolagem} contentContainerStyle={[styles.scroll, recuo]} refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}>
        <View style={styles.meses}>
          <Pressable style={styles.seta} onPress={() => setMes(somarMeses(mes, -1))} hitSlop={8} accessibilityLabel="Mês anterior">
            <Ionicons name="chevron-back" size={20} color={colors.primaryDark} />
          </Pressable>
          <Text style={styles.mesNome}>{maiuscula(nomeMes(mes))}</Text>
          <Pressable
            style={[styles.seta, mes >= atual && { opacity: 0.3 }]}
            onPress={() => setMes(somarMeses(mes, 1))}
            disabled={mes >= atual}
            hitSlop={8}
            accessibilityLabel="Próximo mês"
          >
            <Ionicons name="chevron-forward" size={20} color={colors.primaryDark} />
          </Pressable>
        </View>

        {mes === atual ? (
          <Animated.View entering={FadeInDown.duration(220)} style={[styles.cartao, p.cronometro.rodando && styles.cartaoRodando]}>
            <Text style={styles.relogio} accessibilityLabel={`Cronômetro: ${duracao(Math.floor(segundos / 60))}`}>
              {relogio(segundos)}
            </Text>
            <Text style={styles.estado}>
              {p.cronometro.rodando ? "Contando" : p.cronometro.acumuladoSeg ? "Pausado" : "Toque para começar a contar o tempo de hoje"}
            </Text>
            <View style={styles.botoes}>
              {p.cronometro.rodando ? (
                <Button label="Pausar" icon="pause" variant="secondary" onPress={() => acao("pausar")} loading={cronometro.isPending} style={styles.flex} />
              ) : (
                <Button label={emAndamento ? "Continuar" : "Iniciar"} icon="play" onPress={() => acao("iniciar")} loading={cronometro.isPending} style={styles.flex} />
              )}
              {emAndamento ? <Button label="Parar" icon="stop" variant="secondary" onPress={parar} style={styles.flex} /> : null}
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.duration(220).delay(40)} style={styles.cartao}>
          <View style={styles.topo}>
            <Text style={styles.total}>{duracao(p.minutosMes)}</Text>
            <Pressable
              onPress={() => {
                setNovaMeta(p.meta);
                setMetaAberta(true);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Mudar a meta"
            >
              <Text style={styles.meta}>meta {p.meta} h ✎</Text>
            </Pressable>
          </View>
          <View style={styles.trilho}>
            <View style={[styles.preenchido, { width: `${Math.round(fracao * 100)}%`, backgroundColor: fracao >= 1 ? colors.greenDark : colors.oliveSoft }]} />
          </View>
          <Text style={styles.legenda}>
            {fracao >= 1 ? `Meta de ${mesCurto} alcançada` : `Faltam ${duracao(metaMin - p.minutosMes)} para a meta de ${mesCurto}`}
          </Text>
          <View style={styles.separador} />
          <Text style={styles.subtitulo}>
            Ano de serviço: {duracao(p.minutosAno)} de {p.metaAno} h
          </Text>
          <View style={styles.trilho}>
            <View style={[styles.preenchido, { width: `${Math.round(fracaoAno * 100)}%`, backgroundColor: colors.primary }]} />
          </View>
          <View style={styles.grafico}>
            {p.porMes.map((m) => (
              <Pressable
                key={m.mes}
                style={[styles.coluna, m.mes > atual && { opacity: 0.35 }]}
                onPress={() => m.mes <= atual && setMes(m.mes)}
                accessibilityLabel={`${nomeMes(m.mes)}: ${duracao(m.minutos)}`}
              >
                <View style={[styles.barra, { height: m.minutos ? 4 + Math.round((m.minutos / maiorMes) * 56) : 2, backgroundColor: m.minutos >= metaMin ? colors.greenDark : m.minutos ? colors.oliveSoft : colors.border }]} />
                <Text style={[styles.colunaRotulo, m.mes === mes && styles.colunaAtiva]}>{nomeMes(m.mes, true).slice(0, 1).toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <View style={styles.botoes}>
          <Button label="Lançar horas" icon="add" variant="secondary" onPress={() => setHorasAberto(true)} style={styles.flex} />
          <Button label={`Revisitas (${p.revisitas})`} icon="people-outline" variant="secondary" onPress={() => router.push("/ministerio/revisitas")} style={styles.flex} />
        </View>

        {p.proximas.length ? (
          <View style={styles.bloco}>
            <Text style={styles.blocoTitulo}>Próximas visitas</Text>
            {p.proximas.map((r) => (
              <Pressable key={r.id} style={styles.linha} onPress={() => router.push({ pathname: "/ministerio/revisita", params: { id: String(r.id) } })} accessibilityRole="button">
                <Ionicons name={r.estudo ? "book-outline" : "person-outline"} size={18} color={colors.primaryDark} />
                <View style={styles.flex}>
                  <Text style={styles.linhaTitulo}>{r.nome}</Text>
                  <Text style={styles.linhaDetalhe}>{[r.proximaVisita ? quando(r.proximaVisita) : null, r.endereco].filter(Boolean).join(" · ")}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.bloco}>
          <Text style={styles.blocoTitulo}>Relatório de {mesCurto}</Text>
          {p.relatorio ? (
            <Text style={styles.enviado}>
              Enviado: {p.relatorio.horas ?? 0} h · {p.relatorio.estudos} {p.relatorio.estudos === 1 ? "estudo" : "estudos"}
            </Text>
          ) : (
            <Text style={styles.linhaDetalhe}>
              {duracao(p.minutosMes)} lançadas e {p.estudos} {p.estudos === 1 ? "estudo" : "estudos"}. O relatório vai direto para o seu grupo.
            </Text>
          )}
          <Button
            label={p.relatorio ? "Mandar de novo" : "Enviar relatório"}
            icon="paper-plane-outline"
            variant={p.relatorio ? "secondary" : "primary"}
            onPress={() => setRelatorioAberto(true)}
            fullWidth
          />
        </View>

        <View style={styles.bloco}>
          <Text style={styles.blocoTitulo}>Horas de {mesCurto}</Text>
          {p.registros.length === 0 ? (
            <Text style={styles.linhaDetalhe}>Nada lançado ainda.</Text>
          ) : (
            p.registros.map((r) => (
              <View key={r.id} style={styles.linha}>
                <Ionicons name={r.origem === "cronometro" ? "timer-outline" : "create-outline"} size={18} color={colors.textSecondary} />
                <View style={styles.flex}>
                  <Text style={styles.linhaTitulo}>{duracao(r.minutos)}</Text>
                  <Text style={styles.linhaDetalhe}>{[diaCurto(r.data), r.observacao].filter(Boolean).join(" · ")}</Text>
                </View>
                <Pressable onPress={() => apagarRegistro(r)} hitSlop={8} accessibilityLabel="Apagar">
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <HorasSheet visible={horasAberto} onClose={() => setHorasAberto(false)} />
      <RelatorioPioneiroSheet painel={p} visible={relatorioAberto} onClose={() => setRelatorioAberto(false)} />
      <Sheet visible={metaAberta} onClose={() => setMetaAberta(false)}>
        <View style={styles.metaFolha}>
          <Text style={styles.blocoTitulo}>Meta de horas por mês</Text>
          <Text style={styles.linhaDetalhe}>O ano de serviço usa 12 vezes esta meta.</Text>
          <View style={styles.centro}>
            <Contador valor={novaMeta} onMudar={setNovaMeta} min={5} max={200} passo={5} rotulo="horas por mês" />
          </View>
          <Button
            label={`Salvar ${novaMeta} h por mês`}
            onPress={() =>
              definirMeta.mutate(novaMeta, {
                onSuccess: () => {
                  setMetaAberta(false);
                  toast.show("Meta atualizada");
                },
                onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu", "error"),
              })
            }
            loading={definirMeta.isPending}
            fullWidth
          />
        </View>
      </Sheet>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, gap: 12 },
    flex: { flex: 1 },
    centro: { alignItems: "center" },
    meses: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    seta: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mesNome: { fontSize: 20, fontWeight: "800", color: colors.text },
    cartao: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.card,
    },
    cartaoRodando: { borderColor: colors.oliveSoft },
    relogio: { fontSize: 46, fontWeight: "900", color: colors.text, textAlign: "center", fontVariant: ["tabular-nums"] },
    estado: { fontSize: 13.5, color: colors.textSecondary, textAlign: "center", marginTop: -6 },
    botoes: { flexDirection: "row", gap: 10 },
    topo: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    total: { fontSize: 34, fontWeight: "900", color: colors.text },
    meta: { fontSize: 14, fontWeight: "800", color: colors.primaryDark },
    trilho: { height: 8, borderRadius: radius.pill, backgroundColor: colors.border, overflow: "hidden" },
    preenchido: { height: 8, borderRadius: radius.pill },
    legenda: { fontSize: 13, color: colors.textSecondary },
    separador: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
    subtitulo: { fontSize: 14, fontWeight: "800", color: colors.text },
    grafico: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 78, marginTop: 4 },
    coluna: { flex: 1, alignItems: "center", gap: 4 },
    barra: { width: 10, borderRadius: 5 },
    colunaRotulo: { fontSize: 10.5, color: colors.textMuted },
    colunaAtiva: { color: colors.text, fontWeight: "900" },
    bloco: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border },
    blocoTitulo: { fontSize: 16, fontWeight: "800", color: colors.text },
    linha: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
    linhaTitulo: { fontSize: 15, fontWeight: "700", color: colors.text },
    linhaDetalhe: { fontSize: 13, color: colors.textSecondary },
    enviado: { fontSize: 14, fontWeight: "800", color: colors.greenDark },
    metaFolha: { gap: 14, paddingBottom: 8 },
  });
