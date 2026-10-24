import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { usePerfilEstudo } from "@/api/hooks/useEstudo";
import type { PerfilEstudo } from "@/api/types";
import { Cartao, LinkFonte, useLeitura } from "@/components/estudo/comum";
import { FONTES } from "@/components/estudo/dicas";
import { Fichas } from "@/components/estudo/folhas";
import { CATEGORIAS, inicioParaHoje, lidosDo, PROGRAMA_COMECE, PROGRAMA_JW, trechosJw } from "@/components/estudo/programas";
import { SeletorDia } from "@/components/ministerio/escolhas";
import { Topo } from "@/components/ministerio/kit";
import { Button, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

type Plano = PerfilEstudo["plano"];

const PLANOS: { valor: Plano; titulo: string; texto: string; fonte?: (typeof FONTES)[keyof typeof FONTES] }[] = [
  {
    valor: "jw",
    titulo: "Programa de leitura do jw.org",
    texto: `${PROGRAMA_JW.length} grupos de capítulos em 11 categorias. Um grupo por dia lê a Bíblia inteira em um ano.`,
    fonte: FONTES.projetoLeitura,
  },
  {
    valor: "comece",
    titulo: "Comece sua leitura da Bíblia",
    texto: `${PROGRAMA_COMECE.length} trechos por tema, do livro Seja Feliz para Sempre!. Para quem está começando.`,
    fonte: FONTES.comece,
  },
  { valor: "reuniao", titulo: "Leitura semanal da reunião", texto: "A leitura da apostila de cada semana, da programação importada no app." },
  { valor: "livre", titulo: "Leitura livre", texto: "Escolha o livro e marque os capítulos que ler." },
];

const OPCOES = [
  { valor: "tudo", rotulo: "Toda a Bíblia" },
  { valor: "vermelho", rotulo: "Vermelho: Israel" },
  { valor: "azul", rotulo: "Azul: congregação" },
  { valor: "cat", rotulo: "Por assunto" },
];

const EXPLICA: Record<string, string> = {
  tudo: "Pela ordem dos livros, do Gênesis ao Apocalipse.",
  vermelho: "Os grupos com o marcador vermelho dão uma visão histórica geral dos tratos de Deus com os israelitas.",
  azul: "Os grupos com o marcador azul dão uma visão cronológica geral do desenvolvimento da congregação cristã.",
  cat: "Leia os livros por assunto, com base nas categorias do programa.",
};

/** Escolher o programa de leitura, o ritmo e o dia de começar. As datas de cada trecho saem disso. */
export default function ProgramaEstudo() {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const { estado } = useLeitura();
  const salvar = usePerfilEstudo();
  const [plano, setPlano] = useState<Plano>("jw");
  const [opcao, setOpcao] = useState("tudo");
  const [ritmo, setRitmo] = useState(1);
  const [dia, setDia] = useState("");
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (!estado || pronto) return;
    setPlano(estado.perfil.plano);
    setOpcao(estado.perfil.opcao);
    setRitmo(estado.perfil.ritmo);
    setDia(estado.hoje);
    setPronto(true);
  }, [estado, pronto]);

  if (!estado) return <Topo titulo="Programa de leitura" inicio="/estudo" />;

  const comData = plano === "jw" || plano === "comece";
  const grupoOpcao = opcao.startsWith("cat:") ? "cat" : opcao;

  const ok = () => {
    // O próximo trecho ainda não lido cai no dia escolhido; o que já foi lido continua marcado.
    const lista = plano === "comece" ? PROGRAMA_COMECE : trechosJw(opcao);
    const lidos = lidosDo(estado.leituras, plano);
    const indice = Math.max(0, lista.findIndex((t) => !lidos.has(t.id)));
    salvar.mutate(
      { plano, opcao, ritmo, ...(comData ? { inicio: inicioParaHoje(indice, ritmo, dia) } : {}) },
      {
        onSuccess: () => {
          toast.show("Programa de leitura salvo");
          router.back();
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para salvar", "error"),
      },
    );
  };

  return (
    <View style={styles.tela}>
      <Topo titulo="Programa de leitura" inicio="/estudo" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {PLANOS.map((pl) => {
          const ativo = plano === pl.valor;
          return (
            <Pressable key={pl.valor} onPress={() => setPlano(pl.valor)} accessibilityRole="radio" accessibilityState={{ selected: ativo }}>
              <Cartao style={[styles.gap, ativo && styles.ativo]}>
                <View style={styles.linha}>
                  <Ionicons name={ativo ? "radio-button-on" : "radio-button-off"} size={22} color={ativo ? colors.primary : colors.textMuted} />
                  <Text style={[styles.titulo, styles.flex]}>{pl.titulo}</Text>
                </View>
                <Text style={styles.texto}>{pl.texto}</Text>
                {pl.fonte ? <LinkFonte fonte={pl.fonte} /> : null}
                {ativo && pl.valor === "jw" ? (
                  <View style={styles.gap}>
                    <Fichas opcoes={OPCOES} valor={grupoOpcao} onMudar={(v) => setOpcao(v === "cat" ? "cat:0" : v)} />
                    <Text style={styles.texto}>{EXPLICA[grupoOpcao]}</Text>
                    {grupoOpcao === "cat"
                      ? CATEGORIAS.map((c, i) => {
                          const marcada = opcao === `cat:${i}`;
                          return (
                            <Pressable
                              key={i}
                              onPress={() => setOpcao(`cat:${i}`)}
                              style={[styles.categoria, marcada && styles.categoriaAtiva]}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: marcada }}
                            >
                              <Text style={[styles.categoriaNome, marcada && styles.categoriaNomeAtiva]}>{c.nome}</Text>
                              <Text style={[styles.categoriaLivros, marcada && styles.categoriaNomeAtiva]}>{c.livros}</Text>
                            </Pressable>
                          );
                        })
                      : null}
                  </View>
                ) : null}
              </Cartao>
            </Pressable>
          );
        })}

        {comData ? (
          <Cartao style={styles.gap}>
            <Text style={styles.titulo}>Ritmo</Text>
            <Fichas
              opcoes={[
                { valor: 1, rotulo: "Um por dia" },
                { valor: 2, rotulo: "A cada 2 dias" },
                { valor: 3, rotulo: "A cada 3 dias" },
              ]}
              valor={ritmo}
              onMudar={setRitmo}
            />
            <Text style={styles.texto}>Se o ritmo de um por dia for pesado, leia cada grupo em dois ou três dias.</Text>
            <LinkFonte fonte={FONTES.todoDia} />
            <Text style={[styles.titulo, styles.topo]}>Começar em</Text>
            <SeletorDia valor={dia} onMudar={setDia} sentido="futuro" quantos={14} />
            <Text style={styles.texto}>O próximo trecho ainda não lido cai nesse dia. O que já foi lido continua marcado.</Text>
          </Cartao>
        ) : null}

        <Button label="Salvar" icon="checkmark" onPress={ok} loading={salvar.isPending} fullWidth />
      </ScrollView>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
    flex: { flex: 1 },
    gap: { gap: 10 },
    topo: { marginTop: 6 },
    linha: { flexDirection: "row", alignItems: "center", gap: 10 },
    ativo: { borderColor: colors.primary, borderWidth: 2 },
    titulo: { fontSize: 16.5, fontWeight: "800", color: colors.text },
    texto: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
    categoria: { padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
    categoriaAtiva: { backgroundColor: colors.primary, borderColor: colors.primary },
    categoriaNome: { fontSize: 14.5, fontWeight: "800", color: colors.text },
    categoriaLivros: { fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
    categoriaNomeAtiva: { color: colors.textOnPrimary },
  });
