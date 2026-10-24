import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useMarcarLeitura, usePerfilEstudo } from "@/api/hooks/useEstudo";
import type { EstadoEstudo, RotinaEstudo } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { rotuloParte } from "@/components/estudo/biblia";
import { CarregandoOuErro, Cartao, diaCurtoDe, LinhaLink, LinkFonte, SeloMarca, useLeitura, useLerEMarcar } from "@/components/estudo/comum";
import { DICAS_LEITURA, FONTES, LINKS } from "@/components/estudo/dicas";
import { inicioParaHoje, nomeDoPlano, proximoCapituloLivre, somarDias, type Trecho } from "@/components/estudo/programas";
import { CabecalhoAmbiente } from "@/components/layout/Ambientes";
import { dataLonga, entrada, TituloTela, useRecuo } from "@/components/ministerio/kit";
import { Button, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { usePuxar } from "@/utils/usePuxar";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** O próximo horário de um tipo da rotina, a partir de agora ("Terça, 20:00"). */
function proximaVez(rotina: RotinaEstudo[], tipo: RotinaEstudo["tipo"], agora = new Date()) {
  const hhmm = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  for (let d = 0; d < 8; d++) {
    const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + d);
    const candidatos = rotina
      .filter((r) => r.tipo === tipo && r.dias.includes(dia.getDay()) && (d > 0 || r.hora > hhmm))
      .map((r) => r.hora)
      .sort();
    if (candidatos.length) return `${d === 0 ? "Hoje" : d === 1 ? "Amanhã" : DIAS_SEMANA[dia.getDay()]}, ${candidatos[0]}`;
  }
  return null;
}

/** Os dias com leitura e com estudo (a regularidade). */
function diasFeitos(estado: EstadoEstudo) {
  return { leitura: new Set(estado.leituras.map((l) => l.dia)), estudo: new Set(estado.sessoes.map((s) => s.dia)) };
}

/**
 * O Hoje do Estudo pessoal: a leitura do dia no programa escolhido, a leitura da semana da
 * reunião, a regularidade da semana e o próximo estudo, com o assunto já escolhido.
 */
