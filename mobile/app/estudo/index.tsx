import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useMarcarLeitura, usePerfilEstudo } from "@/api/hooks/useEstudo";
import type { EstadoEstudo, PerfilEstudo, RotinaEstudo } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { rotuloParte } from "@/components/estudo/biblia";
import { CarregandoOuErro, LinkFonte, useAbrir, useLeitura, useLerEMarcar } from "@/components/estudo/comum";
import { DICAS_LEITURA, FONTES, LINKS } from "@/components/estudo/dicas";
import { inicioParaHoje, nomeDoPlano, proximoCapituloLivre, somarDias, type Marca, type Trecho } from "@/components/estudo/programas";
import { heroiEstudo, SERIFA } from "@/components/estudo/tema";
import { CabecalhoAmbiente } from "@/components/layout/Ambientes";
import { dataLonga, entrada, type Icone, TituloTela, useRecuo } from "@/components/ministerio/kit";
import { Button, useToast } from "@/components/ui";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { usePuxar } from "@/utils/usePuxar";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const INICIAIS = ["S", "T", "Q", "Q", "S", "S", "D"];

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

/** Quantos dias seguidos com leitura até hoje (ou até ontem, se hoje ainda não leu). */
function sequencia(lidos: Set<string>, hoje: string) {
  let dia = lidos.has(hoje) ? hoje : somarDias(hoje, -1);
  let n = 0;
  while (lidos.has(dia)) {
    n += 1;
    dia = somarDias(dia, -1);
  }
  return n;
}

/** "amanhã", "em 3 dias". */
const daquiA = (dias: number) => (dias <= 1 ? "amanhã" : `em ${dias} dias`);

