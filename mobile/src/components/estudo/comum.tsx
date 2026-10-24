import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Alert, AppState, Linking, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useEstudo, useMarcarLeitura } from "@/api/hooks/useEstudo";
import { useReunioes } from "@/api/hooks/useMisc";
import type { PerfilEstudo } from "@/api/types";
import { Button, EmptyState, Loading, useToast } from "@/components/ui";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { linkLer, linkWol, type Parte } from "./biblia";
import type { Fonte } from "./dicas";
import { lidosDo, proximoTrecho, semanaDeHoje, trechosDoPlano, type Marca, type Trecho } from "./programas";

/**
 * O que as telas do Estudo pessoal usam juntas: o estado do programa de leitura, abrir os links
 * (só jw.org e Biblioteca On-line) e as peças visuais repetidas.
 */

/** O programa escolhido já resolvido: os trechos, o que foi lido, o próximo e a semana da reunião. */
export function useLeitura() {
  const estudo = useEstudo();
  const { data: reunioes } = useReunioes();
  const estado = estudo.data;
  const leitura = useMemo(() => {
    if (!estado) return null;
    const trechos = trechosDoPlano(estado.perfil, reunioes);
    const lidos = lidosDo(estado.leituras, estado.perfil.plano);
    const semana = semanaDeHoje(reunioes, estado.hoje);
    return {
      trechos,
      lidos,
      proximo: proximoTrecho(trechos, lidos, estado.hoje, estado.perfil.plano),
      semana,
      semanaLida: semana ? lidosDo(estado.leituras, "reuniao").has(semana.id) : false,
    };
  }, [estado, reunioes]);
  return { ...estudo, estado, reunioes, leitura };
}

/** Abre um link do jw.org ou da Biblioteca On-line; se o celular não abrir, avisa. */
export function useAbrir() {
  const toast = useToast();
  return (url: string) => Linking.openURL(url).catch(() => toast.show("Não consegui abrir o link", "error"));
}

/**
 * "Ler" e, ao voltar para o app, a pergunta "Terminou?" com o "Marcar como lido". Quem lê no
 * JW Library sai do app; é na volta que faz sentido marcar.
 */
export function useLerEMarcar() {
  const abrir = useAbrir();
  const marcar = useMarcarLeitura();
  const pendente = useRef<{ plano: PerfilEstudo["plano"]; trecho: Trecho; saiu: boolean } | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      const p = pendente.current;
      if (!p) return;
      if (estado === "background") p.saiu = true;
      if (estado !== "active" || !p.saiu) return;
      pendente.current = null;
      Alert.alert(`Terminou ${p.trecho.titulo}?`, undefined, [
        { text: "Ainda não", style: "cancel" },
        { text: "Marcar como lido", onPress: () => marcar.mutate({ plano: p.plano, itens: [p.trecho.id] }) },
      ]);
    });
    return () => sub.remove();
  }, [marcar]);

  return (plano: PerfilEstudo["plano"], trecho: Trecho, parte: Parte | undefined = trecho.partes[0]) => {
    if (!parte) return;
    pendente.current = { plano, trecho, saiu: false };
    abrir(linkLer(parte));
  };
}

/** O capítulo de abertura na Biblioteca On-line (a Bíblia de Estudo, com as notas). */
export const wolDe = (p: Parte) => linkWol(p.livro, p.de);

/** "Sáb, 24/10". */
export function diaCurtoDe(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  const nomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return `${nomes[new Date(a, m - 1, d).getDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** Enquanto carrega, o "carregando"; se não deu, o aviso com o "tentar de novo". */
export function CarregandoOuErro({ carregando, tentar }: { carregando: boolean; tentar: () => void }) {
  if (carregando) return <Loading label="Carregando..." />;
  return (
    <EmptyState icon="cloud-offline-outline" title="Não deu para carregar" message="Confira a conexão e tente de novo.">
      <Button label="Tentar de novo" icon="refresh" onPress={tentar} />
    </EmptyState>
  );
}

/** O cartão do ambiente: papel cheio, sem vidro (é tela de ler). */
export function Cartao({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { styles } = useTema(criarEstilos);
  return <View style={[styles.cartao, style]}>{children}</View>;
}

/** O marcador do programa do jw.org, com texto: a cor sozinha não basta. */
export function SeloMarca({ marca }: { marca?: Marca }) {
  const { colors, styles } = useTema(criarEstilos);
  if (!marca) return null;
  const cor = marca === "vermelho" ? colors.red : colors.teal;
  return (
    <View style={[styles.selo, { borderColor: cor }]}>
      <View style={[styles.seloPonto, { backgroundColor: cor }]} />
      <Text style={[styles.seloTexto, { color: cor }]}>{marca === "vermelho" ? "Israel" : "Congregação"}</Text>
    </View>
  );
}

/** "Fonte: A Sentinela, nov/2024", que abre o artigo. */
export function LinkFonte({ fonte }: { fonte: Fonte }) {
  const { colors, styles } = useTema(criarEstilos);
  const abrir = useAbrir();
  return (
    <Pressable onPress={() => abrir(fonte.url)} hitSlop={6} accessibilityRole="link" accessibilityLabel={`Fonte: ${fonte.titulo}, ${fonte.origem}`}>
      <Text style={styles.fonte}>
        <Ionicons name="link-outline" size={12} color={colors.primary} /> {fonte.origem}
      </Text>
    </Pressable>
  );
}

/** Uma linha de link do jw.org ou da Biblioteca On-line ("Texto do dia", "Ajudas para Estudar"). */
export function LinhaLink({ icone, titulo, detalhe, url }: { icone: keyof typeof Ionicons.glyphMap; titulo: string; detalhe?: string; url: string }) {
  const { colors, styles } = useTema(criarEstilos);
  const abrir = useAbrir();
  return (
    <Pressable onPress={() => abrir(url)} style={({ pressed }) => [styles.linhaLink, pressed && styles.pressionado]} accessibilityRole="link">
      <View style={styles.linhaLinkIcone}>
        <Ionicons name={icone} size={18} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.linhaLinkTitulo}>{titulo}</Text>
        {detalhe ? <Text style={styles.linhaLinkDetalhe}>{detalhe}</Text> : null}
      </View>
      <Ionicons name="open-outline" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1 },
    pressionado: { opacity: 0.7 },
    cartao: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 16, ...shadow.card },
    selo: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1 },
    seloPonto: { width: 6, height: 6, borderRadius: 3 },
    seloTexto: { fontSize: 11, fontWeight: "800" },
    fonte: { fontSize: 12, fontWeight: "700", color: colors.primary },
    linhaLink: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
    linhaLinkIcone: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.infoBg },
    linhaLinkTitulo: { fontSize: 15, fontWeight: "700", color: colors.text },
    linhaLinkDetalhe: { fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
  });
