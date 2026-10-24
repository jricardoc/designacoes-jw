import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApagarAssunto, useApagarEstudo, useSalvarAssunto, useSessaoEstudo } from "@/api/hooks/useEstudo";
import type { AssuntoEstudo, SessaoEstudo, TipoAssunto } from "@/api/types";
import { nomeDoLivro } from "@/components/estudo/biblia";
import { CarregandoOuErro, Cartao, diaCurtoDe, LinhaLink, LinkFonte, useAbrir, useLeitura } from "@/components/estudo/comum";
import { FONTES, LINKS, TIPOS_ASSUNTO } from "@/components/estudo/dicas";
import { AssuntoSheet, RegistrarEstudoSheet } from "@/components/estudo/folhas";
import { PROGRAMA_COMECE, PROGRAMA_JW, semanasDaReuniao } from "@/components/estudo/programas";
import { CabecalhoAmbiente } from "@/components/layout/Ambientes";
import { MenuAcoes, Segmentos, TituloTela, useRecuo, type Acao } from "@/components/ministerio/kit";
import { Button, TextField, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { usePuxar } from "@/utils/usePuxar";

const IDEIAS = (Object.keys(TIPOS_ASSUNTO) as TipoAssunto[]).filter((t) => TIPOS_ASSUNTO[t].ideia);

/** Uma anotação da linha do tempo: o resumo de um estudo ou a joia de uma leitura. */
type Anotacao = { chave: string; dia: string; sessao?: SessaoEstudo; joia?: { titulo: string; nota: string } };

/**
 * O Estudo: a lista do que estudar (escolhida antes, como pedem os artigos), as ideias de estudo,
 * a pesquisa na Biblioteca On-line e as anotações (resumos dos estudos e joias das leituras).
 */
export default function AssuntosEstudo() {
  const { colors, styles } = useTema(criarEstilos);
  const recuo = useRecuo();
  const toast = useToast();
  const abrir = useAbrir();
  const { estado, reunioes, isLoading, refetch } = useLeitura();
  const puxar = usePuxar(refetch);
  const salvar = useSalvarAssunto();
  const apagar = useApagarAssunto();
  const apagarEstudo = useApagarEstudo();
  const sessao = useSessaoEstudo();
  const [aba, setAba] = useState<"assuntos" | "anotacoes">("assuntos");
  const [folha, setFolha] = useState<{ assunto?: AssuntoEstudo; inicial?: { tipo?: TipoAssunto; titulo?: string; link?: string } } | null>(null);
  const [menu, setMenu] = useState<AssuntoEstudo | null>(null);
  const [menuEstudo, setMenuEstudo] = useState<SessaoEstudo | null>(null);
  const [registrar, setRegistrar] = useState(false);
  const [busca, setBusca] = useState("");

  /** As anotações por data: os resumos dos estudos e as joias das leituras. */
  const anotacoes = useMemo((): Anotacao[] => {
    if (!estado) return [];
    const semanas = semanasDaReuniao(reunioes);
    const tituloDe = (plano: string, item: string) => {
      if (plano === "jw") return PROGRAMA_JW.find((t) => t.id === item)?.titulo;
      if (plano === "comece") return PROGRAMA_COMECE.find((t) => t.id === item)?.titulo;
      if (plano === "reuniao") return semanas.find((t) => t.id === item)?.titulo ?? "Leitura da semana";
      const [l, c] = item.split(":").map(Number);
      return `${nomeDoLivro(l)} ${c}`;
    };
    return [
      ...estado.sessoes.map((s) => ({ chave: `s${s.id}`, dia: s.dia, sessao: s })),
      ...estado.leituras.filter((l) => l.nota).map((l) => ({ chave: `l${l.plano}${l.item}`, dia: l.dia, joia: { titulo: tituloDe(l.plano, l.item) ?? "", nota: l.nota! } })),
    ].sort((a, b) => b.dia.localeCompare(a.dia));
  }, [estado, reunioes]);

  if (!estado) {
    return (
      <View style={styles.tela}>
        <CabecalhoAmbiente atual="estudo" />
        <CarregandoOuErro carregando={isLoading} tentar={() => refetch()} />
      </View>
    );
  }

  const pendentes = estado.assuntos.filter((a) => !a.estudadoEm).reverse();
  const estudados = estado.assuntos.filter((a) => a.estudadoEm);
  const rodando = !!estado.perfil.sessaoInicio;

  const estudarAgora = (a: AssuntoEstudo | null) => {
    if (rodando) {
      router.push("/estudo/sessao");
      return;
    }
    sessao.mutate({ acao: "iniciar", assuntoId: a?.id ?? null }, { onSuccess: () => router.push("/estudo/sessao"), onError: () => toast.show("Não deu para começar", "error") });
  };

  const acoesDe = (a: AssuntoEstudo): Acao[] => [
    { rotulo: "Estudar agora", icone: "play", onPress: () => estudarAgora(a) },
    ...(a.link ? [{ rotulo: "Abrir o link", icone: "open-outline" as const, onPress: () => abrir(a.link!) }] : []),
    { rotulo: "Editar", icone: "create-outline", onPress: () => setFolha({ assunto: a }) },
    {
      rotulo: a.estudadoEm ? "Voltar para a lista" : "Marcar como estudado",
      icone: a.estudadoEm ? "arrow-undo-outline" : "checkmark-done",
      onPress: () => salvar.mutate({ id: a.id, estudado: !a.estudadoEm }),
    },
    {
      rotulo: "Apagar",
      icone: "trash-outline",
      perigo: true,
      onPress: () =>
        Alert.alert("Apagar este assunto?", a.titulo, [
          { text: "Cancelar", style: "cancel" },
          { text: "Apagar", style: "destructive", onPress: () => apagar.mutate(a.id) },
        ]),
    },
  ];

  const linhaAssunto = (a: AssuntoEstudo) => (
    <Pressable key={a.id} onPress={() => setMenu(a)} style={({ pressed }) => [styles.assunto, pressed && styles.pressionado]} accessibilityRole="button">
      <View style={styles.assuntoIcone}>
        <Ionicons name={TIPOS_ASSUNTO[a.tipo].icone} size={18} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.assuntoTitulo, a.estudadoEm && styles.assuntoEstudado]}>{a.titulo}</Text>
        <Text style={styles.assuntoDetalhe} numberOfLines={1}>
          {[TIPOS_ASSUNTO[a.tipo].rotulo, a.nota].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {a.link ? <Ionicons name="link-outline" size={16} color={colors.textMuted} /> : null}
    </Pressable>
  );

  return (
    <View style={styles.tela}>
      <CabecalhoAmbiente atual="estudo" />
      <ScrollView contentContainerStyle={[styles.scroll, recuo]} refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />} keyboardShouldPersistTaps="handled">
        <TituloTela titulo="Estudo pessoal" subtitulo="Escolha o assunto antes; estude com regularidade" />
        <Segmentos
          opcoes={[
            { valor: "assuntos", rotulo: "Para estudar", icone: "list" },
            { valor: "anotacoes", rotulo: "Anotações", icone: "create" },
          ]}
          valor={aba}
          onMudar={setAba}
        />

        {aba === "assuntos" ? (
          <>
            <Cartao style={styles.gap}>
              {rodando ? (
                <>
                  <Text style={styles.medio}>Estudo em andamento</Text>
                  <Button label="Continuar" icon="play" onPress={() => router.push("/estudo/sessao")} fullWidth />
                </>
              ) : (
                <>
                  <Button label="Começar estudo" icon="play" onPress={() => router.push("/estudo/sessao")} fullWidth />
                  <Text style={styles.texto}>Sem vontade de estudar? Comece com dez minutos.</Text>
                  <LinkFonte fonte={FONTES.regularidade} />
                </>
              )}
            </Cartao>

            <Text style={styles.secao}>Para estudar</Text>
            <Cartao style={styles.lista}>
              {pendentes.length ? (
                pendentes.map(linhaAssunto)
              ) : (
                <View style={styles.vazio}>
                  <Text style={styles.texto}>Nada na lista. Anote artigos e assuntos que gostaria de estudar, e as perguntas que surgirem durante a semana.</Text>
                  <LinkFonte fonte={FONTES.regularidade} />
                </View>
              )}
            </Cartao>
            <Button label="Anotar assunto ou pergunta" icon="add" variant="secondary" onPress={() => setFolha({})} fullWidth />

            <Text style={styles.secao}>Ideias de estudo</Text>
            <Cartao style={styles.lista}>
              {IDEIAS.map((t) => (
                <Pressable
                  key={t}
                  onPress={() =>
                    setFolha({
                      inicial: {
                        tipo: t,
                        titulo: t === "reuniao" ? "Preparar as reuniões desta semana" : undefined,
                        link: t === "reuniao" ? LINKS.reunioes() : t === "criacao" ? FONTES.criacao.url : undefined,
                      },
                    })
                  }
                  style={({ pressed }) => [styles.assunto, pressed && styles.pressionado]}
                  accessibilityRole="button"
                  accessibilityHint="Anota na lista para estudar"
                >
                  <View style={styles.assuntoIcone}>
                    <Ionicons name={TIPOS_ASSUNTO[t].icone} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.assuntoTitulo}>{TIPOS_ASSUNTO[t].rotulo}</Text>
                    <Text style={styles.assuntoDetalhe}>{TIPOS_ASSUNTO[t].ideia}</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                </Pressable>
              ))}
              <View style={styles.rodape}>
                <LinkFonte fonte={FONTES.ideias} />
              </View>
            </Cartao>

            <Text style={styles.secao}>Pesquisar</Text>
            <Cartao style={styles.gap}>
              <TextField icon="search" placeholder="Um assunto, um texto bíblico..." value={busca} onChangeText={setBusca} returnKeyType="search" onSubmitEditing={() => busca.trim() && abrir(LINKS.pesquisar(busca))} />
              <Button label="Pesquisar na Biblioteca On-line" icon="search" variant="secondary" disabled={!busca.trim()} onPress={() => abrir(LINKS.pesquisar(busca))} fullWidth />
            </Cartao>

            <Text style={styles.secao}>Ajudas do jw.org</Text>
            <Cartao>
              {[FONTES.ajudas, FONTES.leituraEstudo, FONTES.proveito, FONTES.regularidade, FONTES.ideias, FONTES.seuEstudo, FONTES.melhorando, FONTES.comoEsta].map((f) => (
                <LinhaLink key={f.url} icone="document-text-outline" titulo={f.titulo} detalhe={f.origem} url={f.url} />
              ))}
            </Cartao>

            {estudados.length ? (
              <>
                <Text style={styles.secao}>Já estudados</Text>
                <Cartao style={styles.lista}>{estudados.slice(0, 15).map(linhaAssunto)}</Cartao>
              </>
            ) : null}
          </>
        ) : (
          <>
            <Button label="Registrar um estudo feito" icon="add" variant="secondary" onPress={() => setRegistrar(true)} fullWidth />
            {anotacoes.length ? (
              anotacoes.map((a) =>
                a.sessao ? (
                  <Pressable key={a.chave} onLongPress={() => setMenuEstudo(a.sessao ?? null)} delayLongPress={350} accessibilityHint="Toque longo para apagar">
                    <Cartao style={styles.gap}>
                      <Text style={styles.etiqueta}>
                        {diaCurtoDe(a.dia).toUpperCase()} · ESTUDO · {a.sessao.minutos} MIN
                      </Text>
                      <Text style={styles.medio}>{a.sessao.titulo ?? "Estudo pessoal"}</Text>
                      {a.sessao.resumo ? <Text style={styles.texto}>{a.sessao.resumo}</Text> : null}
                      {a.sessao.aplicacao ? (
                        <Text style={styles.texto}>
                          <Text style={styles.negrito}>Na minha vida: </Text>
                          {a.sessao.aplicacao}
                        </Text>
                      ) : null}
                    </Cartao>
                  </Pressable>
                ) : (
                  <Cartao key={a.chave} style={styles.gap}>
                    <Text style={styles.etiqueta}>{diaCurtoDe(a.dia).toUpperCase()} · JOIA DA LEITURA</Text>
                    <Text style={styles.medio}>{a.joia!.titulo}</Text>
                    <Text style={styles.texto}>{a.joia!.nota}</Text>
                  </Cartao>
                ),
              )
            ) : (
              <Text style={styles.texto}>Os resumos dos seus estudos e as joias espirituais das leituras aparecem aqui.</Text>
            )}
          </>
        )}
      </ScrollView>

      <AssuntoSheet visible={!!folha} onClose={() => setFolha(null)} assunto={folha?.assunto} inicial={folha?.inicial} />
      <RegistrarEstudoSheet visible={registrar} onClose={() => setRegistrar(false)} assuntos={estado.assuntos} />
      <MenuAcoes visible={!!menu} onClose={() => setMenu(null)} titulo={menu?.titulo} acoes={menu ? acoesDe(menu) : []} />
      <MenuAcoes
        visible={!!menuEstudo}
        onClose={() => setMenuEstudo(null)}
        titulo={menuEstudo?.titulo ?? "Estudo pessoal"}
        acoes={
          menuEstudo
            ? [
                {
                  rotulo: "Apagar este estudo",
                  icone: "trash-outline",
                  perigo: true,
                  onPress: () =>
                    Alert.alert("Apagar este estudo?", undefined, [
                      { text: "Cancelar", style: "cancel" },
                      { text: "Apagar", style: "destructive", onPress: () => apagarEstudo.mutate(menuEstudo.id) },
                    ]),
                },
              ]
            : []
        }
      />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingHorizontal: 16, gap: 12 },
    flex: { flex: 1 },
    gap: { gap: 10 },
    pressionado: { opacity: 0.7 },
    lista: { paddingVertical: 4, paddingHorizontal: 12 },
    secao: { fontSize: 13, fontWeight: "800", letterSpacing: 0.6, color: colors.textMuted, marginTop: 6, textTransform: "uppercase" },
    etiqueta: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.6, color: colors.textMuted },
    medio: { fontSize: 16.5, fontWeight: "800", color: colors.text },
    texto: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
    negrito: { fontWeight: "800", color: colors.text },
    vazio: { paddingVertical: 10, gap: 6 },
    rodape: { paddingVertical: 8 },
    assunto: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    assuntoIcone: { width: 36, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.infoBg },
    assuntoTitulo: { fontSize: 15, fontWeight: "800", color: colors.text },
    assuntoEstudado: { color: colors.textMuted, textDecorationLine: "line-through" },
    assuntoDetalhe: { fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
  });
