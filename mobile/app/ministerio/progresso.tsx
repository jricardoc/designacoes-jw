import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useApagarHoras, usePainelPioneiro, useProgresso } from "@/api/hooks/usePioneiro";
import type { EmblemaPioneiro, ProgressoPioneiro, RegistroHoras } from "@/api/types";
import { EmblemaCartao, EmblemaSheet } from "@/components/ministerio/Emblema";
import { diaCurto, duracao } from "@/components/ministerio/escolhas";
import { HorasSheet } from "@/components/ministerio/HorasSheet";
import { Anel, CabecalhoMinisterio, MenuAcoes, mesAtual, Secao, TituloTela, useRecuo, Vidro, type Icone } from "@/components/ministerio/kit";
import { RelatorioPioneiroSheet } from "@/components/ministerio/RelatorioPioneiroSheet";
import { Button, Loading, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { nomeMes, somarMeses } from "@/utils/assistenciaMensal";
import { usePuxar } from "@/utils/usePuxar";

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const horasDecimais = (min: number) => String(Math.floor(min / 6) / 10).replace(".", ",");

type Status = ProgressoPioneiro["porMes"][number]["status"];

const STATUS: Record<Status, { icone: Icone; rotulo: string }> = {
  meta: { icone: "checkmark", rotulo: "Meta" },
  parcial: { icone: "ellipsis-horizontal", rotulo: "Parcial" },
  vazio: { icone: "remove", rotulo: "Sem horas" },
  futuro: { icone: "time-outline", rotulo: "Ainda vai chegar" },
};

/** O ano de serviço do pioneiro: o mês contra a meta, o status de cada mês, os emblemas, a quilometragem e as horas. */
export default function ProgressoMinisterio() {
  const { colors, styles } = useTema(criarEstilos);
  const recuo = useRecuo();
  const toast = useToast();
  const atual = mesAtual();
  const [mes, setMes] = useState(atual);
  const progresso = useProgresso(mes);
  const painel = usePainelPioneiro(mes);
  const apagar = useApagarHoras();
  const puxar = usePuxar(() => Promise.all([progresso.refetch(), painel.refetch()]));
  const [emblema, setEmblema] = useState<EmblemaPioneiro | null>(null);
  const [horasAberto, setHorasAberto] = useState(false);
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [menuHoras, setMenuHoras] = useState<RegistroHoras | null>(null);
  const pg = progresso.data;
  const p = painel.data;

  if (!pg || !p) {
    return (
      <View style={styles.tela}>
        <CabecalhoMinisterio />
        <Loading label="Carregando..." />
      </View>
    );
  }

  const metaMin = pg.meta * 60;
  const fracaoAno = pg.metaAno ? pg.minutosAno / (pg.metaAno * 60) : 0;
  const mesCurto = pg.nomeMes.split(" de ")[0];

  const corStatus = (s: Status) =>
    s === "meta" ? colors.primary : s === "parcial" ? colors.amber : s === "vazio" ? colors.textMuted : colors.border;

  return (
    <View style={styles.tela}>
      <CabecalhoMinisterio />
      <ScrollView contentContainerStyle={[styles.scroll, recuo]} refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}>
        <TituloTela
          titulo="Progresso"
          subtitulo={maiuscula(nomeMes(mes))}
          direita={
            <View style={styles.setas}>
              <Pressable style={styles.seta} onPress={() => setMes(somarMeses(mes, -1))} hitSlop={6} accessibilityLabel="Mês anterior">
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </Pressable>
              <Pressable
                style={[styles.seta, mes >= atual && { opacity: 0.3 }]}
                onPress={() => setMes(somarMeses(mes, 1))}
                disabled={mes >= atual}
                hitSlop={6}
                accessibilityLabel="Próximo mês"
              >
                <Ionicons name="chevron-forward" size={18} color={colors.text} />
              </Pressable>
            </View>
          }
        />

        <Animated.View entering={FadeInDown.duration(400)}>
          <Vidro style={styles.hero}>
            <Anel tamanho={150} fracao={metaMin ? pg.minutosMes / metaMin : 0}>
              <Text style={styles.anelValor}>{horasDecimais(pg.minutosMes)}</Text>
              <Text style={styles.anelLegenda}>de {pg.meta} h</Text>
            </Anel>
            <View style={styles.numeros}>
              <View>
                <Text style={styles.numeroRotulo}>Ano de serviço</Text>
                <Text style={styles.numeroValor}>
                  {Math.floor(pg.minutosAno / 60)} <Text style={styles.numeroDe}>de {pg.metaAno} h</Text>
                </Text>
                <View style={styles.trilho}>
                  <View style={[styles.cheio, { width: `${Math.round(Math.min(1, fracaoAno) * 100)}%` }]} />
                </View>
              </View>
              <View style={styles.par}>
                <View>
                  <Text style={styles.numeroRotulo}>Estudos</Text>
                  <Text style={styles.numeroValor}>{p.estudos}</Text>
                </View>
                <View>
                  <Text style={styles.numeroRotulo}>Contatos</Text>
                  <Text style={styles.numeroValor}>{p.revisitas}</Text>
                </View>
              </View>
            </View>
          </Vidro>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(70).duration(400)} style={styles.bloco}>
          <Secao titulo="Status por mês" />
          <Vidro style={styles.cartao}>
            <View style={styles.meses}>
              {pg.porMes.map((m) => {
                const cor = corStatus(m.status);
                const escolhido = m.mes === mes;
                return (
                  <Pressable
                    key={m.mes}
                    disabled={m.mes > atual}
                    onPress={() => setMes(m.mes)}
                    style={[styles.mes, escolhido && { borderColor: colors.text }]}
                    accessibilityLabel={`${nomeMes(m.mes)}: ${STATUS[m.status].rotulo}, ${duracao(m.minutos)}${m.relatorio ? ", relatório enviado" : ""}`}
                  >
                    <View style={[styles.mesBolinha, m.status === "meta" ? { backgroundColor: cor } : { borderColor: cor, borderWidth: 2 }]}>
                      <Ionicons name={STATUS[m.status].icone} size={14} color={m.status === "meta" ? colors.textOnPrimary : cor} />
                    </View>
                    <Text style={[styles.mesNome, escolhido && { color: colors.text }]}>{nomeMes(m.mes, true)}</Text>
                    {m.relatorio ? <Ionicons name="paper-plane" size={10} color={colors.primary} accessibilityLabel="relatório enviado" /> : <View style={{ height: 10 }} />}
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.legenda}>
              {(["meta", "parcial", "vazio"] as const).map((k) => (
                <View key={k} style={styles.legendaItem}>
                  <Ionicons name={STATUS[k].icone} size={12} color={corStatus(k)} />
                  <Text style={styles.legendaTexto}>{STATUS[k].rotulo}</Text>
                </View>
              ))}
              <View style={styles.legendaItem}>
                <Ionicons name="paper-plane" size={11} color={colors.primary} />
                <Text style={styles.legendaTexto}>Relatório enviado</Text>
              </View>
            </View>
          </Vidro>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(400)} style={styles.bloco}>
          <Secao titulo="Emblemas" />
          <View style={styles.grade}>
            {[0, 2].map((i) => (
              <View key={i} style={styles.gradeLinha}>
                {pg.emblemas.slice(i, i + 2).map((e) => (
                  <EmblemaCartao key={e.id} emblema={e} onPress={() => setEmblema(e)} />
                ))}
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(210).duration(400)}>
          <Pressable onPress={() => router.push("/ministerio/quilometragem")} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.8 }}>
            <Vidro style={styles.km}>
              <View style={styles.kmIcone}>
                <Ionicons name="car" size={22} color={colors.teal} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.nome}>Quilometragem de {mesCurto}</Text>
                <Text style={styles.detalhe}>
                  {String(pg.viagens.km).replace(".", ",")} km em {pg.viagens.quantidade} {pg.viagens.quantidade === 1 ? "viagem" : "viagens"}
                  {pg.viagens.custo ? ` · R$ ${pg.viagens.custo.toFixed(2).replace(".", ",")}` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Vidro>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(280).duration(400)} style={styles.bloco}>
          <Secao titulo={`Horas de ${mesCurto}`} acao="Lançar" onAcao={() => setHorasAberto(true)} />
          <Vidro style={styles.cartao}>
            {p.registros.length ? (
              p.registros.map((r, i) => (
                <Pressable
                  key={r.id}
                  onLongPress={() => setMenuHoras(r)}
                  delayLongPress={350}
                  style={({ pressed }) => [styles.registro, i > 0 && styles.registroBorda, pressed && { opacity: 0.7 }]}
                  accessibilityHint="Toque longo para apagar"
                >
                  <Ionicons name={r.origem === "cronometro" ? "timer-outline" : "create-outline"} size={18} color={colors.textSecondary} />
                  <View style={styles.flex}>
                    <Text style={styles.nome}>{duracao(r.minutos)}</Text>
                    <Text style={styles.detalhe}>{[diaCurto(r.data), r.observacao].filter(Boolean).join(" · ")}</Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text style={styles.detalhe}>Nada lançado neste mês.</Text>
            )}
          </Vidro>
        </Animated.View>

        <Vidro style={styles.cartao}>
          <Text style={styles.nome}>Relatório de {mesCurto}</Text>
          <Text style={styles.detalhe}>
            {p.relatorio
              ? `Enviado: ${p.relatorio.horas ?? 0} h · ${p.relatorio.estudos} ${p.relatorio.estudos === 1 ? "estudo" : "estudos"}`
              : "Ainda não enviado. Vai direto para o seu grupo."}
          </Text>
          <Button label={p.relatorio ? "Mandar de novo" : "Enviar relatório"} icon="paper-plane-outline" variant={p.relatorio ? "secondary" : "primary"} onPress={() => setRelatorioAberto(true)} fullWidth />
        </Vidro>
      </ScrollView>

      <EmblemaSheet emblema={emblema} onClose={() => setEmblema(null)} />
      <HorasSheet visible={horasAberto} onClose={() => setHorasAberto(false)} />
      <RelatorioPioneiroSheet painel={p} visible={relatorioAberto} onClose={() => setRelatorioAberto(false)} />
      <MenuAcoes
        visible={!!menuHoras}
        onClose={() => setMenuHoras(null)}
        titulo={menuHoras ? duracao(menuHoras.minutos) : null}
        subtitulo={menuHoras ? diaCurto(menuHoras.data) : null}
        acoes={[
          {
            rotulo: "Apagar estas horas",
            icone: "trash-outline",
            perigo: true,
            onPress: () => {
              if (!menuHoras) return;
              apagar.mutate(menuHoras.id, {
                onSuccess: () => toast.show("Horas apagadas"),
                onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu", "error"),
              });
            },
          },
        ]}
      />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1 },
    scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 16 },
    flex: { flex: 1 },
    bloco: { gap: 10 },
    setas: { flexDirection: "row", gap: 8 },
    seta: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    hero: { flexDirection: "row", alignItems: "center", gap: 16 },
    anelValor: { fontSize: 34, fontWeight: "900", color: colors.text, letterSpacing: -1 },
    anelLegenda: { fontSize: 12.5, fontWeight: "700", color: colors.textSecondary },
    numeros: { flex: 1, gap: 14 },
    numeroRotulo: { fontSize: 12, fontWeight: "800", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
    numeroValor: { fontSize: 22, fontWeight: "900", color: colors.text },
    numeroDe: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
    trilho: { height: 6, borderRadius: radius.pill, backgroundColor: colors.border, overflow: "hidden", marginTop: 6 },
    cheio: { height: 6, borderRadius: radius.pill, backgroundColor: colors.primary },
    par: { flexDirection: "row", gap: 24 },
    cartao: { gap: 12 },
    meses: { flexDirection: "row", flexWrap: "wrap", rowGap: 10 },
    mes: { width: "16.66%", alignItems: "center", gap: 4, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5, borderColor: "transparent" },
    mesBolinha: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    mesNome: { fontSize: 11.5, fontWeight: "800", color: colors.textSecondary, textTransform: "capitalize" },
    legenda: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    legendaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    legendaTexto: { fontSize: 11.5, color: colors.textSecondary },
    grade: { gap: 10 },
    gradeLinha: { flexDirection: "row", gap: 10 },
    km: { flexDirection: "row", alignItems: "center", gap: 12 },
    kmIcone: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.tealBg },
    nome: { fontSize: 15.5, fontWeight: "800", color: colors.text },
    detalhe: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
    registro: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
    registroBorda: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 },
  });
