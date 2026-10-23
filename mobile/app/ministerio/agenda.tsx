import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useAgendaPioneiro, useApagarPlano } from "@/api/hooks/usePioneiro";
import type { AgendaPioneiro, PlanoSaida, SaidaAgenda } from "@/api/types";
import { CartaoCalendario } from "@/components/ministerio/Calendario";
import { doisDig, duracao, isoDoDia } from "@/components/ministerio/escolhas";
import {
  BotaoPilula,
  CabecalhoMinisterio,
  dataLonga,
  EASE,
  entrada,
  horaDe,
  LEVE,
  maiuscula,
  MenuAcoes,
  Secao,
  SITUACAO,
  somarDias,
  TituloTela,
  useRecuo,
  Vidro,
  type Icone,
} from "@/components/ministerio/kit";
import { PlanoSheet } from "@/components/ministerio/PlanoSheet";
import { Button, useToast } from "@/components/ui";
import { DIAS_CURTOS, radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { nomeMes, somarMeses } from "@/utils/assistenciaMensal";
import { usePuxar } from "@/utils/usePuxar";

type Evento =
  | { tipo: "saida"; chave: string; hora: string; saida: SaidaAgenda }
  | { tipo: "plano"; chave: string; hora: string; plano: PlanoSaida }
  | { tipo: "visita"; chave: string; hora: string; visita: AgendaPioneiro["visitas"][number] };

const diaDaVisita = (iso: string | null) => (iso ? isoDoDia(new Date(iso)) : "");

/** "09:30" + 120 -> "11:30" */
const fimDe = (hora: string, minutos: number) => {
  const [h, m] = hora.split(":").map(Number);
  const t = (h * 60 + m + minutos) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

function eventosDo(ag: AgendaPioneiro | undefined, dia: string): Evento[] {
  if (!ag) return [];
  const lista: Evento[] = [
    ...ag.saidas.filter((s) => s.data === dia).map((s): Evento => ({ tipo: "saida", chave: `s${s.id}`, hora: s.hora ?? "", saida: s })),
    ...ag.planos.filter((p) => p.data === dia).map((p): Evento => ({ tipo: "plano", chave: `p${p.id}`, hora: p.hora, plano: p })),
    ...ag.visitas
      .filter((v) => diaDaVisita(v.proximaVisita) === dia)
      .map((v): Evento => ({ tipo: "visita", chave: `v${v.id}`, hora: v.proximaVisita ? horaDe(v.proximaVisita) : "", visita: v })),
  ];
  return lista.sort((a, b) => a.hora.localeCompare(b.hora));
}

/**
 * A agenda do mês, num calendário com todos os dias: as visitas marcadas, os planos de saída
 * (os meus e os dos outros pioneiros que compartilham) e as saídas de campo publicadas da congregação.
 */
export default function AgendaMinisterio() {
  const { colors, styles } = useTema(criarEstilos);
  const recuo = useRecuo();
  const toast = useToast();
  const hoje = isoDoDia(new Date());
  const [mes, setMes] = useState(() => hoje.slice(0, 7));
  const [dia, setDia] = useState(hoje);
  const [ano, numeroMes] = mes.split("-").map(Number);
  const diasNoMes = new Date(ano, numeroMes, 0).getDate();
  const { data: ag, refetch } = useAgendaPioneiro(`${mes}-01`, `${mes}-${doisDig(diasNoMes)}`);
  const apagarPlano = useApagarPlano();
  const puxar = usePuxar(refetch);
  const [planoAberto, setPlanoAberto] = useState(false);
  const [menuPlano, setMenuPlano] = useState<PlanoSaida | null>(null);

  const eventos = eventosDo(ag, dia);
  const [a, m, n] = dia.split("-").map(Number);

  // No mês de hoje, abre em hoje; nos outros, no dia 1.
  const mudarMes = (delta: number) => {
    const novo = somarMeses(mes, delta);
    setMes(novo);
    setDia(novo === hoje.slice(0, 7) ? hoje : `${novo}-01`);
  };
  const irParaHoje = () => {
    setMes(hoje.slice(0, 7));
    setDia(hoje);
  };

  const marcas = (d: string) => ({
    visita: !!ag?.visitas.some((v) => diaDaVisita(v.proximaVisita) === d),
    plano: !!ag?.planos.some((p) => p.data === d),
    saida: !!ag?.saidas.some((s) => s.data === d),
  });

  const visual = (e: Evento): { icone: Icone; cor: string; titulo: string; detalhe: string; rodape?: string } => {
    if (e.tipo === "saida") {
      return {
        icone: "people",
        cor: colors.teal,
        titulo: "Saída de campo",
        detalhe: e.saida.local || "Local a confirmar",
        rodape: e.saida.dirigente ? `Dirigente: ${e.saida.dirigente}` : undefined,
      };
    }
    if (e.tipo === "plano") {
      const p = e.plano;
      return {
        icone: p.meu ? "walk" : "person",
        cor: p.meu ? colors.primary : colors.purple,
        titulo: p.meu ? "Ministério" : `${p.nome} vai sair`,
        detalhe: [`${p.hora}–${fimDe(p.hora, p.duracaoMin)} (${duracao(p.duracaoMin)})`, p.local].filter(Boolean).join(" · "),
        rodape: p.nota ?? undefined,
      };
    }
    const v = e.visita;
    return {
      icone: v.estudo ? "book" : "person",
      cor: SITUACAO[v.situacao].cor(colors),
      titulo: `${v.estudo ? "Estudo" : "Revisita"}: ${v.nome}`,
      detalhe: v.endereco || "Sem endereço",
    };
  };

  return (
    <View style={styles.tela}>
      <CabecalhoMinisterio />
      <ScrollView contentContainerStyle={[styles.scroll, recuo]} refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}>
        <TituloTela titulo="Agenda" direita={<BotaoPilula rotulo="Planejar" icone="add" onPress={() => setPlanoAberto(true)} />} />

        <Vidro style={styles.mes}>
          <View style={styles.mesTopo}>
            <Pressable style={styles.seta} onPress={() => mudarMes(-1)} hitSlop={6} accessibilityLabel="Mês anterior">
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.mesNome}>{maiuscula(nomeMes(mes))}</Text>
            <Pressable style={styles.seta} onPress={() => mudarMes(1)} hitSlop={6} accessibilityLabel="Próximo mês">
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </Pressable>
          </View>
          <Animated.View key={mes} entering={FadeIn.duration(LEVE).easing(EASE)} style={styles.grade}>
            {DIAS_CURTOS.map((d) => (
              <Text key={d} style={styles.semanaRotulo}>
                {d[0]}
              </Text>
            ))}
            {Array.from({ length: new Date(ano, numeroMes - 1, 1).getDay() }, (_, i) => (
              <View key={`vazio${i}`} style={styles.celula} />
            ))}
            {Array.from({ length: diasNoMes }, (_, i) => {
              const d = `${mes}-${doisDig(i + 1)}`;
              const ativo = d === dia;
              const k = marcas(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => setDia(d)}
                  style={styles.celula}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ativo }}
                  accessibilityLabel={dataLonga(new Date(ano, numeroMes - 1, i + 1))}
                >
                  <View style={[styles.bola, d === hoje && styles.bolaHoje, ativo && styles.bolaAtiva]}>
                    <Text style={[styles.numero, d === hoje && styles.numeroHoje, ativo && styles.numeroAtivo]}>{i + 1}</Text>
                  </View>
                  <View style={styles.pontos}>
                    {k.visita ? <View style={[styles.ponto, { backgroundColor: colors.primary }]} /> : null}
                    {k.plano ? <View style={[styles.ponto, { backgroundColor: colors.purple }]} /> : null}
                    {k.saida ? <View style={[styles.ponto, { backgroundColor: colors.teal }]} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
          <View style={styles.legenda}>
            {(
              [
                ["Visitas", colors.primary],
                ["Planos", colors.purple],
                ["Saídas de campo", colors.teal],
              ] as const
            ).map(([rotulo, cor]) => (
              <View key={rotulo} style={styles.legendaItem}>
                <View style={[styles.ponto, { backgroundColor: cor }]} />
                <Text style={styles.legendaTexto}>{rotulo}</Text>
              </View>
            ))}
          </View>
        </Vidro>

        <Secao titulo={dataLonga(new Date(a, m - 1, n))} acao={dia === hoje ? undefined : "Hoje"} onAcao={irParaHoje} />

        <View style={styles.lista}>
          {eventos.length ? (
            eventos.map((e, i) => {
              const v = visual(e);
              const meuPlano = e.tipo === "plano" && e.plano.meu;
              return (
                <Animated.View key={e.chave} entering={entrada(i)}>
                  <Pressable
                    onPress={e.tipo === "visita" ? () => router.push({ pathname: "/ministerio/contato", params: { id: String(e.visita.id) } }) : undefined}
                    onLongPress={meuPlano ? () => setMenuPlano(e.plano) : undefined}
                    delayLongPress={350}
                    style={({ pressed }) => [styles.evento, pressed && (e.tipo === "visita" || meuPlano) && styles.pressionado]}
                    accessibilityRole={e.tipo === "visita" ? "button" : undefined}
                    accessibilityHint={meuPlano ? "Toque longo para apagar o plano" : undefined}
                  >
                    <View style={styles.horaCol}>
                      <Text style={styles.hora}>{e.hora || "--:--"}</Text>
                    </View>
                    <View style={[styles.faixa, { backgroundColor: v.cor }]} />
                    <Vidro style={styles.eventoCartao}>
                      <View style={styles.eventoTopo}>
                        <Ionicons name={v.icone} size={16} color={v.cor} />
                        <Text style={styles.eventoTitulo} numberOfLines={1}>
                          {v.titulo}
                        </Text>
                      </View>
                      <Text style={styles.eventoDetalhe}>{v.detalhe}</Text>
                      {v.rodape ? <Text style={styles.eventoRodape}>{v.rodape}</Text> : null}
                    </Vidro>
                  </Pressable>
                </Animated.View>
              );
            })
          ) : (
            <Vidro style={styles.vazio}>
              <Ionicons name="calendar-clear-outline" size={28} color={colors.primary} />
              <Text style={styles.vazioTexto}>{ag ? "Nada marcado para este dia." : "Carregando a agenda..."}</Text>
              {ag ? <Button label="Planejar saída" icon="add" variant="secondary" onPress={() => setPlanoAberto(true)} /> : null}
            </Vidro>
          )}
          <Text style={styles.nota}>Os planos dos outros pioneiros aparecem aqui. Para esconder os seus, desligue em Perfil e configurações.</Text>
        </View>

        <CartaoCalendario />
      </ScrollView>

      <PlanoSheet visible={planoAberto} onClose={() => setPlanoAberto(false)} dia={dia >= hoje && dia <= somarDias(hoje, 44) ? dia : undefined} />
      <MenuAcoes
        visible={!!menuPlano}
        onClose={() => setMenuPlano(null)}
        titulo="Plano de saída"
        subtitulo={menuPlano ? `${menuPlano.hora} · ${duracao(menuPlano.duracaoMin)}` : null}
        acoes={[
          {
            rotulo: "Apagar plano",
            icone: "trash-outline",
            perigo: true,
            onPress: () => {
              if (!menuPlano) return;
              apagarPlano.mutate(menuPlano.id, {
                onSuccess: () => toast.show("Plano apagado"),
                onError: (err) => toast.show(err instanceof Error ? err.message : "Não deu", "error"),
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
    pressionado: { opacity: 0.75 },
    mes: { padding: 12, gap: 8 },
    mesTopo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    mesNome: { fontSize: 16, fontWeight: "800", color: colors.text },
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
    grade: { flexDirection: "row", flexWrap: "wrap" },
    // 100 / 7: sete colunas certas, com ou sem a linha incompleta no fim.
    semanaRotulo: { width: "14.2857%", textAlign: "center", fontSize: 12, fontWeight: "800", color: colors.textMuted, paddingBottom: 4 },
    celula: { width: "14.2857%", alignItems: "center", gap: 2, paddingVertical: 3 },
    bola: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "transparent" },
    bolaHoje: { borderColor: colors.primary },
    bolaAtiva: { backgroundColor: colors.primary, borderColor: colors.primary },
    numero: { fontSize: 15, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
    numeroHoje: { color: colors.primary, fontWeight: "900" },
    numeroAtivo: { color: colors.textOnPrimary },
    pontos: { flexDirection: "row", gap: 3, height: 5, alignItems: "center" },
    ponto: { width: 5, height: 5, borderRadius: 3 },
    legenda: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14 },
    legendaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendaTexto: { fontSize: 12, color: colors.textSecondary },
    lista: { gap: 10 },
    evento: { flexDirection: "row", alignItems: "stretch", gap: 10 },
    horaCol: { width: 46, paddingTop: 14 },
    hora: { fontSize: 14, fontWeight: "900", color: colors.text, fontVariant: ["tabular-nums"] },
    faixa: { width: 4, borderRadius: radius.pill },
    eventoCartao: { flex: 1, gap: 4, padding: 14 },
    eventoTopo: { flexDirection: "row", alignItems: "center", gap: 6 },
    eventoTitulo: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.text },
    eventoDetalhe: { fontSize: 13.5, color: colors.textSecondary },
    eventoRodape: { fontSize: 12.5, color: colors.textMuted },
    vazio: { alignItems: "center", gap: 10, paddingVertical: 22 },
    vazioTexto: { fontSize: 14.5, color: colors.textSecondary },
    nota: { fontSize: 12.5, color: colors.textMuted, textAlign: "center", paddingHorizontal: 12 },
  });
