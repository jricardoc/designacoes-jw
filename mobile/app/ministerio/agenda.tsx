import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAgendaPioneiro, useApagarPlano } from "@/api/hooks/usePioneiro";
import type { AgendaPioneiro, PlanoSaida, SaidaAgenda } from "@/api/types";
import { CartaoCalendario } from "@/components/ministerio/Calendario";
import { duracao, isoDoDia } from "@/components/ministerio/escolhas";
import {
  BotaoPilula,
  CabecalhoMinisterio,
  dataLonga,
  horaDe,
  MenuAcoes,
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
import { usePuxar } from "@/utils/usePuxar";

const DIAS = 21;

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
 * A agenda das próximas três semanas: as visitas marcadas, os planos de saída (os meus e os dos
 * outros pioneiros que compartilham) e as saídas de campo publicadas da congregação.
 */
export default function AgendaMinisterio() {
  const { colors, styles } = useTema(criarEstilos);
  const recuo = useRecuo();
  const toast = useToast();
  const hoje = isoDoDia(new Date());
  const ate = somarDias(hoje, DIAS - 1);
  const [dia, setDia] = useState(hoje);
  const { data: ag, refetch } = useAgendaPioneiro(hoje, ate);
  const apagarPlano = useApagarPlano();
  const puxar = usePuxar(refetch);
  const [planoAberto, setPlanoAberto] = useState(false);
  const [menuPlano, setMenuPlano] = useState<PlanoSaida | null>(null);

  const dias = useMemo(() => Array.from({ length: DIAS }, (_, i) => somarDias(hoje, i)), [hoje]);
  const eventos = eventosDo(ag, dia);
  const [ano, mes, numero] = dia.split("-").map(Number);

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
        <TituloTela
          titulo="Agenda"
          subtitulo={dataLonga(new Date(ano, mes - 1, numero))}
          direita={<BotaoPilula rotulo="Planejar" icone="add" onPress={() => setPlanoAberto(true)} />}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.semana}>
          {dias.map((d) => {
            const ativo = d === dia;
            const [a, m, n] = d.split("-").map(Number);
            const k = marcas(d);
            return (
              <Pressable
                key={d}
                onPress={() => setDia(d)}
                style={[styles.dia, ativo && styles.diaAtivo]}
                accessibilityRole="radio"
                accessibilityState={{ selected: ativo }}
                accessibilityLabel={dataLonga(new Date(a, m - 1, n))}
              >
                <Text style={[styles.diaSemana, ativo && styles.diaTextoAtivo]}>{d === hoje ? "Hoje" : DIAS_CURTOS[new Date(a, m - 1, n).getDay()]}</Text>
                <Text style={[styles.diaNumero, ativo && styles.diaTextoAtivo]}>{n}</Text>
                <View style={styles.pontos}>
                  {k.visita ? <View style={[styles.ponto, { backgroundColor: ativo ? colors.textOnPrimary : colors.primary }]} /> : null}
                  {k.plano ? <View style={[styles.ponto, { backgroundColor: ativo ? colors.textOnPrimary : colors.purple }]} /> : null}
                  {k.saida ? <View style={[styles.ponto, { backgroundColor: ativo ? colors.textOnPrimary : colors.teal }]} /> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.lista}>
          {eventos.length ? (
            eventos.map((e, i) => {
              const v = visual(e);
              const meuPlano = e.tipo === "plano" && e.plano.meu;
              return (
                <Animated.View key={e.chave} entering={FadeInDown.delay(i * 50).duration(320)}>
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

      <PlanoSheet visible={planoAberto} onClose={() => setPlanoAberto(false)} dia={dia} />
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
    semana: { gap: 8, paddingRight: 16 },
    dia: {
      width: 56,
      alignItems: "center",
      gap: 2,
      paddingVertical: 10,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    diaAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    diaSemana: { fontSize: 11.5, fontWeight: "800", color: colors.textSecondary, textTransform: "uppercase" },
    diaNumero: { fontSize: 20, fontWeight: "900", color: colors.text },
    diaTextoAtivo: { color: colors.textOnPrimary },
    pontos: { flexDirection: "row", gap: 3, height: 6, alignItems: "center" },
    ponto: { width: 5, height: 5, borderRadius: 3 },
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
