import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SituacaoContato, TipoVisita } from "@/api/types";
import { irParaAmbiente, MarcaMinisterio, TrocarAmbienteSheet } from "@/components/layout/Ambientes";
import { SinoNotificacoes } from "@/components/layout/SinoNotificacoes";
import { Avatar, Sheet } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { MESES, radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { doisDig, isoDoDia } from "./escolhas";
import { efeitosDe, METAL } from "./tema";

/** As transições do ambiente: 350 ms com a curva "ease" do CSS. Os movimentos de fundo seguem lentos. */
export const LEVE = 350;
export const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
/** Um bloco entrando na tela; `i` escalona de leve (30 ms por passo, até 4). */
export const entrada = (i = 0) => FadeInDown.duration(LEVE).easing(EASE).delay(Math.min(i, 4) * 30);

export type Icone = keyof typeof Ionicons.glyphMap;

// ---------------------------------------------------------------------------
// Situação dos contatos e tipos de visita
// ---------------------------------------------------------------------------

/** A cor vem com ícone e texto: a cor sozinha não basta para quem é daltônico. */
export const SITUACAO: Record<SituacaoContato, { rotulo: string; icone: Icone; cor: (c: Cores) => string; fundo: (c: Cores) => string }> = {
  atrasada: { rotulo: "Atrasada", icone: "alert-circle", cor: (c) => c.red, fundo: (c) => c.dangerBg },
  hoje: { rotulo: "Hoje", icone: "sunny", cor: (c) => c.amber, fundo: (c) => c.warningBg },
  breve: { rotulo: "Em breve", icone: "time", cor: (c) => c.teal, fundo: (c) => c.tealBg },
  marcada: { rotulo: "Marcada", icone: "calendar", cor: (c) => c.primary, fundo: (c) => c.successBg },
  semData: { rotulo: "Sem data", icone: "ellipse-outline", cor: (c) => c.textMuted, fundo: (c) => c.surfaceMuted },
};

export const TIPO_VISITA: Record<TipoVisita, { rotulo: string; icone: Icone; cor: (c: Cores) => string }> = {
  conversa: { rotulo: "Conversei", icone: "chatbubbles", cor: (c) => c.primary },
  estudo: { rotulo: "Estudo", icone: "book", cor: (c) => c.purple },
  nao_em_casa: { rotulo: "Não em casa", icone: "home-outline", cor: (c) => c.amber },
};

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86400000);

/** A mesma regra do servidor, no fuso do aparelho (que é o da congregação). */
export function situacaoDe(proximaVisita: string | null, hoje = isoDoDia(new Date())): SituacaoContato {
  if (!proximaVisita) return "semData";
  const n = diasEntre(hoje, isoDoDia(new Date(proximaVisita)));
  if (n < 0) return "atrasada";
  if (n === 0) return "hoje";
  return n <= 3 ? "breve" : "marcada";
}

/** "HOJE", "AMANHÃ", "EM 3 DIAS", "HÁ 2 DIAS" — o selo "A SEGUIR · EM 2 DIAS". */
export function quandoRelativo(proximaVisita: string, hoje = isoDoDia(new Date())) {
  const n = diasEntre(hoje, isoDoDia(new Date(proximaVisita)));
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  if (n === -1) return "ontem";
  return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
}

/** "2026-10" do aparelho. */
export const mesAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}`;
};

export const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Dia "2026-10-23" mais `n` dias (pelo calendário, não por 24 h). */
export const somarDias = (dia: string, n: number) => {
  const [a, m, d] = dia.split("-").map(Number);
  return isoDoDia(new Date(a, m - 1, d + n));
};

export const horaDe = (iso: string) => {
  const d = new Date(iso);
  return `${doisDig(d.getHours())}:${doisDig(d.getMinutes())}`;
};

const SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Date -> "Quinta, 23 de outubro" */
export const dataLonga = (d: Date) => `${SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth() + 1].toLowerCase()}`;

/** "Bom dia", "Boa tarde" ou "Boa noite" pela hora do aparelho. */
export function saudacao(agora = new Date()) {
  const h = agora.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/** O link do "como chegar": pela posição do GPS, ou pelo endereço escrito. */
export function linkComoChegar(r: { lat: number | null; lng: number | null; endereco: string | null }) {
  if (r.lat != null && r.lng != null) {
    return Platform.OS === "ios"
      ? `http://maps.apple.com/?daddr=${r.lat},${r.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`;
  }
  return r.endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.endereco)}` : null;
}

export const digitosDe = (telefone: string | null) => (telefone || "").replace(/\D/g, "");

export function whatsappDe(telefone: string | null) {
  const d = digitosDe(telefone);
  return d.length >= 10 ? `https://wa.me/${d.startsWith("55") ? d : `55${d}`}` : null;
}

