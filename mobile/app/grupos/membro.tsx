import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError } from "@/api/client";
import { useFichaMembro } from "@/api/hooks/useGrupos";
import type { CompromissoFicha, FichaMembro } from "@/api/types";
import { PrivilegioBadge } from "@/components/PrivilegioBadge";
import { EmptyState, GradientHeader, Loading, useToast } from "@/components/ui";
import { DIAS_CURTOS, radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { usePuxar } from "@/utils/usePuxar";

/** "2026-10-16" -> "Qui, 16/10" */
function dia(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return `${DIAS_CURTOS[new Date(a, m - 1, d).getDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

const ICONE: Record<CompromissoFicha["tipo"], keyof typeof Ionicons.glyphMap> = {
  designacao: "clipboard-outline",
  reuniao: "mic-outline",
  dirigente: "walk-outline",
};

/**
 * A ficha de um irmão do grupo, para o dirigente analisar: o relatório de campo mês a mês, as
 * reuniões pelo Zoom, as designações e o contato.
 */
export default function FichaMembroScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams<{ grupo: string; irmao: string }>();
  const { data: f, isLoading, error, refetch } = useFichaMembro(Number(params.grupo), Number(params.irmao));
  const puxar = usePuxar(refetch);

  if (isLoading && !f) return <Loading label="Carregando..." />;
  if (!f) {
    const semAcesso = error instanceof ApiError && (error.status === 403 || error.status === 404);
    return (
      <View style={styles.tela}>
        <GradientHeader title="Irmão" showBack />
        <EmptyState
          icon={semAcesso ? "lock-closed-outline" : "cloud-offline-outline"}
          title={semAcesso ? "Você não tem acesso a este irmão" : "Não deu para carregar"}
          message={semAcesso ? "A ficha abre para o dirigente e o ajudante do grupo dele, o secretário e os administradores." : "Puxe para tentar de novo."}
        />
      </View>
    );
  }

  const abrir = (url: string) => Linking.openURL(url).catch(() => toast.show("Não consegui abrir", "error"));
  const { irmao, relatorios, zoom, designacoes } = f;
  const pioneiro = irmao.pioneiro;
  const papel = f.lider === "dirigente" ? "Dirigente do grupo" : f.lider === "ajudante" ? "Ajudante do grupo" : null;

  return (
    <View style={styles.tela}>
      <GradientHeader title={irmao.nome} description={f.grupo.rotulo} showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}
      >
        {papel || pioneiro || irmao.privilegio ? (
          <View style={styles.etiquetas}>
            {papel ? <Etiqueta texto={papel} cor={colors.primaryDark} fundo={colors.infoBg} /> : null}
            {pioneiro ? <Etiqueta texto={`Pioneiro ${pioneiro}`} icone="leaf" cor={colors.greenDark} fundo={colors.successBg} /> : null}
            {irmao.privilegio ? <PrivilegioBadge privilegio={irmao.privilegio} /> : null}
          </View>
        ) : null}

        {irmao.telefone ? (
          <View style={styles.contato}>
            {irmao.whatsapp ? (
              <Pressable style={[styles.botao, { backgroundColor: colors.successBg }]} onPress={() => abrir(irmao.whatsapp!)} accessibilityRole="button">
                <Ionicons name="logo-whatsapp" size={18} color={colors.greenDark} />
                <Text style={[styles.botaoTexto, { color: colors.greenDark }]}>WhatsApp</Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.botao, { backgroundColor: colors.infoBg }]} onPress={() => abrir(`tel:${irmao.telefone}`)} accessibilityRole="button">
              <Ionicons name="call-outline" size={18} color={colors.primaryDark} />
              <Text style={[styles.botaoTexto, { color: colors.primaryDark }]}>Ligar</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.nota}>Sem telefone no cadastro.</Text>
        )}

        <Animated.View entering={FadeInDown.duration(220)} style={styles.bloco}>
          <Text style={styles.blocoTitulo}>Relatório de campo</Text>
          <Text style={styles.blocoSub}>
            {relatorios.mesesNoApp
              ? `Participou em ${relatorios.participou} de ${relatorios.mesesNoApp} ${relatorios.mesesNoApp === 1 ? "mês" : "meses"} anotados no app`
              : "Os relatórios no app começam em outubro de 2026; os anteriores foram no papel."}
          </Text>
          <Grade meses={relatorios.meses} />
          {relatorios.horasAnoServico !== null ? (
            <Text style={styles.destaque}>
              {relatorios.horasAnoServico} h relatadas no ano de serviço
            </Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(220).delay(40)} style={styles.bloco}>
          <Text style={styles.blocoTitulo}>Reuniões pelo Zoom</Text>
          <View style={styles.numeros}>
            <Numero valor={zoom.anoServico} rotulo="no ano de serviço" />
            <Numero valor={zoom.ultimos3Meses} rotulo="nos últimos 3 meses" />
          </View>
          {zoom.datas.length ? (
            <View style={styles.chips}>
              {zoom.datas.slice(0, 10).map((d) => (
                <View key={d} style={styles.chip}>
                  <Text style={styles.chipTexto}>{dia(d)}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={styles.nota}>A presença no salão não é anotada por pessoa: aqui entra só o Zoom.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(220).delay(80)} style={styles.bloco}>
          <Text style={styles.blocoTitulo}>Designações no ano de serviço</Text>
          <View style={styles.numeros}>
            <Numero valor={designacoes.anoServico.mecanicas} rotulo="no quadro" />
            <Numero valor={designacoes.anoServico.reuniao} rotulo="partes na reunião" />
            <Numero valor={designacoes.anoServico.dirigente} rotulo="saídas como dirigente" />
          </View>
          <Lista titulo="Próximas" itens={designacoes.proximas} vazio="Nenhuma designação marcada." />
          <Lista titulo="Recentes" itens={designacoes.recentes} vazio="Nenhuma designação recente." />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function Etiqueta({ texto, cor, fundo, icone }: { texto: string; cor: string; fundo: string; icone?: keyof typeof Ionicons.glyphMap }) {
  const { styles } = useTema(criarEstilos);
  return (
    <View style={[styles.etiqueta, { backgroundColor: fundo }]}>
      {icone ? <Ionicons name={icone} size={12} color={cor} /> : null}
      <Text style={[styles.etiquetaTexto, { color: cor }]}>{texto}</Text>
    </View>
  );
}

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  const { styles } = useTema(criarEstilos);
  return (
    <View style={styles.numero}>
      <Text style={styles.numeroValor}>{valor}</Text>
      <Text style={styles.numeroRotulo}>{rotulo}</Text>
    </View>
  );
}

/** Os 12 meses em grade: cada mês diz como foi o relatório. */
function Grade({ meses }: { meses: FichaMembro["relatorios"]["meses"] }) {
  const { colors, styles } = useTema(criarEstilos);
  return (
    <View style={styles.grade}>
      {meses.map((m) => {
        const r = m.relatorio;
        const visual = m.antesDoApp
          ? { texto: "papel", cor: colors.textMuted, fundo: colors.surfaceMuted }
          : !r
            ? { texto: "falta", cor: colors.amber, fundo: colors.warningBg }
            : r.horas !== null
              ? { texto: `${r.horas} h`, cor: colors.greenDark, fundo: colors.successBg }
              : r.participou
                ? { texto: "✓", cor: colors.greenDark, fundo: colors.successBg }
                : { texto: "não", cor: colors.red, fundo: colors.dangerBg };
        return (
          <View
            key={m.mes}
            style={[styles.mes, { backgroundColor: visual.fundo }]}
            accessibilityLabel={`${m.nome}: ${m.antesDoApp ? "no papel" : !r ? "sem relatório" : r.participou ? `participou${r.horas !== null ? `, ${r.horas} horas` : ""}${r.estudos ? `, ${r.estudos} estudos` : ""}` : "não participou"}`}
          >
            <Text style={styles.mesNome}>{m.nome.slice(0, 3)}</Text>
            <Text style={[styles.mesValor, { color: visual.cor }]}>{visual.texto}</Text>
            {r && r.estudos ? <Text style={styles.mesEstudos}>{r.estudos} est.</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function Lista({ titulo, itens, vazio }: { titulo: string; itens: CompromissoFicha[]; vazio: string }) {
  const { colors, styles } = useTema(criarEstilos);
  return (
    <View style={styles.lista}>
      <Text style={styles.listaTitulo}>{titulo}</Text>
      {itens.length === 0 ? (
        <Text style={styles.nota}>{vazio}</Text>
      ) : (
        itens.map((c, i) => (
          <View key={`${c.dataISO}-${i}`} style={styles.item}>
            <Ionicons name={ICONE[c.tipo] ?? "calendar-outline"} size={16} color={colors.primaryDark} style={{ marginTop: 2 }} />
            <View style={styles.flex}>
              <Text style={styles.itemTitulo}>{c.titulo}</Text>
              <Text style={styles.itemDetalhe}>
                {[dia(c.dataISO), c.papel, c.horario, c.local, c.detalhe].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, gap: 14 },
    flex: { flex: 1 },
    etiquetas: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    etiqueta: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
    etiquetaTexto: { fontSize: 12, fontWeight: "800" },
    contato: { flexDirection: "row", gap: 10 },
    botao: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: radius.pill },
    botaoTexto: { fontSize: 15, fontWeight: "800" },
    bloco: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border },
    blocoTitulo: { fontSize: 16, fontWeight: "800", color: colors.text },
    blocoSub: { fontSize: 13, color: colors.textSecondary, marginTop: -6 },
    destaque: { fontSize: 14, fontWeight: "800", color: colors.greenDark },
    nota: { fontSize: 12.5, color: colors.textMuted },
    grade: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    mes: { width: "23.5%", alignItems: "center", paddingVertical: 8, borderRadius: radius.md, gap: 1 },
    mesNome: { fontSize: 11.5, fontWeight: "700", color: colors.textSecondary, textTransform: "capitalize" },
    mesValor: { fontSize: 15, fontWeight: "900" },
    mesEstudos: { fontSize: 10.5, fontWeight: "700", color: colors.textSecondary },
    numeros: { flexDirection: "row", gap: 8 },
    numero: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
    numeroValor: { fontSize: 22, fontWeight: "900", color: colors.text },
    numeroRotulo: { fontSize: 11.5, fontWeight: "700", color: colors.textSecondary, textAlign: "center" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.infoBg },
    chipTexto: { fontSize: 12, fontWeight: "700", color: colors.primaryDark },
    lista: { gap: 8, marginTop: 4 },
    listaTitulo: { fontSize: 12, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8 },
    item: { flexDirection: "row", gap: 10 },
    itemTitulo: { fontSize: 14.5, fontWeight: "700", color: colors.text },
    itemDetalhe: { fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
  });
