import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLevarParaAssistencia, useReuniaoZoom, useSincronizarReuniaoZoom, useTranscricaoZoom } from "@/api/hooks/useZoom";
import type { ParteZoom, StatusParteZoom } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { MarkdownSimples } from "@/components/reuniao/MarkdownSimples";
import { Button, EmptyState, GradientHeader, Loading, TextField, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { podeGerenciar } from "@/utils/permissoes";
import { usePuxar } from "@/utils/usePuxar";
import { duracao, hora, quandoFoi, TIPO_REUNIAO } from "@/utils/zoom";

type Aba = "resumo" | "participantes" | "transcricao";

const NOME_PARTE: Record<ParteZoom, string> = {
  detalhes: "Dados da reunião",
  resumo: "Resumo",
  participantes: "Participantes",
  transcricao: "Transcrição",
};

/** Uma reunião do Zoom: o resumo do AI Companion, quem participou e a transcrição. */
export default function RelatorioZoomScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { feito } = useCelebracao();
  const { usuario } = useAuth();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const [abaEscolhida, setAba] = useState<Aba | null>(null);
  const [filtro, setFiltro] = useState("");
  const { data: r, isLoading, refetch } = useReuniaoZoom(id);
  // A do relatorio (CSV) nao tem resumo: abre direto nos participantes.
  const aba: Aba = abaEscolhida ?? (r?.origem === "csv" ? "participantes" : "resumo");
  const transcricao = useTranscricaoZoom(id, aba === "transcricao" && !!r?.temTranscricao);
  const sincronizar = useSincronizarReuniaoZoom();
  const levar = useLevarParaAssistencia();
  const puxar = usePuxar(refetch);

  const falas = useMemo(() => {
    const linhas = (transcricao.data?.texto ?? "").split("\n").filter(Boolean);
    const termo = filtro.trim().toLowerCase();
    return termo ? linhas.filter((l) => l.toLowerCase().includes(termo)) : linhas;
  }, [transcricao.data, filtro]);

  if (!podeGerenciar(usuario, "reunioes")) {
    return (
      <View style={styles.tela}>
        <GradientHeader title="Relatório do Zoom" showBack />
        <EmptyState icon="lock-closed-outline" title="Área de quem cuida das reuniões" />
      </View>
    );
  }
  if (isLoading && !r) return <Loading label="Carregando o relatório..." />;
  if (!r) {
    return (
      <View style={styles.tela}>
        <GradientHeader title="Relatório do Zoom" showBack />
        <EmptyState icon="cloud-offline-outline" title="Não deu para carregar" message="Puxe para tentar de novo." />
      </View>
    );
  }

  const parte = (p: ParteZoom) => r.partes[p];
  const status = (p: ParteZoom): StatusParteZoom | null => parte(p)?.status ?? null;

  const refazer = () =>
    sincronizar.mutate(
      { id: r.id },
      {
        onSuccess: (x) => toast.show(x.partes.length ? "Buscando de novo no Zoom..." : "Já está tudo sincronizado."),
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para sincronizar", "error"),
      },
    );

  const levarParaAssistencia = () => {
    if (!r.congregacao) return;
    const { data, tipo } = r.congregacao;
    Alert.alert(
      "Levar para a assistência?",
      `Os participantes entram em "quem assistiu pelo Zoom" de ${data} (${TIPO_REUNIAO[tipo].toLowerCase()}). Quem já está na lista continua como está.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Levar",
          onPress: () =>
            levar.mutate(r.id, {
              onSuccess: (x) =>
                feito({
                  titulo: x.adicionados ? `${x.adicionados} ${x.adicionados === 1 ? "nome entrou" : "nomes entraram"}` : "A lista já estava completa",
                  detalhe: `${x.total} na lista do Zoom de ${x.data}`,
                  icone: "videocam",
                }),
              onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para preencher", "error"),
            }),
        },
      ],
    );
  };

  const situacao = () => {
    if (r.situacao === "sincronizando") {
      return (
        <View style={styles.estado}>
          <ActivityIndicator size="small" color={colors.primaryDark} />
          <Text style={styles.estadoTexto}>Buscando no Zoom. Esta tela se atualiza sozinha.</Text>
        </View>
      );
    }
    if (r.situacao === "erro") {
      const comErro = (Object.keys(r.partes) as ParteZoom[]).filter((p) => status(p) === "erro");
      return (
        <View style={[styles.estado, { backgroundColor: colors.dangerBg }]}>
          <Ionicons name="alert-circle" size={18} color={colors.red} />
          <View style={styles.flex}>
            <Text style={[styles.estadoTexto, { color: colors.red }]}>Não deu para buscar: {comErro.map((p) => NOME_PARTE[p].toLowerCase()).join(", ")}</Text>
            <Text style={styles.estadoDetalhe}>{parte(comErro[0])?.ultimoErro}</Text>
          </View>
        </View>
      );
    }
    return null;
  };

  const etiqueta = (p: ParteZoom) => {
    const s = status(p);
    if (!s) return null;
    const visual = {
      ok: { icone: "checkmark-circle" as const, cor: colors.greenDark, texto: "pronto" },
      pendente: { icone: "time-outline" as const, cor: colors.amber, texto: "aguardando" },
      indisponivel: { icone: "remove-circle-outline" as const, cor: colors.textMuted, texto: "o Zoom não tem" },
      erro: { icone: "alert-circle" as const, cor: colors.red, texto: "erro" },
    }[s];
    return (
      <View key={p} style={styles.parte}>
        <Ionicons name={visual.icone} size={14} color={visual.cor} />
        <Text style={styles.parteTexto}>
          {NOME_PARTE[p]}: <Text style={{ color: visual.cor }}>{visual.texto}</Text>
        </Text>
      </View>
    );
  };

  const semResumo = (
    <EmptyState
      icon="document-outline"
      title={status("resumo") === "pendente" ? "O resumo ainda está sendo gerado" : "Sem resumo para esta reunião"}
      message={
        status("resumo") === "pendente"
          ? "O AI Companion do Zoom leva alguns minutos depois do fim da reunião."
          : parte("resumo")?.ultimoErro || "O resumo com IA não estava ligado nesta reunião."
      }
    />
  );

  const lista = (titulo: string, icone: keyof typeof Ionicons.glyphMap, itens: string[] | null) =>
    itens && itens.length ? (
      <View style={styles.bloco}>
        <Text style={styles.blocoTitulo}>{titulo}</Text>
        {itens.map((t, i) => (
          <View key={i} style={styles.linha}>
            <Ionicons name={icone} size={16} color={colors.primaryDark} style={{ marginTop: 2 }} />
            <Text style={styles.linhaTexto}>{t}</Text>
          </View>
        ))}
      </View>
    ) : null;

  const abaResumo = () =>
    !r.resumoMarkdown && !(r.decisoes && r.decisoes.length) ? (
      semResumo
    ) : (
      <>
        {lista("Decisões", "flag-outline", r.decisoes)}
        {lista("Próximos passos", "arrow-forward-circle-outline", r.proximosPassos)}
        {r.topicos && r.topicos.length ? (
          <View style={styles.bloco}>
            <Text style={styles.blocoTitulo}>Tópicos</Text>
            {r.topicos.map((t, i) => (
              <View key={i} style={styles.topico}>
                <Text style={styles.topicoTitulo}>{t.titulo}</Text>
                {t.descricao ? <Text style={styles.topicoTexto}>{t.descricao}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
        {r.resumoMarkdown ? (
          <View style={styles.bloco}>
            <Text style={styles.blocoTitulo}>Resumo completo</Text>
            <MarkdownSimples texto={r.resumoMarkdown} />
            {r.resumoDocUrl ? (
              <Pressable onPress={() => Linking.openURL(r.resumoDocUrl!).catch(() => {})} style={styles.link} accessibilityRole="link">
                <Ionicons name="open-outline" size={15} color={colors.primaryDark} />
                <Text style={styles.linkTexto}>Abrir no Zoom Docs</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </>
    );

  const abaParticipantes = () =>
    r.participantes.length === 0 ? (
      <EmptyState
        icon="people-outline"
        title={status("participantes") === "pendente" ? "A lista ainda não saiu" : "Sem lista de participantes"}
        message={status("participantes") === "pendente" ? "O Zoom libera o relatório alguns minutos depois do fim." : parte("participantes")?.ultimoErro || undefined}
      />
    ) : (
      <>
        {r.congregacao ? (
          <Button
            label={`Levar para a assistência de ${r.congregacao.data.slice(0, 5)}`}
            icon="videocam-outline"
            variant="secondary"
            onPress={levarParaAssistencia}
            loading={levar.isPending}
            fullWidth
          />
        ) : null}
        <View style={styles.bloco}>
          <Text style={styles.blocoTitulo}>
            {r.participantes.length} {r.participantes.length === 1 ? "pessoa" : "pessoas"}
            <Text style={styles.blocoSub}> · {r.entradas} {r.entradas === 1 ? "entrada" : "entradas"}</Text>
          </Text>
          {r.participantes.map((p, i) => (
            <View key={i} style={styles.pessoa}>
              <Ionicons
                name={p.irmaoId ? "person-circle" : "person-circle-outline"}
                size={22}
                color={p.irmaoId ? colors.primaryDark : colors.textMuted}
              />
              <View style={styles.flex}>
                <Text style={styles.pessoaNome}>{p.nome}</Text>
                {p.nomeZoom !== p.nome ? <Text style={styles.pessoaZoom}>No Zoom: {p.nomeZoom}</Text> : null}
                <Text style={styles.pessoaTempo}>
                  {hora(p.entrada)}–{hora(p.saida)} · {duracao(p.duracaoSeg)}
                  {p.entradas > 1 ? ` · entrou ${p.entradas} vezes` : ""}
                  {!p.naSala ? " · só na sala de espera" : ""}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </>
    );

  const abaTranscricao = () =>
    !r.temTranscricao ? (
      <EmptyState
        icon="chatbubbles-outline"
        title={status("transcricao") === "pendente" ? "A transcrição ainda não saiu" : "Sem transcrição"}
        message={status("transcricao") === "pendente" ? "O Zoom gera a transcrição depois do fim da reunião." : parte("transcricao")?.ultimoErro || undefined}
      />
    ) : transcricao.isLoading ? (
      <Loading label="Carregando a transcrição..." />
    ) : (
      <>
        <TextField icon="search" placeholder="Procurar na transcrição" value={filtro} onChangeText={setFiltro} />
        <View style={styles.bloco}>
          {falas.length === 0 ? (
            <Text style={styles.blocoSub}>Nada encontrado.</Text>
          ) : (
            falas.slice(0, 600).map((l, i) => {
              const m = /^([^:]{1,60}):\s(.*)$/.exec(l);
              return (
                <Text key={i} style={styles.fala}>
                  {m ? <Text style={styles.falaQuem}>{m[1]}: </Text> : null}
                  {m ? m[2] : l}
                </Text>
              );
            })
          )}
          {falas.length > 600 ? <Text style={styles.blocoSub}>Mostrando 600 de {falas.length} falas. Use a busca para achar o trecho.</Text> : null}
        </View>
      </>
    );

  const abas: { id: Aba; rotulo: string }[] = [
    { id: "resumo", rotulo: "Resumo" },
    { id: "participantes", rotulo: `Participantes${r.participantes.length ? ` (${r.participantes.length})` : ""}` },
    { id: "transcricao", rotulo: "Transcrição" },
  ];

  return (
    <View style={styles.tela}>
      <GradientHeader
        title={r.resumoTitulo || r.topico || "Reunião do Zoom"}
        description={`${quandoFoi(r.inicio)}${r.fim ? `–${hora(r.fim)}` : ""}${r.congregacao ? ` · ${TIPO_REUNIAO[r.congregacao.tipo]}` : ""}`}
        showBack
      />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {r.origem === "csv" ? (
          <View style={styles.estado}>
            <Ionicons name="document-attach-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.estadoTexto}>Importada do relatório de uso do Zoom: tem os participantes, mas não o resumo nem a transcrição.</Text>
          </View>
        ) : (
          <>
            {situacao()}
            <View style={styles.partes}>{(["resumo", "participantes", "transcricao"] as ParteZoom[]).map(etiqueta)}</View>
            {r.sincronizadoEm ? <Text style={styles.sincronizado}>Sincronizado em {quandoFoi(r.sincronizadoEm)}</Text> : null}
          </>
        )}

        <View style={styles.abas}>
          {abas.map((a) => {
            const ativa = aba === a.id;
            return (
              <Pressable
                key={a.id}
                style={[styles.aba, ativa && styles.abaAtiva]}
                onPress={() => setAba(a.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativa }}
              >
                <Text style={[styles.abaTexto, ativa && styles.abaTextoAtiva]} numberOfLines={1}>
                  {a.rotulo}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Animated.View key={aba} entering={FadeIn.duration(200)} style={styles.secao}>
          {aba === "resumo" ? abaResumo() : aba === "participantes" ? abaParticipantes() : abaTranscricao()}
        </Animated.View>

        {r.origem === "api" ? (
          <Button label="Sincronizar de novo" icon="refresh" variant="ghost" onPress={refazer} loading={sincronizar.isPending} fullWidth />
        ) : null}
      </ScrollView>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, gap: 12 },
    secao: { gap: 12 },
    flex: { flex: 1 },
    estado: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: colors.infoBg },
    estadoTexto: { flex: 1, fontSize: 13.5, fontWeight: "700", color: colors.primaryDark },
    estadoDetalhe: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
    partes: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    parte: { flexDirection: "row", alignItems: "center", gap: 4 },
    parteTexto: { fontSize: 12.5, fontWeight: "600", color: colors.textSecondary },
    sincronizado: { fontSize: 12, color: colors.textMuted, marginTop: -4 },
    abas: { flexDirection: "row", gap: 6 },
    aba: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 9,
      paddingHorizontal: 4,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    abaAtiva: { backgroundColor: colors.primary, borderColor: colors.primary },
    abaTexto: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
    abaTextoAtiva: { color: colors.textOnPrimary },
    bloco: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 14,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    blocoTitulo: { fontSize: 15, fontWeight: "800", color: colors.text },
    blocoSub: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
    linha: { flexDirection: "row", gap: 8 },
    linhaTexto: { flex: 1, fontSize: 14.5, color: colors.text, lineHeight: 21 },
    topico: { gap: 2, paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border },
    topicoTitulo: { fontSize: 14.5, fontWeight: "700", color: colors.text },
    topicoTexto: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 19 },
    link: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
    linkTexto: { fontSize: 14, fontWeight: "700", color: colors.primaryDark },
    pessoa: { flexDirection: "row", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
    pessoaNome: { fontSize: 14.5, fontWeight: "700", color: colors.text },
    pessoaZoom: { fontSize: 12.5, color: colors.textMuted },
    pessoaTempo: { fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
    fala: { fontSize: 14, color: colors.text, lineHeight: 20 },
    falaQuem: { fontWeight: "800", color: colors.primaryDark },
  });