/**
 * O Hoje do Estudo pessoal. Um destaque só, a leitura do dia no cartão vinho com a passagem em
 * letra de livro, e em volta, separados: a dica, a leitura da reunião, a semana, o estudo e os
 * atalhos do jw.org.
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

  const marcarLido = (plano: PerfilEstudo["plano"], t: Pick<Trecho, "id" | "titulo">) => {
    marcar.mutate({ plano, itens: [t.id] }, { onError: () => toast.show("Não deu para marcar", "error") });
    feito({ titulo: "Leitura marcada", detalhe: t.titulo, icone: "checkmark-done" });
  };

  const naoComecou = (p.plano === "jw" || p.plano === "comece") && !p.inicio;
  const livre = p.plano === "livre" ? proximoCapituloLivre(estado.leituras) : null;
  const trechoLivre: Trecho | null = livre ? { id: `${livre.livro}:${livre.de}`, titulo: rotuloParte(livre), partes: [livre] } : null;
  const prox = leitura.proximo;
  const hojeTrecho = trechoLivre ?? prox?.trecho ?? null;

  return (
    <View style={styles.tela}>
      {/* Um vinho bem leve atrás do topo: a tela ganha profundidade sem disputar com o cartão. */}
      <LinearGradient colors={[`${colors.primary}1F`, `${colors.primary}00`]} style={styles.lavagem} pointerEvents="none" />
      <CabecalhoAmbiente atual="estudo" />
      <ScrollView contentContainerStyle={[styles.scroll, recuo]} refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}>
        <TituloTela titulo="Hoje" subtitulo={dataLonga(new Date(a, m - 1, d))} />

        <Animated.View entering={entrada(0)}>
          <LeituraDeHoje
            perfil={p}
            naoComecou={naoComecou}
            trecho={hojeTrecho}
            livre={!!livre}
            prox={livre ? null : prox}
            total={leitura.trechos.length}
            lidos={leitura.trechos.reduce((n, t) => n + (leitura.lidos.has(t.id) ? 1 : 0), 0)}
            leuHoje={feitos.leitura.has(hoje)}
            semanaLida={p.plano === "reuniao" && !!hojeTrecho && leitura.lidos.has(hojeTrecho.id)}
            onLer={(t) => abrirLeitura(p.plano, t)}
            onMarcar={(t) => marcarLido(p.plano, t)}
            onReprogramar={(indice) => perfil.mutate({ inicio: inicioParaHoje(indice, p.ritmo, hoje) })}
          />
        </Animated.View>

        {hojeTrecho && !naoComecou ? (
          <Animated.View entering={entrada(1)} style={styles.dica}>
            <View style={styles.dicaIcone}>
              <Ionicons name="sparkles" size={16} color={colors.amber} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.dicaTitulo}>Para ler melhor</Text>
              <Text style={styles.dicaTexto}>{dica.texto}</Text>
              <LinkFonte fonte={dica.fonte} />
            </View>
          </Animated.View>
        ) : null}

        {/* A leitura da semana da reunião, quando o programa é outro. */}
        {leitura.semana && p.plano !== "reuniao" ? (
          <Animated.View entering={entrada(2)} style={styles.reuniao}>
            <View style={styles.reuniaoIcone}>
              <Ionicons name="people" size={18} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.rotulo}>Leitura da reunião</Text>
              <Text style={styles.reuniaoTitulo}>{leitura.semana.titulo}</Text>
            </View>
            {leitura.semanaLida ? (
              <View style={styles.lida}>
                <Ionicons name="checkmark-circle" size={18} color={colors.green} />
                <Text style={[styles.lidaTexto, { color: colors.green }]}>Lida</Text>
              </View>
            ) : leitura.semana.partes.length ? (
              <View style={styles.reuniaoAcoes}>
                <Pressable
                  onPress={() => abrirLeitura("reuniao", leitura.semana!)}
                  style={({ pressed }) => [styles.pilulaLer, pressed && styles.pressionado]}
                  accessibilityRole="button"
                  accessibilityLabel={`Ler ${leitura.semana.titulo}`}
                >
                  <Text style={styles.pilulaLerTexto}>Ler</Text>
                </Pressable>
                <Pressable
                  onPress={() => marcarLido("reuniao", leitura.semana!)}
                  style={({ pressed }) => [styles.botaoMarcar, pressed && styles.pressionado]}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Marcar a leitura da reunião como lida"
                >
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                </Pressable>
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        <Animated.View entering={entrada(3)}>
          <SuaSemana hoje={hoje} feitos={feitos} />
        </Animated.View>

        <Animated.View entering={entrada(4)}>
          <Estudo estado={estado} />
        </Animated.View>

        <Animated.View entering={entrada(5)} style={styles.secaoBloco}>
          <Text style={styles.secaoTitulo} accessibilityRole="header">
            No jw.org hoje
          </Text>
          <View style={styles.atalhos}>
            <Atalho icone="sunny" titulo="Texto do dia" detalhe="Biblioteca On-line" url={LINKS.textoDoDia} />
            <Atalho icone="people" titulo="Reuniões da semana" detalhe="Apostila e Sentinela" url={LINKS.reunioes()} />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/**
 * O destaque da tela: a leitura de hoje no degradê vinho da marca, com a passagem em letra de
 * livro e o progresso do programa em dourado. Feita a de hoje, ele comemora e mostra a próxima.
 */
function LeituraDeHoje({
  perfil: p,
  naoComecou,
  trecho,
  livre,
  prox,
  total,
  lidos,
  leuHoje,
  semanaLida,
  onLer,
  onMarcar,
  onReprogramar,
}: {
  perfil: PerfilEstudo;
  naoComecou: boolean;
  trecho: Trecho | null;
  livre: boolean;
  prox: { trecho: Trecho; indice: number; atraso: number } | null;
  total: number;
  lidos: number;
  leuHoje: boolean;
  /** No programa da reunião: a leitura desta semana já foi marcada. */
  semanaLida: boolean;
  onLer: (t: Trecho) => void;
  onMarcar: (t: Trecho) => void;
  onReprogramar: (indice: number) => void;
}) {
  const { esquema, styles } = useTema(criarEstilos);
  const h = heroiEstudo(esquema);
  const programa = () => router.push("/estudo/programa");
  // Leu a de hoje e a próxima é de outro dia: o cartão comemora em vez de pedir de novo.
  const feitaHoje = !!trecho && !livre && p.plano !== "reuniao" && leuHoje && !!prox && prox.atraso < 0;
  const feita = feitaHoje || semanaLida;
  const comProgresso = !!trecho && !livre && p.plano !== "reuniao" && total > 0;

  const botaoClaro = (rotulo: string, icone: Icone, onPress: () => void) => (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.heroiBotao, { backgroundColor: h.texto }, pressed && styles.pressionado]} accessibilityRole="button">
      <Ionicons name={icone} size={18} color={h.botaoTexto} />
      <Text style={[styles.heroiBotaoTexto, { color: h.botaoTexto }]}>{rotulo}</Text>
    </Pressable>
  );
  const botaoContorno = (rotulo: string, icone: Icone, onPress: () => void) => (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.heroiBotao, styles.heroiContorno, { borderColor: h.suave }, pressed && styles.pressionado]} accessibilityRole="button">
      <Ionicons name={icone} size={18} color={h.texto} />
      <Text style={[styles.heroiBotaoTexto, { color: h.texto }]}>{rotulo}</Text>
    </Pressable>
  );

  return (
    <LinearGradient colors={h.fundo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroi}>
      {/* O livro grande e apagado no canto: a marca do ambiente como textura. */}
      <Ionicons name="book" size={170} color={h.texto} style={styles.heroiMarca} accessibilityElementsHidden importantForAccessibility="no" />

      <View style={styles.heroiTopo}>
        <View style={[styles.heroiSelo, { backgroundColor: h.vidro }]}>
          <Ionicons name={feita ? "checkmark-circle" : "book-outline"} size={13} color={feita ? h.ouro : h.texto} />
          <Text style={[styles.heroiSeloTexto, { color: h.texto }]}>
            {semanaLida ? "LEITURA DA SEMANA FEITA" : feitaHoje ? "LEITURA DE HOJE FEITA" : p.plano === "reuniao" ? "LEITURA DA SEMANA" : "LEITURA DE HOJE"}
          </Text>
        </View>
        {trecho?.marca && !feita ? <MarcaNoHeroi marca={trecho.marca} fundo={h.texto} texto={h.botaoTexto} /> : null}
      </View>

      {naoComecou ? (
        <>
          <Text style={[styles.heroiTitulo, { color: h.texto }]}>Comece a ler a Bíblia</Text>
          <Text style={[styles.heroiTexto, { color: h.suave }]}>
            Escolha um programa. Um trecho por dia lê a Bíblia inteira em um ano, e dá para ir mais devagar.
          </Text>
          <View style={styles.heroiBotoes}>{botaoClaro("Escolher programa", "book-outline", programa)}</View>
        </>
      ) : !trecho ? (
        <>
          <Text style={[styles.heroiTitulo, { color: h.texto }]}>
            {p.plano === "reuniao" ? "A programação da semana ainda não chegou" : "Programa concluído!"}
          </Text>
          <Text style={[styles.heroiTexto, { color: h.suave }]}>
            {p.plano === "reuniao"
              ? "Assim que a reunião for importada, a leitura da semana aparece aqui."
              : `Você leu tudo do ${nomeDoPlano(p)}. Que tal começar outro?`}
          </Text>
          <View style={styles.heroiBotoes}>{botaoClaro("Escolher outro programa", "book-outline", programa)}</View>
        </>
      ) : feita ? (
        <>
          <Text style={[styles.heroiPrograma, { color: h.suave }]} numberOfLines={1}>
            {semanaLida ? "Já marcada nesta semana" : `Próxima, ${daquiA(-prox!.atraso)}`}
          </Text>
          <Text style={[styles.heroiTitulo, { color: h.texto }]}>{trecho.titulo}</Text>
          {comProgresso ? <Progresso lidos={lidos} total={total} cores={h} /> : null}
          <View style={styles.heroiBotoes}>{botaoContorno(semanaLida ? "Ler de novo" : "Ler adiantado", "book-outline", () => onLer(trecho))}</View>
        </>
      ) : (
        <>
          <Text style={[styles.heroiPrograma, { color: h.suave }]} numberOfLines={1}>
            {nomeDoPlano(p)}
          </Text>
          <Text style={[styles.heroiTitulo, { color: h.texto }]}>{trecho.titulo}</Text>
          {trecho.detalhe ? <Text style={[styles.heroiTexto, { color: h.suave }]}>{trecho.detalhe}</Text> : null}
          {comProgresso ? <Progresso lidos={lidos} total={total} cores={h} /> : null}
          {prox && !livre && p.plano !== "reuniao" ? (
            <View style={styles.heroiSituacao}>
              <View style={[styles.heroiChip, { backgroundColor: prox.atraso > 0 ? h.ouro : h.vidro }]}>
                <Ionicons name={prox.atraso > 0 ? "alert-circle" : "time-outline"} size={13} color={prox.atraso > 0 ? h.botaoTexto : h.texto} />
                <Text style={[styles.heroiChipTexto, { color: prox.atraso > 0 ? h.botaoTexto : h.texto }]}>
                  {prox.atraso > 0
                    ? `Atrasada ${prox.atraso} ${prox.atraso === 1 ? "dia" : "dias"}`
                    : prox.atraso < 0
                      ? `Adiantada ${-prox.atraso} ${prox.atraso === -1 ? "dia" : "dias"}`
                      : "Para hoje"}
                </Text>
              </View>
              {prox.atraso > 0 ? (
                <Text style={[styles.heroiLink, { color: h.texto }]} onPress={() => onReprogramar(prox.indice)} accessibilityRole="button">
                  Reprogramar a partir de hoje
                </Text>
              ) : null}
            </View>
          ) : null}
          <View style={styles.heroiBotoes}>
            {botaoClaro("Ler", "book", () => onLer(trecho))}
            {botaoContorno("Marcar como lido", "checkmark", () => onMarcar(trecho))}
          </View>
        </>
      )}
    </LinearGradient>
  );
}

