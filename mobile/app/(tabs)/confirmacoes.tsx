import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  useConfirmacoes,
  useRegistrarConfirmacao,
  useSalvarTelefone,
} from "@/api/hooks/useConfirmacoes";
import type { ParteParaConfirmar, ReuniaoParaConfirmar } from "@/api/types";
import { EmptyState, GradientHeader, Loading, Sheet, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { podeGerenciar } from "@/utils/permissoes";
import { radius, shadow, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { useBarraFlutuante } from "@/components/layout/contextoRolagem";

/**
 * "71999998888" -> "(71) 99999-8888".
 *
 * Serve para LER e para DIGITAR — a mesma função nos dois lugares, senão o número apareceria
 * de um jeito no rótulo e de outro no campo. O que se grava continua só dígitos: o backend
 * descarta a pontuação, e guardar a máscara quebraria o link do WhatsApp lá na frente.
 *
 * Formata em qualquer estágio, inclusive incompleto, porque é aplicada a cada tecla.
 */
function mascaraTelefone(bruto: string | null): string {
  const digitos = String(bruto ?? "").replace(/\D/g, "");
  // O 55 do Brasil não se digita: ele é acrescentado na hora de montar o link. Guardado no
  // banco por quem digitou antes, some daqui para não ocupar o lugar do DDD.
  const semPais = digitos.startsWith("55") && digitos.length > 11 ? digitos.slice(2) : digitos;
  const d = semPais.slice(0, 11);

  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;

  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;

  // Celular tem 9 dígitos, fixo tem 8 — o hífen muda de lugar conforme o número cresce.
  const corte = resto.length > 8 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/**
 * Confirmação das partes de estudante.
 *
 * A rotina que esta tela substitui: toda semana alguém fala com quem tem Leitura da Bíblia e
 * parte do "Faça Seu Melhor no Ministério" para saber se está tudo certo, e anota quem
 * confirmou. Só essas partes entram — as outras são de irmãos com designação fixa.
 *
 * Restrita ao escopo `confirmacoes` (e ao admin geral). O backend exige o mesmo na LEITURA,
 * não só na escrita: a lista carrega telefone (dentro do link de WhatsApp) e quem recusou.
 */

const SALA_ROTULO: Record<string, string> = {
  principal: "Salão principal",
  salaB: "Sala B",
};

/** "03/09/2026" -> "Quinta, 03/09". O dia da semana ajuda mais que o ano. */
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
function dataLegivel(data: string): string {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(data);
  if (!m) return data;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (Number.isNaN(d.getTime())) return data;
  return `${DIAS[d.getDay()]}, ${m[1]}/${m[2]}`;
}

export default function ConfirmacoesScreen() {
  // Chamado UMA vez, no topo: o ScrollView abaixo mora dentro de um condicional
  // (carregando / vazio / lista), e espalhar o hook lá dentro o tornaria uma
  // chamada condicional — proibido, e quebra na primeira troca de estado.
  const { rolagem, recuo } = useBarraFlutuante();
  const { colors, styles } = useTema(criarEstilos);
  const { usuario } = useAuth();
  const toast = useToast();
  const podeVer = podeGerenciar(usuario, "confirmacoes");

  const [passadas, setPassadas] = useState(false);
  const { data, isLoading, isError, refetch, isRefetching } = useConfirmacoes(
    podeVer,
    passadas,
  );
  const registrar = useRegistrarConfirmacao();
  const [compartilhando, setCompartilhando] = useState<ParteParaConfirmar | null>(null);
  /** O formulário do número está aberto? E com o que dentro. */
  const [editandoNumero, setEditandoNumero] = useState(false);
  const [numero, setNumero] = useState("");
  const salvarTelefone = useSalvarTelefone();

  /**
   * Abre a folha SEMPRE com o formulário fechado.
   *
   * Sem isto, abrir a folha de um irmão logo depois de cadastrar o número de outro traria o
   * campo aberto e preenchido com o número alheio — pronto para ser salvo na ficha errada.
   */
  const abrirFolha = (parte: ParteParaConfirmar) => {
    setEditandoNumero(false);
    setNumero(mascaraTelefone(parte.telefone));
    setCompartilhando(parte);
  };

  const fecharFolha = () => {
    setCompartilhando(null);
    setEditandoNumero(false);
  };

  /**
   * Aplica a máscara a cada tecla.
   *
   * O `if` existe por causa do APAGAR: quando o dedo apaga um caractere da máscara — o
   * parêntese, o espaço, o hífen —, a contagem de dígitos não muda, e remascarar devolveria
   * o caractere na hora. O campo ficaria travado, como se o backspace não funcionasse. Nesse
   * caso, apaga-se o último DÍGITO, que é o que a pessoa quis dizer.
   */
  const aoDigitarNumero = (texto: string) => {
    const novos = texto.replace(/\D/g, "");
    const antes = numero.replace(/\D/g, "");
    const finais = texto.length < numero.length && novos === antes ? novos.slice(0, -1) : novos;
    setNumero(mascaraTelefone(finais));
  };

  const gravarNumero = async () => {
    if (!compartilhando?.irmaoId) return;
    try {
      const { irmao } = await salvarTelefone.mutateAsync({
        irmaoId: compartilhando.irmaoId,
        telefone: numero,
      });
      toast.show(irmao.telefone ? "Número salvo!" : "Número removido.");
      // A folha fecha: a lista precisa recarregar para o link do WhatsApp vir montado pelo
      // backend, e manter a folha aberta mostraria o estado velho.
      fecharFolha();
    } catch (erro) {
      toast.show(erro instanceof Error ? erro.message : "Não deu para salvar", "error");
    }
  };

  const responder = (parte: ParteParaConfirmar, confirmou: boolean | null) => {
    registrar.mutate(
      { data: parte.data, campo: parte.campo, nome: parte.nome, confirmou },
      {
        onError: (err) =>
          toast.show(
            err instanceof Error ? err.message : "Não consegui salvar",
            "error",
          ),
      },
    );
  };

  const compartilharTexto = async (parte: ParteParaConfirmar) => {
    setCompartilhando(null);
    // Fecha a folha ANTES do share do sistema: no iOS, apresentar um por cima do outro
    // saindo derruba um dos dois. Mesmo cuidado do CompartilharReuniaoSheet.
    setTimeout(() => {
      Share.share({ message: parte.texto }).catch(() => {});
    }, 350);
  };

  const abrirWhatsApp = async (parte: ParteParaConfirmar) => {
    if (!parte.whatsapp) return;
    setCompartilhando(null);
    try {
      await Linking.openURL(parte.whatsapp);
    } catch {
      toast.show("Não consegui abrir o WhatsApp", "error");
    }
  };

  if (!podeVer) {
    return (
      <View style={styles.tela}>
        <GradientHeader
          title="Confirmações"
          description="Acesso restrito"
          icon="lock-closed"
        />
        <EmptyState
          icon="lock-closed-outline"
          title="Área restrita"
          message="Esta tela é de quem cuida das confirmações das partes. Fale com um administrador se precisar de acesso."
        />
      </View>
    );
  }

  const reunioes = data?.reunioes ?? [];
  const pendentes = reunioes.reduce(
    (soma, r) => soma + (r.total - r.confirmadas - r.recusadas),
    0,
  );

  return (
    <View style={styles.tela}>
      <GradientHeader
        title="Confirmações"
        description={
          isLoading
            ? "Carregando..."
            : pendentes === 0
              ? "Tudo confirmado por aqui"
              : `${pendentes} ${pendentes === 1 ? "parte esperando resposta" : "partes esperando resposta"}`
        }
        icon="checkmark-done"
      />

      {isLoading ? (
        <Loading />
      ) : (
        <ScrollView
          {...rolagem}
          contentContainerStyle={[styles.scroll, recuo]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
        >
          <View style={styles.filtros}>
            {([false, true] as const).map((op) => {
              const ativo = passadas === op;
              return (
                <Pressable
                  key={String(op)}
                  onPress={() => setPassadas(op)}
                  style={[styles.filtro, ativo && styles.filtroAtivo]}
                >
                  <Text style={[styles.filtroTexto, ativo && styles.filtroTextoAtivo]}>
                    {op ? "Todas" : "Próximas"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {isError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Não consegui carregar"
              message="Confira a conexão e puxe a tela para baixo para tentar de novo."
            />
          ) : reunioes.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title={passadas ? "Nenhuma parte encontrada" : "Nada pela frente"}
              message={
                passadas
                  ? "Quando uma programação for importada, as partes de estudante aparecem aqui."
                  : 'Nenhuma reunião à frente com partes de estudante. Toque em "Todas" para ver o histórico.'
              }
            />
          ) : (
            reunioes.map((reuniao, i) => (
              <GrupoReuniao
                key={reuniao.data}
                reuniao={reuniao}
                index={i}
                onResponder={responder}
                onCompartilhar={abrirFolha}
              />
            ))
          )}
        </ScrollView>
      )}

      <Sheet visible={!!compartilhando} onClose={fecharFolha} scroll>
        {compartilhando ? (
          <View style={styles.folha}>
            <Text style={styles.folhaTitulo}>Falar com {compartilhando.nome}</Text>
            <Text style={styles.folhaTexto}>{compartilhando.texto}</Text>

            {/* Com número: abre a conversa. Sem número, mas com ficha no cadastro: o MESMO
                botão vira "Cadastrar número", no mesmo lugar. Sem ficha nenhuma não há onde
                gravar, e aí só resta explicar. */}
            {compartilhando.whatsapp ? (
              <>
                <Pressable style={styles.opcao} onPress={() => abrirWhatsApp(compartilhando)}>
                  <View style={[styles.opcaoIcone, { backgroundColor: colors.successBg }]}>
                    <Ionicons name="logo-whatsapp" size={20} color={colors.greenDark} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.opcaoTitulo}>Abrir no WhatsApp</Text>
                    <Text style={styles.opcaoDescricao}>
                      Vai direto para a conversa, com a mensagem já escrita
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>

                {compartilhando.irmaoId && !editandoNumero ? (
                  <Pressable
                    style={styles.editarNumero}
                    onPress={() => setEditandoNumero(true)}
                    hitSlop={6}
                  >
                    <Ionicons name="create-outline" size={14} color={colors.primaryDark} />
                    <Text style={styles.editarNumeroTexto}>
                      Editar número ({mascaraTelefone(compartilhando.telefone)})
                    </Text>
                  </Pressable>
                ) : null}
              </>
            ) : compartilhando.irmaoId && !editandoNumero ? (
              <Pressable style={styles.opcao} onPress={() => setEditandoNumero(true)}>
                <View style={[styles.opcaoIcone, { backgroundColor: colors.successBg }]}>
                  <Ionicons name="logo-whatsapp" size={20} color={colors.greenDark} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.opcaoTitulo}>Cadastrar número de WhatsApp</Text>
                  <Text style={styles.opcaoDescricao}>
                    Depois de salvar, a conversa abre direto daqui
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ) : !compartilhando.irmaoId ? (
              <View style={styles.semNumero}>
                <Ionicons name="information-circle-outline" size={17} color={colors.textMuted} />
                <Text style={styles.semNumeroTexto}>
                  Este nome não foi encontrado no cadastro — ou casou com mais de uma pessoa.
                  Cadastre a pessoa em Publicadores para poder guardar o número aqui.
                </Text>
              </View>
            ) : null}

            {/* O formulário, logo abaixo do botão que o abriu. */}
            {editandoNumero && compartilhando.irmaoId ? (
              <View style={styles.formulario}>
                {/* O nome da FICHA, não o da programação: o casamento é por semelhança, e
                    quem vai salvar precisa ver em quem está mexendo antes de confirmar. */}
                <Text style={styles.formularioAlvo}>
                  Salvando na ficha de{" "}
                  <Text style={styles.formularioNome}>{compartilhando.irmaoNome}</Text>
                </Text>

                <View style={styles.campoLinha}>
                  <TextInput
                    style={styles.campo}
                    value={numero}
                    onChangeText={aoDigitarNumero}
                    placeholder="(71) 99999-8888"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    autoFocus
                    maxLength={15}
                    accessibilityLabel="Número de WhatsApp com DDD"
                  />
                  <Pressable
                    style={[styles.salvar, salvarTelefone.isPending && styles.pressionado]}
                    onPress={gravarNumero}
                    disabled={salvarTelefone.isPending}
                  >
                    {salvarTelefone.isPending ? (
                      <ActivityIndicator size="small" color={colors.textOnPrimary} />
                    ) : (
                      <Text style={styles.salvarTexto}>Salvar</Text>
                    )}
                  </Pressable>
                </View>

                <Text style={styles.formularioAjuda}>
                  Com DDD. O 55 do Brasil entra sozinho.
                </Text>
              </View>
            ) : null}

            <Pressable style={styles.opcao} onPress={() => compartilharTexto(compartilhando)}>
              <View style={[styles.opcaoIcone, { backgroundColor: colors.infoBg }]}>
                <Ionicons name="share-social-outline" size={20} color={colors.primaryDark} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.opcaoTitulo}>Compartilhar mensagem</Text>
                <Text style={styles.opcaoDescricao}>
                  Escolha o aplicativo e o contato na hora de enviar
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

function GrupoReuniao({
  reuniao,
  index,
  onResponder,
  onCompartilhar,
}: {
  reuniao: ReuniaoParaConfirmar;
  index: number;
  onResponder: (parte: ParteParaConfirmar, confirmou: boolean | null) => void;
  onCompartilhar: (parte: ParteParaConfirmar) => void;
}) {
  const { colors, styles } = useTema(criarEstilos);
  const pendentes = reuniao.total - reuniao.confirmadas - reuniao.recusadas;

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 50, 250)).duration(240)}
      style={styles.grupo}
    >
      <View style={styles.grupoTopo}>
        <View style={[styles.grupoIcone, { backgroundColor: colors.infoBg }]}>
          <Ionicons name="calendar" size={15} color={colors.primaryDark} />
        </View>
        <View style={styles.flex}>
          {/* A semana vem ACIMA e menor, como sobrancelha: ela é o contexto. A data da
              reunião é o assunto, e fica com o peso. */}
          <Text style={styles.grupoFaixa}>{reuniao.faixaData}</Text>
          <Text style={styles.grupoData}>{dataLegivel(reuniao.data)}</Text>
        </View>
        {/* O chip ficou sobre a faixa tonalizada, e não mais sobre o branco do cartão: a
            borda na própria cor devolve o contraste que o fundo comeu. */}
        <View
          style={[
            styles.contador,
            {
              backgroundColor: pendentes === 0 ? colors.successBg : colors.warningBg,
              borderColor: pendentes === 0 ? `${colors.greenDark}33` : `${colors.amber}33`,
            },
          ]}
        >
          <Text
            style={[
              styles.contadorTexto,
              { color: pendentes === 0 ? colors.greenDark : colors.amber },
            ]}
          >
            {pendentes === 0 ? "Tudo respondido" : `${pendentes} pendente(s)`}
          </Text>
        </View>
      </View>

      {reuniao.partes.map((parte) => (
        <LinhaParte
          key={`${parte.campo}__${parte.nome}`}
          parte={parte}
          onResponder={onResponder}
          onCompartilhar={onCompartilhar}
        />
      ))}
    </Animated.View>
  );
}

function LinhaParte({
  parte,
  onResponder,
  onCompartilhar,
}: {
  parte: ParteParaConfirmar;
  onResponder: (parte: ParteParaConfirmar, confirmou: boolean | null) => void;
  onCompartilhar: (parte: ParteParaConfirmar) => void;
}) {
  const { colors, styles } = useTema(criarEstilos);

  // Tocar de novo no botão já marcado desmarca: errar o toque não pode obrigar a pessoa a
  // apagar o registro em outro lugar.
  const alternar = (valor: boolean) =>
    onResponder(parte, parte.confirmou === valor ? null : valor);

  return (
    <View style={styles.linha}>
      <View style={styles.flex}>
        <Text style={styles.nome}>{parte.nome}</Text>
        <Text style={styles.parteTexto} numberOfLines={2}>
          {parte.titulo || parte.parte} · {SALA_ROTULO[parte.sala] ?? parte.sala}
        </Text>
      </View>

      <Pressable
        onPress={() => onCompartilhar(parte)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Falar com ${parte.nome}`}
        style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.primaryDark} />
      </Pressable>

      <Pressable
        onPress={() => alternar(true)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ selected: parte.confirmou === true }}
        accessibilityLabel={`${parte.nome} confirmou`}
        style={({ pressed }) => [
          styles.botao,
          parte.confirmou === true && { backgroundColor: colors.successBg },
          pressed && styles.pressionado,
        ]}
      >
        <Ionicons
          name={parte.confirmou === true ? "checkmark-circle" : "checkmark-circle-outline"}
          size={19}
          color={parte.confirmou === true ? colors.greenDark : colors.textMuted}
        />
      </Pressable>

      <Pressable
        onPress={() => alternar(false)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ selected: parte.confirmou === false }}
        accessibilityLabel={`${parte.nome} não vai cumprir`}
        style={({ pressed }) => [
          styles.botao,
          parte.confirmou === false && { backgroundColor: colors.dangerBg },
          pressed && styles.pressionado,
        ]}
      >
        <Ionicons
          name={parte.confirmou === false ? "close-circle" : "close-circle-outline"}
          size={19}
          color={parte.confirmou === false ? colors.redDark : colors.textMuted}
        />
      </Pressable>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    scroll: { padding: 16, gap: 14 },

    filtros: { flexDirection: "row", gap: 8 },
    filtro: {
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
    },
    filtroAtivo: { backgroundColor: colors.primary },
    filtroTexto: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
    filtroTextoAtivo: { color: colors.textOnPrimary },

    grupo: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 14,
      // Sem `gap`: as linhas de nome se encostam e a divisória entre elas basta. Com o gap,
      // a borda da primeira linha ficava solta alguns pixels abaixo da faixa, parecendo
      // um risco perdido no meio do cartão.
      ...shadow.card,
    },
    /**
     * O cabeçalho é uma FAIXA, não um texto maior.
     *
     * Diferença de tamanho e peso sozinha não bastava: "Quinta, 03/09" em 15.5/800 ao lado
     * dos nomes em 14.5/600 lia como mais um nome da lista, um pouco mais escuro. Com fundo
     * próprio, ícone e a semana em versalete, o olho separa a moldura do conteúdo antes de
     * ler qualquer palavra.
     *
     * As margens negativas cancelam o padding do cartão para a faixa atravessá-lo inteiro; o
     * padding daqui devolve o recuo do texto. O raio de cima repete o do cartão em vez de
     * recortar por `overflow: hidden`, que no iOS apagaria a sombra junto.
     */
    grupoTopo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginHorizontal: -14,
      marginTop: -14,
      paddingHorizontal: 14,
      paddingVertical: 11,
      backgroundColor: colors.surfaceMuted,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
    },
    grupoIcone: {
      width: 30,
      height: 30,
      borderRadius: radius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    grupoFaixa: {
      fontSize: 10.5,
      fontWeight: "700",
      letterSpacing: 0.7,
      textTransform: "uppercase",
      color: colors.textMuted,
    },
    grupoData: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: -0.3,
      marginTop: 1,
    },
    contador: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.sm, borderWidth: 1 },
    contadorTexto: { fontSize: 11.5, fontWeight: "800" },

    linha: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 9,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    nome: { fontSize: 14.5, fontWeight: "600", color: colors.text },
    parteTexto: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
    botao: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
    },
    pressionado: { opacity: 0.55 },

    folha: { gap: spacing.md, paddingBottom: 4 },
    folhaTitulo: { fontSize: 19, fontWeight: "800", color: colors.text },
    folhaTexto: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      padding: 12,
    },
    opcao: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      padding: 12,
    },
    opcaoIcone: {
      width: 38,
      height: 38,
      borderRadius: radius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    opcaoTitulo: { fontSize: 15, fontWeight: "700", color: colors.text },
    opcaoDescricao: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
    semNumero: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 2 },
    semNumeroTexto: { flex: 1, fontSize: 12.5, color: colors.textMuted, lineHeight: 17 },

    editarNumero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 2,
      marginTop: -4,
    },
    editarNumeroTexto: { fontSize: 12.5, color: colors.primaryDark, fontWeight: "600" },

    formulario: {
      gap: 8,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      padding: 12,
    },
    formularioAlvo: { fontSize: 12.5, color: colors.textSecondary },
    formularioNome: { fontWeight: "700", color: colors.text },
    campoLinha: { flexDirection: "row", alignItems: "center", gap: 8 },
    campo: {
      flex: 1,
      height: 44,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      fontSize: 15,
      color: colors.text,
    },
    salvar: {
      height: 44,
      minWidth: 84,
      borderRadius: radius.sm,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
    },
    salvarTexto: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 14.5 },
    formularioAjuda: { fontSize: 11.5, color: colors.textMuted },
  });