/** O espaço que as telas com a barra de baixo deixam livre no fim da rolagem. */
export function useRecuo() {
  const insets = useSafeAreaInsets();
  return { paddingBottom: insets.bottom + 118 };
}

// ---------------------------------------------------------------------------
// Fundo animado
// ---------------------------------------------------------------------------

/** Anéis concêntricos bem transparentes: sem blur nem SVG, a borda da bolha sai macia. */
const ANEIS = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2];

function Bolha({ cor, tamanho, x, y, duracao, atraso }: { cor: string; tamanho: number; x: number; y: number; duracao: number; atraso: number }) {
  const parado = useReducedMotion();
  const t = useSharedValue(0.5);
  useEffect(() => {
    if (parado) return;
    t.value = withDelay(atraso, withRepeat(withTiming(1, { duration: duracao, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(t);
  }, [t, duracao, atraso, parado]);
  const estilo = useAnimatedStyle(() => ({
    transform: [
      { translateX: x + (t.value - 0.5) * tamanho * 0.24 },
      { translateY: y + (t.value - 0.5) * tamanho * 0.18 },
      { scale: 0.92 + t.value * 0.16 },
    ],
  }));
  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: tamanho, height: tamanho }, estilo]}>
      {ANEIS.map((f) => (
        <View
          key={f}
          style={{
            position: "absolute",
            left: (tamanho * (1 - f)) / 2,
            top: (tamanho * (1 - f)) / 2,
            width: tamanho * f,
            height: tamanho * f,
            borderRadius: (tamanho * f) / 2,
            backgroundColor: cor,
            opacity: 0.055,
          }}
        />
      ))}
    </Animated.View>
  );
}

