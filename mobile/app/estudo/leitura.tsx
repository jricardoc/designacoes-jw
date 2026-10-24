import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, View } from "react-native";
import { useMarcarLeitura } from "@/api/hooks/useEstudo";
import { LIVROS } from "@/components/estudo/biblia";
import { CarregandoOuErro, Cartao, diaCurtoDe, LinkFonte, SeloMarca, useAbrir, useLeitura, useLerEMarcar, wolDe } from "@/components/estudo/comum";
import { DICAS_LEITURA, FONTES } from "@/components/estudo/dicas";
import { JoiaSheet } from "@/components/estudo/folhas";
import { capitulosLidos, nomeDoPlano, type Trecho } from "@/components/estudo/programas";
import { CabecalhoAmbiente } from "@/components/layout/Ambientes";
import { MenuAcoes, Segmentos, TituloTela, useRecuo, type Acao } from "@/components/ministerio/kit";
import { Button } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { usePuxar } from "@/utils/usePuxar";

const RITMO = { 1: "Um trecho por dia", 2: "Um trecho a cada 2 dias", 3: "Um trecho a cada 3 dias" } as Record<number, string>;

/**
 * A Leitura: o programa escolhido, trecho por trecho, com a data planejada e o quadrículo (como no
 * PDF do jw.org), e "Você lembra onde parou?", os 66 livros com o que já foi lido.
 */