/** O marcador do programa do jw.org no cartão vinho: pílula creme, com a cor e o nome. */
function MarcaNoHeroi({ marca, fundo, texto }: { marca: Marca; fundo: string; texto: string }) {
  const { colors, styles } = useTema(criarEstilos);
  const cor = marca === "vermelho" ? colors.red : colors.teal;
  return (
    <View style={[styles.heroiMarcador, { backgroundColor: fundo }]}>
      <View style={[styles.ponto, { backgroundColor: cor }]} />
      <Text style={[styles.heroiMarcadorTexto, { color: texto }]}>{marca === "vermelho" ? "Israel" : "Congregação"}</Text>
    </View>
  );
}

/** "37 de 365 · 10%", com a barra dourada. */
function Progresso({ lidos, total, cores }: { lidos: number; total: number; cores: ReturnType<typeof heroiEstudo> }) {
  const { styles } = useTema(criarEstilos);
  const fracao = total ? Math.min(1, lidos / total) : 0;
  return (
    <View style={styles.progresso} accessibilityLabel={`${lidos} de ${total} trechos lidos`}>
      <View style={[styles.progressoTrilho, { backgroundColor: cores.trilho }]}>
        <View style={[styles.progressoCheio, { width: `${Math.max(fracao * 100, fracao > 0 ? 2 : 0)}%`, backgroundColor: cores.ouro }]} />
      </View>
      <Text style={[styles.progressoTexto, { color: cores.suave }]}>
        {lidos} de {total} · {Math.round(fracao * 100)}%
      </Text>
    </View>
  );
}

