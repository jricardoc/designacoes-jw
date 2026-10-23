import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ApiError } from "@/api/client";
import { useCronometro, usePainelPioneiro } from "@/api/hooks/usePioneiro";
import type { TipoVisita } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { doisDig, duracao, quando } from "@/components/ministerio/escolhas";
import {
  Anel,
  BotaoPilula,
  CabecalhoMinisterio,
  dataLonga,
  horaDe,
  mesAtual,
  Pilula,
  quandoRelativo,
  saudacao,
  Secao,
  TIPO_VISITA,
  TituloTela,
  useRecuo,
  Vidro,
} from "@/components/ministerio/kit";
import { RelatorioPioneiroSheet } from "@/components/ministerio/RelatorioPioneiroSheet";
import { VisitaSheet } from "@/components/ministerio/VisitaSheet";
import { Button, EmptyState, Loading, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { usePuxar } from "@/utils/usePuxar";

/** 5025 s -> "1:23:45" */
const relogio = (s: number) => `${Math.floor(s / 3600)}:${doisDig(Math.floor((s % 3600) / 60))}:${doisDig(s % 60)}`;
/** 1950 min -> "32,5" (o centro do anel) */
const horasDecimais = (min: number) => String(Math.floor(min / 6) / 10).replace(".", ",");

const entrada = (i: number) => FadeInDown.delay(i * 70).duration(420);

/** O Início do Ministério: o dia do pioneiro — cronômetro, a meta, as conversas de hoje e o que vem a seguir. */
export default function InicioMinisterio() {
  const { colors, styles } = useTema(criarEstilos);
  const recuo = useRecuo();
  const toast = useToast();
  const { feito } = useCelebracao();
  const { data: p, isLoading, error, refetch } = usePainelPioneiro(mesAtual());
  const cronometro = useCronometro();
  const puxar = usePuxar(refetch);
  const [agora, setAgora] = useState(() => Date.now());
  const [visita, setVisita] = useState<{ id: number; nome: string; tipo: TipoVisita } | null>(null);
  const [relatorioAberto, setRelatorioAberto] = useState(false);

  const rodando = !!p?.cronometro.rodando;
  // O relógio anda na tela de segundo em segundo; quem guarda o tempo é o servidor.
  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [rodando]);

  if (isLoading && !p) {
    return (
      <View style={styles.tela}>
        <CabecalhoMinisterio />
        <Loading label="Carregando..." />
      </View>
    );
  }
  if (!p) {
    const negado = error instanceof ApiError && error.status === 403;
    return (
      <View style={styles.tela}>
        <CabecalhoMinisterio />
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
  const fracao = metaMin ? p.minutosMes / metaMin : 0;
  const mesCurto = p.nomeMes.split(" de ")[0];
  const conversas = p.conversasHoje;

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

  const abrirContato = (id: number) => router.push({ pathname: "/ministerio/contato", params: { id: String(id) } });

  return (
    <View style={styles.tela}>
      <CabecalhoMinisterio />
      <ScrollView contentContainerStyle={[styles.scroll, recuo]} refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}>
        <TituloTela titulo={`${saudacao()}, ${p.nome}`} subtitulo={dataLonga(new Date())} />

        <Animated.View entering={entrada(0)}>
          <Vidro style={styles.hero}>
            <Anel tamanho={214} fracao={fracao} pulsando={p.cronometro.rodando}>
              {emAndamento ? (
                <>
                  <Text style={styles.relogio} accessibilityLabel={`Cronômetro: ${duracao(Math.floor(segundos / 60))}`}>
                    {relogio(segundos)}
                  </Text>
                  <Text style={styles.anelLegenda}>{p.cronometro.rodando ? "contando" : "pausado"}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.anelValor}>
                    {horasDecimais(p.minutosMes)}
                    <Text style={styles.anelUnidade}> h</Text>
                  </Text>
                  <Text style={styles.anelLegenda}>
                    de {p.meta} h em {mesCurto}
                  </Text>
                </>
              )}
            </Anel>
            <Text style={styles.heroTexto}>
              {fracao >= 1 ? `Meta de ${mesCurto} alcançada` : `Faltam ${duracao(metaMin - p.minutosMes)} para a meta de ${mesCurto}`}
            </Text>
            <View style={styles.botoes}>
              {p.cronometro.rodando ? (
                <Button label="Pausar" icon="pause" variant="secondary" onPress={() => acao("pausar")} loading={cronometro.isPending} style={styles.flex} />
              ) : (
                <Button label={emAndamento ? "Continuar" : "Iniciar"} icon="play" onPress={() => acao("iniciar")} loading={cronometro.isPending} style={styles.flex} />
              )}
              {emAndamento ? <Button label="Parar" icon="stop" variant="secondary" onPress={parar} style={styles.flex} /> : null}
            </View>
          </Vidro>
        </Animated.View>

        <Animated.View entering={entrada(1)} style={styles.bloco}>
          <Secao titulo="Conversas de hoje" acao="Agenda" onAcao={() => router.replace("/ministerio/agenda")} />
          <Vidro style={styles.cartao}>
            {conversas.total ? (
              <>
                <View style={styles.contagem}>
                  <Text style={styles.contagemTexto}>
                    {conversas.feitas} de {conversas.total} concluídos
                  </Text>
                  <View style={styles.trilho}>
                    <View style={[styles.cheio, { width: `${Math.round((conversas.feitas / conversas.total) * 100)}%` }]} />
                  </View>
                </View>
                {conversas.itens.map((c) => {
                  const feita = c.feita ? TIPO_VISITA[c.feita] : null;
                  return (
                    <Pressable key={c.id} onPress={() => abrirContato(c.id)} style={({ pressed }) => [styles.conversa, pressed && styles.pressionado]} accessibilityRole="button">
                      <View style={styles.conversaLinha}>
                        <View style={[styles.avatar, { backgroundColor: c.estudo ? colors.infoBg : colors.sand }]}>
                          <Ionicons name={c.estudo ? "book" : "person"} size={18} color={c.estudo ? colors.purple : colors.primaryDark} />
                        </View>
                        <View style={styles.flex}>
                          <Text style={[styles.nome, feita && styles.nomeFeito]} numberOfLines={1}>
                            {c.nome}
                          </Text>
                          <Text style={styles.detalhe} numberOfLines={1}>
                            {/* Feita, a "próxima" já é a remarcada (outro dia): a hora não é de hoje. */}
                            {[!feita && c.proximaVisita ? horaDe(c.proximaVisita) : null, c.endereco].filter(Boolean).join(" · ") || "Sem endereço"}
                          </Text>
                        </View>
                        {feita ? (
                          <View style={[styles.feita, { backgroundColor: `${feita.cor(colors)}1F` }]}>
                            <Ionicons name="checkmark-circle" size={14} color={feita.cor(colors)} />
                            <Text style={[styles.feitaTexto, { color: feita.cor(colors) }]}>{feita.rotulo}</Text>
                          </View>
                        ) : null}
                      </View>
                      {!feita ? (
                        <View style={styles.acoes}>
                          <BotaoPilula rotulo="Conversei" icone="chatbubbles" onPress={() => setVisita({ id: c.id, nome: c.nome, tipo: c.estudo ? "estudo" : "conversa" })} />
                          <BotaoPilula rotulo="Não em casa" icone="home-outline" tom="neutro" onPress={() => setVisita({ id: c.id, nome: c.nome, tipo: "nao_em_casa" })} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </>
            ) : (
              <View style={styles.vazio}>
                <Ionicons name="sunny-outline" size={26} color={colors.primary} />
                <Text style={styles.vazioTexto}>Nenhuma visita marcada para hoje. Toque no + para anotar um contato ou planejar uma saída.</Text>
              </View>
            )}
          </Vidro>
        </Animated.View>

        {p.aSeguir.length ? (
          <Animated.View entering={entrada(2)} style={styles.bloco}>
            <Secao titulo="A seguir" acao="Contatos" onAcao={() => router.replace("/ministerio/contatos")} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fileira}>
              {p.aSeguir.map((r) => (
                <Pressable key={r.id} onPress={() => abrirContato(r.id)} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressionado}>
                  <Vidro style={styles.proxima}>
                    <Pilula situacao={r.situacao} texto={r.proximaVisita ? quandoRelativo(r.proximaVisita) : undefined} />
                    <Text style={styles.nome} numberOfLines={1}>
                      {r.nome}
                    </Text>
                    <Text style={styles.detalhe} numberOfLines={1}>
                      {r.proximaVisita ? quando(r.proximaVisita) : ""}
                    </Text>
                    {r.endereco ? (
                      <Text style={styles.detalhe} numberOfLines={1}>
                        {r.endereco}
                      </Text>
                    ) : null}
                  </Vidro>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        ) : null}

        <Animated.View entering={entrada(3)}>
          <Vidro style={styles.cartao}>
            <View style={styles.relatorioLinha}>
              <View style={[styles.avatar, { backgroundColor: p.relatorio ? colors.successBg : colors.sand }]}>
                <Ionicons name={p.relatorio ? "checkmark-done" : "paper-plane"} size={18} color={p.relatorio ? colors.greenDark : colors.primaryDark} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.nome}>Relatório de {mesCurto}</Text>
                <Text style={styles.detalhe}>
                  {p.relatorio
                    ? `Enviado: ${p.relatorio.horas ?? 0} h · ${p.relatorio.estudos} ${p.relatorio.estudos === 1 ? "estudo" : "estudos"}`
                    : `${duracao(p.minutosMes)} e ${p.estudos} ${p.estudos === 1 ? "estudo" : "estudos"}. Vai direto para o seu grupo.`}
                </Text>
              </View>
            </View>
            <Button
              label={p.relatorio ? "Mandar de novo" : "Enviar relatório"}
              icon="paper-plane-outline"
              variant={p.relatorio ? "secondary" : "primary"}
              onPress={() => setRelatorioAberto(true)}
              fullWidth
            />
          </Vidro>
        </Animated.View>
      </ScrollView>

      <VisitaSheet revisitaId={visita?.id ?? null} nome={visita?.nome ?? ""} tipo={visita?.tipo} onClose={() => setVisita(null)} />
      <RelatorioPioneiroSheet painel={p} visible={relatorioAberto} onClose={() => setRelatorioAberto(false)} />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1 },
    scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 16 },
    flex: { flex: 1 },
    pressionado: { opacity: 0.75 },
    bloco: { gap: 10 },
    hero: { alignItems: "center", gap: 14, paddingVertical: 22 },
    relogio: { fontSize: 36, fontWeight: "900", color: colors.text, fontVariant: ["tabular-nums"], letterSpacing: -1 },
    anelValor: { fontSize: 52, fontWeight: "900", color: colors.text, letterSpacing: -2 },
    anelUnidade: { fontSize: 22, fontWeight: "800", color: colors.textSecondary, letterSpacing: 0 },
    anelLegenda: { fontSize: 13.5, fontWeight: "700", color: colors.textSecondary, marginTop: -2 },
    heroTexto: { fontSize: 14, color: colors.textSecondary, textAlign: "center" },
    botoes: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
    cartao: { gap: 12 },
    contagem: { gap: 8 },
    contagemTexto: { fontSize: 14, fontWeight: "800", color: colors.primaryDark },
    trilho: { height: 6, borderRadius: radius.pill, backgroundColor: colors.border, overflow: "hidden" },
    cheio: { height: 6, borderRadius: radius.pill, backgroundColor: colors.primary },
    conversa: { gap: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    conversaLinha: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    nome: { fontSize: 15.5, fontWeight: "800", color: colors.text },
    nomeFeito: { color: colors.textSecondary },
    detalhe: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
    feita: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
    feitaTexto: { fontSize: 12, fontWeight: "800" },
    acoes: { flexDirection: "row", gap: 8, paddingLeft: 52 },
    vazio: { alignItems: "center", gap: 8, paddingVertical: 8 },
    vazioTexto: { fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
    fileira: { gap: 10, paddingRight: 16 },
    proxima: { width: 210, gap: 6, padding: 14 },
    relatorioLinha: { flexDirection: "row", alignItems: "center", gap: 12 },
  });