export default function LeituraEstudo() {
  const { colors, styles } = useTema(criarEstilos);
  const recuo = useRecuo();
  const { estado, leitura, reunioes, isLoading, refetch } = useLeitura();
  const puxar = usePuxar(refetch);
  const abrir = useAbrir();
  const ler = useLerEMarcar();
  const marcar = useMarcarLeitura();
  const [aba, setAba] = useState<"programa" | "livros">("programa");
  const [menu, setMenu] = useState<Trecho | null>(null);
  const [joia, setJoia] = useState<Trecho | null>(null);

  const lidosCap = useMemo(() => (estado ? capitulosLidos(estado.leituras, reunioes) : new Set<string>()), [estado, reunioes]);
  const secoes = useMemo(() => {
    const r: { titulo: string; data: Trecho[] }[] = [];
    for (const t of leitura?.trechos ?? []) {
      const ultima = r[r.length - 1];
      if (ultima && ultima.titulo === (t.grupo ?? "")) ultima.data.push(t);
      else r.push({ titulo: t.grupo ?? "", data: [t] });
    }
    return r;
  }, [leitura?.trechos]);

  if (!estado || !leitura) {
    return (
      <View style={styles.tela}>
        <CabecalhoAmbiente atual="estudo" />
        <CarregandoOuErro carregando={isLoading} tentar={() => refetch()} />
      </View>
    );
  }

  const p = estado.perfil;
  const livre = p.plano === "livre";
  const mostrar = livre ? "livros" : aba;
  const notas = new Map(estado.leituras.filter((l) => l.plano === p.plano && l.nota).map((l) => [l.item, l.nota as string]));
  const lidos = leitura.lidos;
  const total = leitura.trechos.length;
  const feitos = leitura.trechos.filter((t) => lidos.has(t.id)).length;
  const ultimo = leitura.trechos[total - 1];
  const naoComecou = (p.plano === "jw" || p.plano === "comece") && !p.inicio;

  const acoesDe = (t: Trecho): Acao[] => {
    const lido = lidos.has(t.id);
    const leituras: Acao[] = (t.passagens ?? t.partes.map((parte) => ({ texto: t.titulo, parte }))).map((ps) => ({
      rotulo: t.passagens && t.passagens.length > 1 ? `Ler ${ps.texto}` : "Ler no JW Library",
      icone: "book" as const,
      onPress: () => ler(p.plano, t, ps.parte),
    }));
    return [
      ...leituras,
      ...(t.partes[0] ? [{ rotulo: "Abrir na Biblioteca On-line", icone: "globe-outline" as const, onPress: () => abrir(wolDe(t.partes[0])) }] : []),
      {
        rotulo: lido ? "Desmarcar" : "Marcar como lido",
        icone: lido ? ("close-circle-outline" as const) : ("checkmark-circle-outline" as const),
        onPress: () => marcar.mutate({ plano: p.plano, itens: [t.id], lido: !lido }),
      },
      { rotulo: notas.has(t.id) ? "Ver a joia espiritual" : "Anotar uma joia espiritual", icone: "diamond-outline", onPress: () => setJoia(t) },
    ];
  };

  const cabecalho = (
    <View style={styles.cabecalho}>
      <TituloTela titulo="Leitura da Bíblia" subtitulo={nomeDoPlano(p)} />
      {livre ? null : (
        <Segmentos
          opcoes={[
            { valor: "programa", rotulo: "Programa", icone: "list" },
            { valor: "livros", rotulo: "Onde parei", icone: "grid" },
          ]}
          valor={aba}
          onMudar={setAba}
        />
      )}
      {mostrar === "programa" ? (
        <Cartao style={styles.gap}>
          {naoComecou ? (
            <>
              <Text style={styles.medio}>Escolha o ritmo e o dia de começar</Text>
              <Text style={styles.texto}>As datas de cada trecho se preenchem sozinhas, como a coluna “Data” do programa do jw.org.</Text>
            </>
          ) : (
            <>
              <View style={styles.linha}>
                <Text style={[styles.medio, styles.flex]}>
                  {feitos} de {total} {p.plano === "reuniao" ? "semanas" : "trechos"}
                </Text>
                <Text style={styles.porcento}>{total ? Math.round((feitos / total) * 100) : 0}%</Text>
              </View>
              <View style={styles.barra}>
                <View style={[styles.barraCheia, { width: `${total ? (feitos / total) * 100 : 0}%` }]} />
              </View>
              {p.plano === "jw" || p.plano === "comece" ? (
                <Text style={styles.texto}>
                  {RITMO[p.ritmo]}
                  {ultimo?.data ? ` · termina em ${ultimo.data.split("-").reverse().join("/")}` : ""}
                </Text>
              ) : null}
            </>
          )}
          <Button label={naoComecou ? "Escolher programa" : "Trocar o programa"} icon="options-outline" variant={naoComecou ? "primary" : "secondary"} onPress={() => router.push("/estudo/programa")} fullWidth />
          <View style={styles.dica}>
            <Text style={styles.dicaTexto}>{DICAS_LEITURA[2].texto}</Text>
            <LinkFonte fonte={FONTES.maisProveito} />
          </View>
        </Cartao>
      ) : null}
    </View>
  );

  if (mostrar === "programa") {
    return (
      <View style={styles.tela}>
        <CabecalhoAmbiente atual="estudo" />
        <SectionList
          sections={secoes}
          keyExtractor={(t) => t.id}
          ListHeaderComponent={cabecalho}
          contentContainerStyle={[styles.scroll, recuo]}
          refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}
          stickySectionHeadersEnabled={false}
          initialNumToRender={20}
          renderSectionHeader={({ section }) => (section.titulo ? <Text style={styles.secao}>{section.titulo}</Text> : null)}
          renderItem={({ item: t }) => {
            const lido = lidos.has(t.id);
            const atual = leitura.proximo?.trecho.id === t.id;
            return (
              <Pressable
                onPress={() => setMenu(t)}
                style={({ pressed }) => [styles.linhaTrecho, atual && styles.linhaAtual, pressed && styles.pressionado]}
                accessibilityRole="button"
                accessibilityHint="Abre as opções: ler, marcar, anotar"
              >
                <Pressable
                  onPress={() => marcar.mutate({ plano: p.plano, itens: [t.id], lido: !lido })}
                  hitSlop={10}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: lido }}
                  accessibilityLabel={`${t.titulo}: ${lido ? "lido" : "não lido"}`}
                >
                  <Ionicons name={lido ? "checkbox" : "square-outline"} size={24} color={lido ? colors.green : colors.textMuted} />
                </Pressable>
                <View style={styles.flex}>
                  <Text style={[styles.trechoTitulo, lido && styles.trechoLido]}>{t.titulo}</Text>
                  {t.detalhe || t.data ? (
                    <Text style={styles.trechoDetalhe} numberOfLines={2}>
                      {[t.data && p.plano !== "reuniao" ? diaCurtoDe(t.data) : null, t.detalhe].filter(Boolean).join(" · ")}
                    </Text>
                  ) : null}
                </View>
                {notas.has(t.id) ? <Ionicons name="diamond" size={14} color={colors.amber} accessibilityLabel="Tem joia anotada" /> : null}
                <SeloMarca marca={t.marca} />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            p.plano === "reuniao" ? <Text style={styles.texto}>A programação da reunião ainda não foi importada no app.</Text> : null
          }
        />
        <MenuAcoes visible={!!menu} onClose={() => setMenu(null)} titulo={menu?.titulo} subtitulo={menu?.detalhe} acoes={menu ? acoesDe(menu) : []} />
        <JoiaSheet
          visible={!!joia}
          onClose={() => setJoia(null)}
          plano={p.plano}
          item={joia?.id ?? ""}
          titulo={joia?.titulo ?? ""}
          nota={joia ? (notas.get(joia.id) ?? null) : null}
        />
      </View>
    );
  }

  // "Você lembra onde parou?": os 66 livros, com os capítulos lidos em todos os programas.
  const blocos = [
    { titulo: "Escrituras Hebraico-Aramaicas", de: 1, ate: 39 },
    { titulo: "Escrituras Gregas Cristãs", de: 40, ate: 66 },
  ];
  return (
    <View style={styles.tela}>
      <CabecalhoAmbiente atual="estudo" />
      <ScrollView contentContainerStyle={[styles.scroll, recuo]} refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}>
        {cabecalho}
        <Text style={styles.texto}>
          Você lembra onde parou? Os capítulos lidos em qualquer programa aparecem aqui. Toque num livro para ler e marcar capítulo por capítulo.
        </Text>
        {blocos.map((b) => (
          <View key={b.titulo} style={styles.gap}>
            <Text style={styles.secao}>{b.titulo}</Text>
            <View style={styles.grade}>
              {LIVROS.slice(b.de - 1, b.ate).map((l, i) => {
                const n = b.de + i;
                let lidosNoLivro = 0;
                for (let c = 1; c <= l.capitulos; c++) if (lidosCap.has(`${n}:${c}`)) lidosNoLivro += 1;
                const fracao = lidosNoLivro / l.capitulos;
                return (
                  <Pressable
                    key={n}
                    onPress={() => router.push({ pathname: "/estudo/livro", params: { n: String(n) } })}
                    style={({ pressed }) => [styles.livro, fracao === 1 && styles.livroCompleto, pressed && styles.pressionado]}
                    accessibilityRole="button"
                    accessibilityLabel={`${l.nome}: ${lidosNoLivro} de ${l.capitulos} capítulos lidos`}
                  >
                    <Text style={[styles.livroNome, fracao === 1 && styles.livroNomeCompleto]} numberOfLines={2}>
                      {l.nome}
                    </Text>
                    <Text style={[styles.livroConta, fracao === 1 && styles.livroNomeCompleto]}>
                      {lidosNoLivro}/{l.capitulos}
                    </Text>
                    <View style={styles.livroBarra}>
                      <View style={[styles.livroBarraCheia, { width: `${fracao * 100}%` }]} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingHorizontal: 16, gap: 12 },
    cabecalho: { gap: 12, marginBottom: 4 },
    flex: { flex: 1 },
    gap: { gap: 10 },
    pressionado: { opacity: 0.7 },
    linha: { flexDirection: "row", alignItems: "center", gap: 8 },
    medio: { fontSize: 17, fontWeight: "800", color: colors.text },
    texto: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
    porcento: { fontSize: 15, fontWeight: "900", color: colors.primary },
    barra: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    barraCheia: { height: 8, borderRadius: 4, backgroundColor: colors.amber },
    dica: { padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, gap: 4 },
    dicaTexto: { fontSize: 13.5, lineHeight: 19, color: colors.text },
    secao: { fontSize: 13, fontWeight: "800", letterSpacing: 0.6, color: colors.textMuted, marginTop: 10, marginBottom: 6, textTransform: "uppercase" },
    linhaTrecho: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 11,
      paddingHorizontal: 12,
      marginBottom: 6,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    linhaAtual: { borderColor: colors.primary, borderWidth: 2 },
    trechoTitulo: { fontSize: 15.5, fontWeight: "800", color: colors.text },
    trechoLido: { color: colors.textMuted },
    trechoDetalhe: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
    grade: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    livro: {
      width: "31.5%",
      minHeight: 74,
      padding: 10,
      gap: 4,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "space-between",
    },
    livroCompleto: { backgroundColor: colors.primary, borderColor: colors.primary },
    livroNome: { fontSize: 13, fontWeight: "800", color: colors.text },
    livroNomeCompleto: { color: colors.textOnPrimary },
    livroConta: { fontSize: 11.5, fontWeight: "700", color: colors.textSecondary },
    livroBarra: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    livroBarraCheia: { height: 4, borderRadius: 2, backgroundColor: colors.amber },
  });