/** O fundo do ambiente: degradê e três bolhas de luz que flutuam devagar (paradas com "reduzir movimento"). */
export function Fundo() {
  const { esquema } = useTema();
  const { width, height } = useWindowDimensions();
  const e = efeitosDe(esquema);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={e.fundo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Bolha cor={e.bolhas[0]} tamanho={width * 1.15} x={-width * 0.45} y={-width * 0.5} duracao={13000} atraso={0} />
      <Bolha cor={e.bolhas[1]} tamanho={width} x={width * 0.38} y={height * 0.2} duracao={17000} atraso={1500} />
      <Bolha cor={e.bolhas[2]} tamanho={width * 0.9} x={-width * 0.3} y={height * 0.62} duracao={21000} atraso={800} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Vidro
// ---------------------------------------------------------------------------

/**
 * O cartão de vidro. No iPhone, desfoque de verdade sobre o fundo animado; no Android, só o
 * véu (o desfoque do Android em vários cartões de uma lista pesa demais).
 */
export function Vidro({ children, style, intensidade = 45 }: { children: ReactNode; style?: StyleProp<ViewStyle>; intensidade?: number }) {
  const { esquema, styles } = useTema(criarEstilos);
  const e = efeitosDe(esquema);
  if (Platform.OS === "ios") {
    return (
      <BlurView intensity={intensidade} tint={e.tint} style={[styles.vidro, { backgroundColor: e.vidro, borderColor: e.vidroBorda }, style]}>
        {children}
      </BlurView>
    );
  }
  return <View style={[styles.vidro, { backgroundColor: e.vidroAndroid, borderColor: e.vidroBorda }, style]}>{children}</View>;
}

// ---------------------------------------------------------------------------
// Anel de progresso
// ---------------------------------------------------------------------------

/** "#0A7F61" e "#0B8EA3" a 30% -> a cor do meio. */
function misturar(a: string, b: string, t: number) {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

const TRACOS = 60;

function Traco({ i, raio, comprimento, cheia, vazia, progresso }: { i: number; raio: number; comprimento: number; cheia: string; vazia: string; progresso: SharedValue<number> }) {
  const estilo = useAnimatedStyle(() => {
    const aceso = progresso.value * TRACOS > i + 0.5;
    return { backgroundColor: aceso ? cheia : vazia, transform: [{ scaleY: aceso ? 1 : 0.7 }] };
  });
  return (
    <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${(i / TRACOS) * 360}deg` }] }]}>
      <Animated.View style={[{ position: "absolute", top: 0, left: raio - 2, width: 4, height: comprimento, borderRadius: 2 }, estilo]} />
    </View>
  );
}

/**
 * O anel de traços (como um mostrador): acende do topo no sentido do relógio até a fração.
 * `pulsando` liga um halo que respira (o cronômetro rodando).
 */
export function Anel({ tamanho, fracao, pulsando, children }: { tamanho: number; fracao: number; pulsando?: boolean; children?: ReactNode }) {
  const { colors } = useTema();
  const parado = useReducedMotion();
  const progresso = useSharedValue(0);
  const halo = useSharedValue(0);
  const raio = tamanho / 2;
  const comprimento = Math.max(10, tamanho * 0.075);

  useEffect(() => {
    progresso.value = withTiming(Math.max(0, Math.min(1, fracao)), { duration: parado ? 0 : LEVE, easing: EASE });
  }, [fracao, progresso, parado]);

  useEffect(() => {
    if (!pulsando || parado) {
      cancelAnimation(halo);
      halo.value = withTiming(0, { duration: 300 });
      return;
    }
    halo.value = withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(0.25, { duration: 1400 })), -1);
    return () => cancelAnimation(halo);
  }, [pulsando, halo, parado]);

  const estiloHalo = useAnimatedStyle(() => ({ opacity: halo.value * 0.35, transform: [{ scale: 0.94 + halo.value * 0.1 }] }));
  const completo = fracao >= 1;

  return (
    <View style={{ width: tamanho, height: tamanho, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        pointerEvents="none"
        style={[{ position: "absolute", width: tamanho, height: tamanho, borderRadius: raio, backgroundColor: colors.primary }, estiloHalo]}
      />
      {Array.from({ length: TRACOS }, (_, i) => (
        <Traco
          key={i}
          i={i}
          raio={raio}
          comprimento={comprimento}
          cheia={misturar(completo ? METAL.ouro[1] : colors.teal, colors.green, i / TRACOS)}
          vazia={colors.border}
          progresso={progresso}
        />
      ))}
      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center", width: tamanho - comprimento * 3, height: tamanho - comprimento * 3 }}>
        {children}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Cabeçalhos
// ---------------------------------------------------------------------------

/** A barra de cima das abas: a marca (troca de ambiente), o sino e o avatar (o menu da conta). */
export function CabecalhoMinisterio() {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const { usuario } = useAuth();
  const [menu, setMenu] = useState(false);
  const [trocar, setTrocar] = useState(false);
  const ir = (href: "/ministerio/perfil" | "/ministerio/ajuda" | "/ministerio/novidades") => router.push(href);

  return (
    <View style={[styles.cabecalho, { paddingTop: insets.top + 6 }]}>
      <Pressable
        onPress={() => setTrocar(true)}
        style={({ pressed }) => [styles.marca, pressed && styles.pressionado]}
        accessibilityRole="button"
        accessibilityLabel="Ministério. Trocar de ambiente"
      >
        <MarcaMinisterio tamanho={28} />
        <Text style={styles.marcaNome}>Ministério</Text>
        <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
      </Pressable>
      <View style={styles.flex} />
      <SinoNotificacoes onPress={() => router.push("/ministerio/notificacoes")} />
      {usuario ? (
        <Pressable onPress={() => setMenu(true)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Perfil, ajuda e mais" style={styles.avatar}>
          <Avatar usuario={usuario} tamanho={34} fundo={colors.sand} corTexto={colors.primaryDark} />
        </Pressable>
      ) : null}

      <MenuAcoes
        visible={menu}
        onClose={() => setMenu(false)}
        titulo={usuario?.nome}
        acoes={[
          { rotulo: "Perfil e configurações", icone: "person-circle-outline", onPress: () => ir("/ministerio/perfil") },
          { rotulo: "Centro de Ajuda", icone: "help-buoy-outline", onPress: () => ir("/ministerio/ajuda") },
          { rotulo: "Novidades", icone: "sparkles-outline", onPress: () => ir("/ministerio/novidades") },
          { rotulo: "Ir para o Servir Mais", icone: "swap-horizontal", onPress: () => irParaAmbiente("servir") },
        ]}
      />
      <TrocarAmbienteSheet visible={trocar} onClose={() => setTrocar(false)} atual="ministerio" />
    </View>
  );
}

/** O título grande do começo de cada aba (rola junto com a tela). */
export function TituloTela({ titulo, subtitulo, direita }: { titulo: string; subtitulo?: string | null; direita?: ReactNode }) {
  const { styles } = useTema(criarEstilos);
  return (
    <View style={styles.tituloLinha}>
      <View style={styles.flex}>
        <Text style={styles.titulo} accessibilityRole="header">
          {titulo}
        </Text>
        {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}
      </View>
      {direita}
    </View>
  );
}

/** O topo das telas empilhadas (contato, perfil...): voltar, título e uma ação à direita. */
export function Topo({ titulo, direita }: { titulo?: string; direita?: ReactNode }) {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.topo, { paddingTop: insets.top + 6 }]}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/ministerio"))}
        style={({ pressed }) => [styles.botaoRedondo, pressed && styles.pressionado]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.topoTitulo} numberOfLines={1}>
        {titulo}
      </Text>
      <View style={styles.topoDireita}>{direita}</View>
    </View>
  );
}

/** Botão redondo de ícone (as ações do topo, o satélite do mapa). */
export function BotaoIcone({ icone, onPress, rotulo, ativo }: { icone: Icone; onPress: () => void; rotulo: string; ativo?: boolean }) {
  const { colors, styles } = useTema(criarEstilos);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.botaoRedondo, ativo && { backgroundColor: colors.primary }, pressed && styles.pressionado]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ selected: !!ativo }}
    >
      <Ionicons name={icone} size={20} color={ativo ? colors.textOnPrimary : colors.text} />
    </Pressable>
  );
}

/** "Conversas de hoje" ............ "Ver todas" */
export function Secao({ titulo, acao, onAcao }: { titulo: string; acao?: string; onAcao?: () => void }) {
  const { styles } = useTema(criarEstilos);
  return (
    <View style={styles.secao}>
      <Text style={styles.secaoTitulo} accessibilityRole="header">
        {titulo}
      </Text>
      {acao && onAcao ? (
        <Pressable onPress={onAcao} hitSlop={8} accessibilityRole="button">
          <Text style={styles.secaoAcao}>{acao}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** O selo de situação (ícone + texto na cor dela). */
export function Pilula({ situacao, texto }: { situacao: SituacaoContato; texto?: string }) {
  const { colors, styles } = useTema(criarEstilos);
  const s = SITUACAO[situacao];
  return (
    <View style={[styles.pilula, { backgroundColor: s.fundo(colors) }]}>
      <Ionicons name={s.icone} size={12} color={s.cor(colors)} />
      <Text style={[styles.pilulaTexto, { color: s.cor(colors) }]}>{texto ?? s.rotulo}</Text>
    </View>
  );
}

/** Botão compacto em pílula ("Conversei", "Não em casa"). */
export function BotaoPilula({ rotulo, icone, onPress, tom = "primario" }: { rotulo: string; icone: Icone; onPress: () => void; tom?: "primario" | "neutro" }) {
  const { colors, styles } = useTema(criarEstilos);
  const primario = tom === "primario";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.botaoPilula, primario ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderWidth: 1 }, pressed && styles.pressionado]}
      accessibilityRole="button"
    >
      <Ionicons name={icone} size={15} color={primario ? colors.textOnPrimary : colors.text} />
      <Text style={[styles.botaoPilulaTexto, { color: primario ? colors.textOnPrimary : colors.text }]}>{rotulo}</Text>
    </Pressable>
  );
}

/** "Lista | Mapa" com o indicador que desliza. */
export function Segmentos<T extends string>({ opcoes, valor, onMudar }: { opcoes: { valor: T; rotulo: string; icone: Icone }[]; valor: T; onMudar: (v: T) => void }) {
  const { colors, styles } = useTema(criarEstilos);
  const [largura, setLargura] = useState(0);
  const indice = Math.max(0, opcoes.findIndex((o) => o.valor === valor));
  const x = useSharedValue(0);
  const cada = largura ? (largura - 8) / opcoes.length : 0;
  useEffect(() => {
    x.value = withTiming(indice * cada, { duration: LEVE, easing: EASE });
  }, [indice, cada, x]);
  const estilo = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={styles.segmentos} onLayout={(e) => setLargura(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {cada ? <Animated.View style={[styles.segmentoIndicador, { width: cada }, estilo]} /> : null}
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <Pressable key={o.valor} style={styles.segmento} onPress={() => onMudar(o.valor)} accessibilityRole="tab" accessibilityState={{ selected: ativo }}>
            <Ionicons name={o.icone} size={16} color={ativo ? colors.textOnPrimary : colors.textSecondary} />
            <Text style={[styles.segmentoTexto, ativo && { color: colors.textOnPrimary }]}>{o.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Menu de ações (toque longo)
// ---------------------------------------------------------------------------

export interface Acao {
  rotulo: string;
  icone: Icone;
  onPress: () => void;
  perigo?: boolean;
}

/** As ações de um item (toque longo) numa folha curta. */
export function MenuAcoes({ visible, onClose, titulo, subtitulo, acoes }: { visible: boolean; onClose: () => void; titulo?: string | null; subtitulo?: string | null; acoes: Acao[] }) {
  const { colors, styles } = useTema(criarEstilos);
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.menu}>
        {titulo ? (
          <View style={styles.menuCabeca}>
            <Text style={styles.menuTitulo} numberOfLines={1}>
              {titulo}
            </Text>
            {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}
          </View>
        ) : null}
        {acoes.map((a) => (
          <Pressable
            key={a.rotulo}
            onPress={() => {
              onClose();
              // No iPhone a próxima folha não abre enquanto esta ainda está fechando.
              setTimeout(a.onPress, Platform.OS === "ios" ? 400 : 0);
            }}
            style={({ pressed }) => [styles.menuLinha, pressed && styles.pressionado]}
            accessibilityRole="button"
          >
            <View style={[styles.menuIcone, { backgroundColor: a.perigo ? colors.dangerBg : colors.sand }]}>
              <Ionicons name={a.icone} size={18} color={a.perigo ? colors.red : colors.primaryDark} />
            </View>
            <Text style={[styles.menuTexto, a.perigo && { color: colors.red }]}>{a.rotulo}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1 },
    pressionado: { opacity: 0.7, transform: [{ scale: 0.98 }] },
    vidro: { borderRadius: 24, borderWidth: 1, overflow: "hidden", padding: 16 },
    cabecalho: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 6 },
    marca: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, paddingRight: 6 },
    marcaNome: { fontSize: 17, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
    avatar: { borderRadius: 20, borderWidth: 2, borderColor: colors.primary, padding: 1 },
    tituloLinha: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 4 },
    titulo: { fontSize: 30, fontWeight: "900", color: colors.text, letterSpacing: -0.8 },
    subtitulo: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
    topo: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
    topoTitulo: { flex: 1, fontSize: 17, fontWeight: "800", color: colors.text, textAlign: "center" },
    topoDireita: { minWidth: 40, flexDirection: "row", justifyContent: "flex-end", gap: 8 },
    botaoRedondo: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secao: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 6 },
    secaoTitulo: { fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
    secaoAcao: { fontSize: 14, fontWeight: "700", color: colors.primary },
    pilula: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
    pilulaTexto: { fontSize: 11.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
    botaoPilula: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
    botaoPilulaTexto: { fontSize: 13.5, fontWeight: "800" },
    segmentos: {
      flexDirection: "row",
      padding: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segmentoIndicador: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: radius.pill, backgroundColor: colors.primary },
    segmento: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9 },
    segmentoTexto: { fontSize: 14, fontWeight: "800", color: colors.textSecondary },
    menu: { gap: 4, paddingBottom: 8 },
    menuCabeca: { paddingBottom: 8 },
    menuTitulo: { fontSize: 18, fontWeight: "800", color: colors.text },
    menuLinha: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
    menuIcone: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    menuTexto: { flex: 1, fontSize: 15.5, fontWeight: "700", color: colors.text },
  });