/**
 * A semana de segunda a domingo: o dia com leitura fica dourado, o de estudo ganha o ponto vinho, e
 * hoje tem o contorno. Em cima, os dias seguidos; embaixo, o mês e a frase da regularidade.
 */
function SuaSemana({ hoje, feitos }: { hoje: string; feitos: { leitura: Set<string>; estudo: Set<string> } }) {
  const { colors, styles } = useTema(criarEstilos);
  const [a, m, d] = hoje.split("-").map(Number);
  const segunda = somarDias(hoje, -((new Date(a, m - 1, d).getDay() + 6) % 7));
  const semana = Array.from({ length: 7 }, (_, i) => somarDias(segunda, i));
  const ultimos28 = Array.from({ length: 28 }, (_, i) => somarDias(hoje, -i)).filter((dia) => feitos.leitura.has(dia)).length;
  const seguidos = sequencia(feitos.leitura, hoje);

  return (
    <View style={styles.secaoBloco}>
      <View style={styles.secaoLinha}>
        <Text style={styles.secaoTitulo} accessibilityRole="header">
          Sua semana
        </Text>
        {seguidos >= 2 ? (
          <View style={styles.seguidos}>
            <Ionicons name="flame" size={14} color={colors.amber} />
            <Text style={styles.seguidosTexto}>{seguidos} dias seguidos</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cartao}>
        <View style={styles.semana}>
          {semana.map((dia, i) => {
            const ehHoje = dia === hoje;
            const futuro = dia > hoje;
            const leu = feitos.leitura.has(dia);
            const estudou = feitos.estudo.has(dia);
            const [, , dd] = dia.split("-").map(Number);
            return (
              <View
                key={dia}
                style={[styles.dia, futuro && styles.diaFuturo]}
                accessibilityLabel={`${DIAS_SEMANA[(i + 1) % 7]} ${dd}${leu ? ", leu" : ""}${estudou ? ", estudou" : ""}${ehHoje ? ", hoje" : ""}`}
              >
                <Text style={[styles.diaInicial, ehHoje && { color: colors.primary }]}>{INICIAIS[i]}</Text>
                <View style={[styles.diaCirculo, leu && styles.diaLido, ehHoje && styles.diaHoje]}>
                  <Text style={[styles.diaNumero, leu && styles.diaNumeroLido]}>{dd}</Text>
                </View>
                <View style={[styles.diaEstudo, estudou && { backgroundColor: colors.primary }]} />
              </View>
            );
          })}
        </View>
        <View style={styles.divisor} />
        <View style={styles.semanaRodape}>
          <View style={styles.legenda}>
            <View style={[styles.legendaLido]} />
            <Text style={styles.legendaTexto}>Leitura</Text>
            <View style={[styles.ponto, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendaTexto}>Estudo</Text>
          </View>
          <Text style={styles.mes}>
            <Text style={styles.mesNumero}>{ultimos28}</Text> de 28 dias com leitura
          </Text>
        </View>
        <View style={styles.frase}>
          <Text style={styles.fraseTexto}>“O mais importante não é o horário nem a duração, mas a regularidade.”</Text>
          <LinkFonte fonte={FONTES.regularidade} />
        </View>
      </View>
    </View>
  );
}

/** O estudo: o que está rodando, ou o assunto da vez com o próximo horário da rotina. */
function Estudo({ estado }: { estado: EstadoEstudo }) {
  const { colors, styles } = useTema(criarEstilos);
  const p = estado.perfil;
  const assuntoDaVez = [...estado.assuntos].reverse().find((s) => !s.estudadoEm) ?? null;
  const proximoEstudo = proximaVez(estado.rotina, "estudo");
  const minutosRodando = p.sessaoInicio ? Math.max(0, Math.round((Date.now() - new Date(p.sessaoInicio).getTime()) / 60000)) : null;

  return (
    <View style={styles.secaoBloco}>
      <View style={styles.secaoLinha}>
        <Text style={styles.secaoTitulo} accessibilityRole="header">
          Estudo pessoal
        </Text>
        <Pressable onPress={() => router.replace("/estudo/assuntos")} hitSlop={8} accessibilityRole="button">
          <Text style={styles.secaoAcao}>Assuntos</Text>
        </Pressable>
      </View>
      <View style={[styles.cartao, styles.estudo]}>
        {minutosRodando !== null ? (
          <>
            <View style={styles.rodando}>
              <View style={styles.rodandoPonto} />
              <Text style={styles.rotulo}>Estudo em andamento</Text>
            </View>
            <Text style={styles.estudoTitulo}>{minutosRodando} min</Text>
            <Button label="Continuar" icon="play" onPress={() => router.push("/estudo/sessao")} fullWidth />
          </>
        ) : (
          <>
            <Text style={styles.rotulo}>{assuntoDaVez ? "Próximo assunto" : "Nenhum assunto escolhido"}</Text>
            <Text style={assuntoDaVez ? styles.estudoTitulo : styles.estudoVazio}>
              {assuntoDaVez ? assuntoDaVez.titulo : "Escolha antes o que estudar, para não gastar a hora disso."}
            </Text>
            <View style={styles.estudoMeta}>
              <Ionicons name="alarm-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.estudoMetaTexto}>{proximoEstudo ? `Na rotina: ${proximoEstudo}` : "Sem horário de estudo na rotina"}</Text>
            </View>
            <View style={styles.estudoBotoes}>
              <Button label="Começar estudo" icon="play" onPress={() => router.push("/estudo/sessao")} style={styles.flex} />
              {!assuntoDaVez ? (
                <Button label="Escolher" icon="list" variant="secondary" onPress={() => router.replace("/estudo/assuntos")} style={styles.flex} />
              ) : null}
            </View>
            <Text style={styles.estudoDica}>Sem vontade? Comece com 10 minutos.</Text>
          </>
        )}
      </View>
    </View>
  );
}

/** Um atalho do jw.org ou da Biblioteca On-line. */
function Atalho({ icone, titulo, detalhe, url }: { icone: Icone; titulo: string; detalhe: string; url: string }) {
  const { colors, styles } = useTema(criarEstilos);
  const abrir = useAbrir();
  return (
    <Pressable onPress={() => abrir(url)} style={({ pressed }) => [styles.cartao, styles.atalho, pressed && styles.pressionado]} accessibilityRole="link">
      <View style={styles.atalhoTopo}>
        <View style={styles.atalhoIcone}>
          <Ionicons name={icone} size={18} color={colors.primary} />
        </View>
        <Ionicons name="open-outline" size={15} color={colors.textMuted} />
      </View>
      <Text style={styles.atalhoTitulo}>{titulo}</Text>
      <Text style={styles.atalhoDetalhe}>{detalhe}</Text>
    </Pressable>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    lavagem: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },
    scroll: { paddingHorizontal: 16, gap: 16 },
    flex: { flex: 1 },
    pressionado: { opacity: 0.8, transform: [{ scale: 0.98 }] },
    ponto: { width: 8, height: 8, borderRadius: 4 },
    rotulo: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", color: colors.textMuted },

    // O destaque: a leitura de hoje.
    heroi: { borderRadius: 28, padding: 20, gap: 10, overflow: "hidden", ...shadow.raised },
    heroiMarca: { position: "absolute", right: -26, bottom: -30, opacity: 0.08, transform: [{ rotate: "-14deg" }] },
    heroiTopo: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    heroiSelo: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
    heroiSeloTexto: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.8 },
    heroiMarcador: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
    heroiMarcadorTexto: { fontSize: 12, fontWeight: "800" },
    heroiPrograma: { fontSize: 13.5, fontWeight: "600", marginTop: 6 },
    heroiTitulo: { fontFamily: SERIFA, fontSize: 31, fontWeight: "700", lineHeight: 37, letterSpacing: -0.3 },
    heroiTexto: { fontSize: 14.5, lineHeight: 21 },
    heroiSituacao: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
    heroiChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
    heroiChipTexto: { fontSize: 12.5, fontWeight: "800" },
    heroiLink: { fontSize: 13.5, fontWeight: "800", textDecorationLine: "underline" },
    heroiBotoes: { flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap" },
    heroiBotao: {
      flexGrow: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      minHeight: 48,
      paddingHorizontal: 16,
      borderRadius: radius.pill,
    },
    heroiContorno: { borderWidth: 1.5 },
    heroiBotaoTexto: { fontSize: 15.5, fontWeight: "800" },
    progresso: { gap: 6, marginTop: 4 },
    progressoTrilho: { height: 6, borderRadius: 3, overflow: "hidden" },
    progressoCheio: { height: 6, borderRadius: 3 },
    progressoTexto: { fontSize: 12.5, fontWeight: "700" },

    // A dica, com o dourado de lado.
    dica: {
      flexDirection: "row",
      gap: 12,
      padding: 14,
      borderRadius: radius.lg,
      backgroundColor: colors.warningBg,
      borderLeftWidth: 3,
      borderLeftColor: colors.amber,
    },
    dicaIcone: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
    dicaTitulo: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", color: colors.warningStrong, marginBottom: 2 },
    dicaTexto: { fontSize: 14.5, lineHeight: 20.5, color: colors.text, marginBottom: 6 },

    // A leitura da reunião, numa linha.
    reuniao: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    reuniaoIcone: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.infoBg },
    reuniaoTitulo: { fontFamily: SERIFA, fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 2 },
    reuniaoAcoes: { flexDirection: "row", alignItems: "center", gap: 8 },
    pilulaLer: { paddingHorizontal: 16, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
    pilulaLerTexto: { fontSize: 14, fontWeight: "800", color: colors.textOnPrimary },
    botaoMarcar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.borderStrong },
    lida: { flexDirection: "row", alignItems: "center", gap: 4 },
    lidaTexto: { fontSize: 13, fontWeight: "800" },

    // Seções.
    secaoBloco: { gap: 10 },
    secaoLinha: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
    secaoTitulo: { fontSize: 19, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
    secaoAcao: { fontSize: 14, fontWeight: "700", color: colors.primary },
    cartao: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 16, ...shadow.card },
    divisor: { height: 1, backgroundColor: colors.border, marginVertical: 14 },

    // A semana.
    seguidos: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.warningBg },
    seguidosTexto: { fontSize: 12.5, fontWeight: "800", color: colors.warningStrong },
    semana: { flexDirection: "row", justifyContent: "space-between" },
    dia: { alignItems: "center", gap: 6, flex: 1 },
    diaFuturo: { opacity: 0.45 },
    diaInicial: { fontSize: 11.5, fontWeight: "800", color: colors.textMuted },
    diaCirculo: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted },
    diaLido: { backgroundColor: colors.amber },
    diaHoje: { borderWidth: 2, borderColor: colors.primary },
    diaNumero: { fontSize: 14, fontWeight: "800", color: colors.textSecondary },
    diaNumeroLido: { color: colors.surface },
    diaEstudo: { width: 6, height: 6, borderRadius: 3, backgroundColor: "transparent" },
    semanaRodape: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
    legenda: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendaLido: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.amber },
    legendaTexto: { fontSize: 12.5, fontWeight: "700", color: colors.textSecondary, marginRight: 6 },
    mes: { fontSize: 13, color: colors.textSecondary },
    mesNumero: { fontSize: 15, fontWeight: "900", color: colors.text },
    frase: { marginTop: 12, gap: 4 },
    fraseTexto: { fontFamily: SERIFA, fontStyle: "italic", fontSize: 14.5, lineHeight: 21, color: colors.textSecondary },

    // O estudo.
    estudo: { gap: 8, backgroundColor: colors.surface },
    estudoTitulo: { fontFamily: SERIFA, fontSize: 21, fontWeight: "700", lineHeight: 27, color: colors.text },
    estudoVazio: { fontSize: 15, fontWeight: "600", lineHeight: 21, color: colors.textSecondary },
    estudoMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
    estudoMetaTexto: { fontSize: 13.5, color: colors.textSecondary },
    estudoBotoes: { flexDirection: "row", gap: 10, marginTop: 6 },
    estudoDica: { fontSize: 12.5, color: colors.textMuted, textAlign: "center" },
    rodando: { flexDirection: "row", alignItems: "center", gap: 8 },
    rodandoPonto: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },

    // Os atalhos do jw.org.
    atalhos: { flexDirection: "row", gap: 12 },
    atalho: { flex: 1, gap: 4, padding: 14 },
    atalhoTopo: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 },
    atalhoIcone: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.infoBg },
    atalhoTitulo: { fontSize: 15, fontWeight: "800", color: colors.text },
    atalhoDetalhe: { fontSize: 12.5, color: colors.textSecondary },
  });