export default function HojeEstudo() {
  const { colors, styles } = useTema(criarEstilos);
  const recuo = useRecuo();
  const { estado, leitura, isLoading, refetch } = useLeitura();
  const puxar = usePuxar(refetch);
  const abrirLeitura = useLerEMarcar();
  const marcar = useMarcarLeitura();
  const perfil = usePerfilEstudo();
  const { feito } = useCelebracao();
  const toast = useToast();

  const feitos = useMemo(() => (estado ? diasFeitos(estado) : null), [estado]);

  if (!estado || !leitura || !feitos) {
    return (
      <View style={styles.tela}>
        <CabecalhoAmbiente atual="estudo" />
        <CarregandoOuErro carregando={isLoading} tentar={() => refetch()} />
      </View>
    );
  }

  const p = estado.perfil;
  const hoje = estado.hoje;
  const [a, m, d] = hoje.split("-").map(Number);
  const diaDoAno = Math.floor((Date.UTC(a, m - 1, d) - Date.UTC(a, 0, 0)) / 86400000);
  const dica = DICAS_LEITURA[diaDoAno % DICAS_LEITURA.length];

  // A semana de segunda a domingo, com os dias de leitura e de estudo.
  const segunda = somarDias(hoje, -((new Date(a, m - 1, d).getDay() + 6) % 7));
  const semana = Array.from({ length: 7 }, (_, i) => somarDias(segunda, i));
  const ultimos28 = Array.from({ length: 28 }, (_, i) => somarDias(hoje, -i)).filter((dia) => feitos.leitura.has(dia)).length;

  const marcarLido = (plano: typeof p.plano, t: Pick<Trecho, "id" | "titulo">) => {
    marcar.mutate({ plano, itens: [t.id] }, { onError: () => toast.show("Não deu para marcar", "error") });
    feito({ titulo: "Leitura marcada", detalhe: t.titulo, icone: "checkmark-done" });
  };

  const naoComecou = (p.plano === "jw" || p.plano === "comece") && !p.inicio;
  const livre = p.plano === "livre" ? proximoCapituloLivre(estado.leituras) : null;
  const trechoLivre: Trecho | null = livre ? { id: `${livre.livro}:${livre.de}`, titulo: rotuloParte(livre), partes: [livre] } : null;
  const prox = leitura.proximo;
  const hojeTrecho = trechoLivre ?? prox?.trecho ?? null;

  const assuntoDaVez = [...estado.assuntos].reverse().find((s) => !s.estudadoEm) ?? null;
  const proximoEstudo = proximaVez(estado.rotina, "estudo");
  const minutosRodando = p.sessaoInicio ? Math.max(0, Math.round((Date.now() - new Date(p.sessaoInicio).getTime()) / 60000)) : null;

  return (
    <View style={styles.tela}>
      <CabecalhoAmbiente atual="estudo" />
      <ScrollView contentContainerStyle={[styles.scroll, recuo]} refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}>
        <TituloTela titulo="Hoje" subtitulo={dataLonga(new Date(a, m - 1, d))} />

        {/* A leitura de hoje, no programa escolhido */}
        <Animated.View entering={entrada(0)}>
          <Cartao style={styles.gap}>
            <Text style={styles.etiqueta}>LEITURA DE HOJE · {nomeDoPlano(p).toUpperCase()}</Text>
            {naoComecou ? (
              <>
                <Text style={styles.grande}>Escolha seu programa de leitura</Text>
                <Text style={styles.texto}>Um grupo de capítulos por dia lê a Bíblia inteira em um ano. Dá para ir mais devagar.</Text>
                <Button label="Escolher programa" icon="book-outline" onPress={() => router.push("/estudo/programa")} fullWidth />
              </>
            ) : !hojeTrecho ? (
              <>
                <Text style={styles.grande}>{p.plano === "reuniao" ? "A programação desta semana ainda não foi importada" : "Programa concluído!"}</Text>
                <Button label="Escolher outro programa" variant="secondary" icon="book-outline" onPress={() => router.push("/estudo/programa")} fullWidth />
              </>
            ) : (
              <>
                <View style={styles.linha}>
                  <Text style={[styles.grande, styles.flex]}>{hojeTrecho.titulo}</Text>
                  <SeloMarca marca={hojeTrecho.marca} />
                </View>
                {hojeTrecho.detalhe ? <Text style={styles.texto}>{hojeTrecho.detalhe}</Text> : null}
                {prox && !livre && p.plano !== "reuniao" ? (
                  <View style={styles.linha}>
                    <Text style={[styles.status, prox.atraso > 0 ? { color: colors.amber } : prox.atraso < 0 ? { color: colors.green } : null]}>
                      {prox.atraso > 0
                        ? `Atrasada ${prox.atraso} ${prox.atraso === 1 ? "dia" : "dias"}`
                        : prox.atraso < 0
                          ? `Em dia · adiantado ${-prox.atraso} ${prox.atraso === -1 ? "dia" : "dias"}`
                          : "Para hoje"}
                      {` · ${prox.indice + 1} de ${leitura.trechos.length}`}
                    </Text>
                    {prox.atraso > 0 ? (
                      <Text
                        style={styles.acao}
                        onPress={() => perfil.mutate({ inicio: inicioParaHoje(prox.indice, p.ritmo, hoje) })}
                        accessibilityRole="button"
                      >
                        Reprogramar a partir de hoje
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.botoes}>
                  <Button label="Ler" icon="book" onPress={() => abrirLeitura(p.plano, hojeTrecho)} style={styles.flex} />
                  <Button label="Marquei como lido" icon="checkmark" variant="secondary" onPress={() => marcarLido(p.plano, hojeTrecho)} style={styles.flex} />
                </View>
                <View style={styles.dica}>
                  <Ionicons name="sparkles-outline" size={15} color={colors.amber} />
                  <View style={styles.flex}>
                    <Text style={styles.dicaTexto}>{dica.texto}</Text>
                    <LinkFonte fonte={dica.fonte} />
                  </View>
                </View>
              </>
            )}
          </Cartao>
        </Animated.View>

        {/* A leitura da semana da reunião */}
        {leitura.semana && p.plano !== "reuniao" ? (
          <Animated.View entering={entrada(1)}>
            <Cartao style={styles.gap}>
              <Text style={styles.etiqueta}>LEITURA DA SEMANA · REUNIÃO</Text>
              <View style={styles.linha}>
                <Text style={[styles.medio, styles.flex]}>{leitura.semana.titulo}</Text>
                {leitura.semanaLida ? <Ionicons name="checkmark-circle" size={22} color={colors.green} accessibilityLabel="Lida" /> : null}
              </View>
              {leitura.semana.detalhe ? <Text style={styles.texto}>{leitura.semana.detalhe}</Text> : null}
              {leitura.semana.partes.length && !leitura.semanaLida ? (
                <View style={styles.botoes}>
                  <Button label="Ler" icon="book" variant="secondary" onPress={() => abrirLeitura("reuniao", leitura.semana!)} style={styles.flex} />
                  <Button label="Marcar" icon="checkmark" variant="secondary" onPress={() => marcarLido("reuniao", leitura.semana!)} style={styles.flex} />
                </View>
              ) : null}
            </Cartao>
          </Animated.View>
        ) : null}

        {/* A regularidade da semana */}
        <Animated.View entering={entrada(2)}>
          <Cartao style={styles.gap}>
            <Text style={styles.etiqueta}>REGULARIDADE</Text>
            <View style={styles.semana}>
              {semana.map((dia) => {
                const ehHoje = dia === hoje;
                const [, , dd] = dia.split("-").map(Number);
                return (
                  <View key={dia} style={[styles.diaSemana, ehHoje && styles.diaHoje]} accessibilityLabel={`${diaCurtoDe(dia)}${feitos.leitura.has(dia) ? ", leu" : ""}${feitos.estudo.has(dia) ? ", estudou" : ""}`}>
                    <Text style={[styles.diaNome, ehHoje && styles.diaHojeTexto]}>{diaCurtoDe(dia).slice(0, 3)}</Text>
                    <Text style={[styles.diaNumero, ehHoje && styles.diaHojeTexto]}>{dd}</Text>
                    <View style={styles.pontos}>
                      <View style={[styles.ponto, { backgroundColor: feitos.leitura.has(dia) ? colors.amber : colors.border }]} />
                      <View style={[styles.ponto, { backgroundColor: feitos.estudo.has(dia) ? colors.primary : colors.border }]} />
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={styles.legenda}>
              <View style={[styles.ponto, { backgroundColor: colors.amber }]} />
              <Text style={styles.legendaTexto}>Leitura</Text>
              <View style={[styles.ponto, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendaTexto}>Estudo</Text>
              <Text style={[styles.legendaTexto, styles.flex, styles.direita]}>Leitura em {ultimos28} dos últimos 28 dias</Text>
            </View>
            <Text style={styles.texto}>O mais importante não é o horário, a duração nem o assunto, mas a regularidade.</Text>
            <LinkFonte fonte={FONTES.regularidade} />
          </Cartao>
        </Animated.View>

        {/* O estudo: o que está rodando, ou o próximo horário e o assunto já escolhido */}
        <Animated.View entering={entrada(3)}>
          <Cartao style={styles.gap}>
            <Text style={styles.etiqueta}>ESTUDO PESSOAL</Text>
            {minutosRodando !== null ? (
              <>
                <Text style={styles.medio}>Estudo em andamento · {minutosRodando} min</Text>
                <Button label="Continuar" icon="play" onPress={() => router.push("/estudo/sessao")} fullWidth />
              </>
            ) : (
              <>
                <Text style={styles.medio}>{assuntoDaVez ? assuntoDaVez.titulo : "Nenhum assunto escolhido"}</Text>
                <Text style={styles.texto}>
                  {proximoEstudo ? `Próximo na rotina: ${proximoEstudo}` : "Sem horário de estudo na rotina."}
                  {assuntoDaVez ? "" : " Escolha o assunto antes, para não gastar a hora do estudo nisso."}
                </Text>
                <Button label="Começar estudo" icon="play" onPress={() => router.push("/estudo/sessao")} fullWidth />
                <Text style={styles.texto}>Sem vontade? Comece com 10 minutos.</Text>
              </>
            )}
          </Cartao>
        </Animated.View>

        <Animated.View entering={entrada(4)}>
          <Cartao>
            <LinhaLink icone="sunny-outline" titulo="Texto do dia" detalhe="Biblioteca On-line" url={LINKS.textoDoDia} />
            <LinhaLink icone="people-outline" titulo="Reuniões desta semana" detalhe="A apostila e A Sentinela, na Biblioteca On-line" url={LINKS.reunioes()} />
          </Cartao>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingHorizontal: 16, gap: 14 },
    flex: { flex: 1 },
    gap: { gap: 10 },
    linha: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    botoes: { flexDirection: "row", gap: 10 },
    etiqueta: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.8, color: colors.textMuted },
    grande: { fontSize: 22, fontWeight: "900", color: colors.text, letterSpacing: -0.3 },
    medio: { fontSize: 17, fontWeight: "800", color: colors.text },
    texto: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
    status: { fontSize: 13.5, fontWeight: "800", color: colors.textSecondary },
    acao: { fontSize: 13.5, fontWeight: "800", color: colors.primary },
    dica: { flexDirection: "row", gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
    dicaTexto: { fontSize: 13.5, lineHeight: 19, color: colors.text, marginBottom: 4 },
    semana: { flexDirection: "row", gap: 6 },
    diaSemana: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
    diaHoje: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.surface },
    diaNome: { fontSize: 11, fontWeight: "700", color: colors.textSecondary },
    diaNumero: { fontSize: 15, fontWeight: "900", color: colors.text },
    diaHojeTexto: { color: colors.primary },
    pontos: { flexDirection: "row", gap: 3 },
    ponto: { width: 7, height: 7, borderRadius: 4 },
    legenda: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendaTexto: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
    direita: { textAlign: "right" },
  });
