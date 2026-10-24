import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAplicarDivisao, usePreviaDivisao, type DivisaoParaAplicar } from "@/api/hooks/useGrupos";
import { useIrmaos } from "@/api/hooks/useIrmaos";
import type { CasamentoNome, GrupoPrevia, LiderPrevia, PreviaDivisao } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { Button, EmptyState, GradientHeader, SelectSheet, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { ehAdminGeral } from "@/utils/permissoes";

/** A escolha do admin para um nome: um irmão do cadastro, ou cadastrar como novo. */
type Escolha = { irmaoId: number } | "novo";

const NOVO = "novo";
const OUTRO = "outro";

/**
 * A nova divisão dos grupos a partir do PDF da lista (só admin geral).
 *
 * O servidor lê o PDF (grupos, dirigente, ajudante, membros, e o verde dos pioneiros
 * regulares) e casa cada nome com o cadastro. Aqui o admin confere, resolve os nomes que não
 * casaram e aplica: os grupos, quem está em cada um e quem é pioneiro regular.
 */
export default function ImportarDivisaoScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { usuario, refreshUsuario } = useAuth();
  const { celebrar } = useCelebracao();
  const previa = usePreviaDivisao();
  const aplicar = useAplicarDivisao();
  const { data: irmaos } = useIrmaos();
  const [dados, setDados] = useState<PreviaDivisao | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [tirar, setTirar] = useState(true);
  /** O nome em escolha agora: a chave em `escolhas` e o casamento do servidor. */
  const [escolhendo, setEscolhendo] = useState<{ chave: string; nome: string; casamento: CasamentoNome } | null>(null);
  const [todos, setTodos] = useState(false);
  // A folha fecha sozinha depois de cada escolha; "Escolher outro" precisa dela aberta.
  const manterAberta = useRef(false);

  const opcoesCadastro = useMemo(
    () =>
      (irmaos ?? [])
        .filter((i) => i.ativo !== false)
        .map((i) => ({ value: String(i.id), label: i.nome }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [irmaos],
  );

  if (!ehAdminGeral(usuario)) {
    return (
      <View style={styles.tela}>
        <GradientHeader title="Nova divisão" showBack />
        <EmptyState icon="lock-closed-outline" title="Só para o admin geral" />
      </View>
    );
  }

  const escolher = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    previa.mutate(
      { uri: a.uri, name: a.name, mimeType: a.mimeType },
      {
        onSuccess: (r) => {
          setDados(r);
          setEscolhas({});
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para ler o PDF", "error"),
      },
    );
  };

  /** Quem o nome vai ser: a escolha do admin, senão o que o servidor achou. */
  const resolvido = (chave: string, c: CasamentoNome): Escolha | null => {
    const e = escolhas[chave];
    if (e) return e;
    if (c.irmao) return { irmaoId: c.irmao.id };
    // Sem certeza e sem sugestão: é gente nova. Com sugestão, o admin decide.
    return c.sugestoes.length === 0 ? "novo" : null;
  };
  const nomeDe = (e: Escolha | null) =>
    e === "novo" ? null : e ? (irmaos?.find((i) => i.id === e.irmaoId)?.nome ?? `#${e.irmaoId}`) : null;

  const lideres = (g: GrupoPrevia, gi: number) =>
    [
      { papel: "Dirigente", l: g.dirigente, chave: `${gi}|dirigente` },
      { papel: "Ajudante", l: g.ajudante, chave: `${gi}|ajudante` },
    ].filter((x): x is { papel: string; l: LiderPrevia; chave: string } => !!x.l);

  const pendentes = dados
    ? dados.grupos.flatMap((g, gi) => [
        ...g.membros.filter((m, mi) => !resolvido(`${gi}|${mi}`, m)).map((m) => m.nome),
        ...lideres(g, gi)
          .filter(({ l, chave }) => l.membro === null && !resolvido(chave, l))
          .map(({ l }) => l.nome),
      ])
    : [];

  const montar = (d: PreviaDivisao): DivisaoParaAplicar => ({
    tirarDosGrupos: tirar,
    grupos: d.grupos.map((g, gi) => {
      const lider = (l: LiderPrevia | null, chave: string) => {
        if (!l) return null;
        if (l.membro !== null) return { membro: l.membro };
        const e = resolvido(chave, l);
        return e && e !== "novo" ? { irmaoId: e.irmaoId } : null;
      };
      return {
        // Sem número no PDF (o aviso já disse), fica a posição.
        numero: g.numero ?? gi + 1,
        local: g.local,
        dirigente: lider(g.dirigente, `${gi}|dirigente`),
        ajudante: lider(g.ajudante, `${gi}|ajudante`),
        membros: g.membros.map((m, mi) => {
          const e = resolvido(`${gi}|${mi}`, m);
          return { nomeDocumento: m.nome, pioneiro: m.pioneiro, ...(e && e !== "novo" ? { irmaoId: e.irmaoId } : {}) };
        }),
      };
    }),
  });

  const confirmar = () => {
    if (!dados) return;
    const pessoas = dados.grupos.reduce((s, g) => s + g.membros.length, 0);
    const novos = dados.grupos.flatMap((g, gi) => g.membros.filter((m, mi) => resolvido(`${gi}|${mi}`, m) === "novo")).length;
    Alert.alert(
      "Aplicar a nova divisão?",
      [
        `${dados.grupos.length} grupos e ${pessoas} pessoas.`,
        novos ? `${novos} ${novos === 1 ? "nome novo vai ser cadastrado" : "nomes novos vão ser cadastrados"}.` : null,
        tirar && dados.saem.length ? `${dados.saem.length} saem dos grupos.` : null,
        "Os pioneiros regulares passam a ser os marcados em verde no PDF. Os auxiliares ficam como estão no cadastro.",
      ]
        .filter(Boolean)
        .join("\n"),
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Aplicar",
          onPress: () =>
            aplicar.mutate(montar(dados), {
              onSuccess: (r) => {
                celebrar("Grupos atualizados");
                refreshUsuario().catch(() => {});
                toast.show(
                  `${r.grupos} grupos · ${r.pessoas} pessoas · ${r.pioneiros} pioneiros regulares${r.criados.length ? ` · ${r.criados.length} cadastrados` : ""}`,
                );
                router.back();
              },
              onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para aplicar", "error"),
            }),
        },
      ],
    );
  };

  /** Uma linha de nome: como está no PDF, quem ele é no cadastro, e o toque para trocar. */
  const linha = (chave: string, nome: string, c: CasamentoNome, extra?: { papel?: string; pioneiro?: boolean }) => {
    const e = resolvido(chave, c);
    const cadastro = nomeDe(e);
    const icone = !e ? "help-circle" : e === "novo" ? "add-circle" : "checkmark-circle";
    const cor = !e ? colors.amber : e === "novo" ? colors.teal : colors.greenDark;
    return (
      <Pressable
        key={chave}
        style={({ pressed }) => [styles.nome, pressed && { opacity: 0.8 }]}
        onPress={() => setEscolhendo({ chave, nome, casamento: c })}
        accessibilityRole="button"
        accessibilityLabel={`${nome}: ${!e ? "escolher quem é" : e === "novo" ? "cadastrar como novo" : cadastro}`}
      >
        <Ionicons name={icone} size={18} color={cor} />
        <View style={styles.flex}>
          <Text style={styles.nomeTexto}>
            {extra?.papel ? <Text style={styles.papel}>{extra.papel}: </Text> : null}
            {nome}
          </Text>
          {!e ? (
            <Text style={[styles.nomeCadastro, { color: colors.amber }]}>Toque para escolher quem é</Text>
          ) : e === "novo" ? (
            <Text style={[styles.nomeCadastro, { color: colors.teal }]}>Vai ser cadastrado</Text>
          ) : cadastro && cadastro !== nome ? (
            <Text style={styles.nomeCadastro}>No cadastro: {cadastro}</Text>
          ) : null}
        </View>
        {extra?.pioneiro ? <Ionicons name="leaf" size={15} color={colors.greenDark} accessibilityLabel="Pioneiro regular" /> : null}
      </Pressable>
    );
  };

  const opcoesDaEscolha = escolhendo
    ? todos
      ? opcoesCadastro
      : [
          ...escolhendo.casamento.sugestoes.map((s) => ({ value: String(s.id), label: s.nome, badge: "parecido" })),
          ...(escolhendo.casamento.irmao ? [{ value: String(escolhendo.casamento.irmao.id), label: escolhendo.casamento.irmao.nome, badge: "achado" }] : []),
          { value: NOVO, label: `Cadastrar "${escolhendo.nome}" como novo` },
          { value: OUTRO, label: "Escolher outro do cadastro..." },
        ]
    : [];

  return (
    <View style={styles.tela}>
      <GradientHeader title="Nova divisão dos grupos" description="A partir do PDF da lista" showBack />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        {!dados ? (
          <View style={styles.bloco}>
            <Text style={styles.blocoTitulo}>Como funciona</Text>
            <Text style={styles.texto}>
              Escolha o PDF da lista de grupos. O app lê cada grupo (número, local, dirigente, ajudante e membros) e
              reconhece em verde os pioneiros regulares. Antes de gravar, você confere aqui quem é quem no cadastro.
            </Text>
            <Button label="Escolher o PDF" icon="document-attach-outline" onPress={escolher} loading={previa.isPending} fullWidth />
          </View>
        ) : (
          <>
            <View style={styles.resumo}>
              <Text style={styles.resumoTexto}>
                {dados.grupos.length} grupos · {dados.grupos.reduce((s, g) => s + g.membros.length, 0)} pessoas ·{" "}
                {dados.grupos.reduce((s, g) => s + g.membros.filter((m) => m.pioneiro).length, 0)} pioneiros regulares
              </Text>
              <Pressable onPress={escolher} hitSlop={8}>
                <Text style={styles.trocar}>Trocar PDF</Text>
              </Pressable>
            </View>

            {dados.avisos.length > 0 ? (
              <View style={styles.aviso}>
                <Ionicons name="warning-outline" size={17} color={colors.amber} />
                <Text style={[styles.texto, styles.flex]}>{dados.avisos.join("\n")}</Text>
              </View>
            ) : null}

            {dados.grupos.map((g, gi) => (
              <Animated.View key={gi} entering={FadeInDown.duration(220).delay(Math.min(gi, 8) * 40)} style={styles.bloco}>
                <Text style={styles.blocoTitulo}>
                  Grupo {g.numero ?? gi + 1}
                  {g.local ? <Text style={styles.local}> · {g.local}</Text> : null}
                </Text>
                {lideres(g, gi).map(({ papel, l, chave }) =>
                  l.membro !== null ? (
                    <View key={chave} style={styles.nome}>
                      <Ionicons name="person-circle-outline" size={18} color={colors.primaryDark} />
                      <Text style={[styles.nomeTexto, styles.flex]}>
                        <Text style={styles.papel}>{papel}: </Text>
                        {l.membro}
                      </Text>
                    </View>
                  ) : (
                    linha(chave, l.nome, l, { papel })
                  ),
                )}
                <Text style={styles.subtitulo}>Membros ({g.membros.length})</Text>
                {g.membros.map((m, mi) => linha(`${gi}|${mi}`, m.nome, m, { pioneiro: m.pioneiro }))}
              </Animated.View>
            ))}

            {dados.saem.length > 0 ? (
              <View style={styles.bloco}>
                <View style={styles.linhaSwitch}>
                  <View style={styles.flex}>
                    <Text style={styles.blocoTitulo}>Não estão na lista nova ({dados.saem.length})</Text>
                    <Text style={styles.texto}>Estão num grupo hoje e não aparecem no PDF.</Text>
                  </View>
                  <Switch value={tirar} onValueChange={setTirar} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel="Tirar dos grupos" />
                </View>
                <Text style={styles.texto}>{tirar ? "Saem dos grupos" : "Continuam onde estão"}: {dados.saem.map((p) => p.nome).join(", ")}</Text>
              </View>
            ) : null}

            {pendentes.length > 0 ? (
              <Text style={[styles.texto, { color: colors.amber, textAlign: "center" }]}>
                Falta escolher quem é: {pendentes.join(", ")}
              </Text>
            ) : null}
            <Button
              label="Aplicar a nova divisão"
              icon="checkmark-done"
              onPress={confirmar}
              loading={aplicar.isPending}
              disabled={pendentes.length > 0}
              fullWidth
            />
          </>
        )}
      </ScrollView>

      <SelectSheet
        visible={!!escolhendo}
        title={todos ? "Quem do cadastro?" : `Quem é "${escolhendo?.nome ?? ""}"?`}
        options={opcoesDaEscolha}
        allowClear={false}
        onSelect={(v) => {
          if (!escolhendo) return;
          if (v === OUTRO) {
            manterAberta.current = true;
            setTodos(true);
            return;
          }
          setEscolhas((atual) => ({ ...atual, [escolhendo.chave]: v === NOVO ? "novo" : { irmaoId: Number(v) } }));
          setEscolhendo(null);
          setTodos(false);
        }}
        onClose={() => {
          if (manterAberta.current) {
            manterAberta.current = false;
            return;
          }
          setEscolhendo(null);
          setTodos(false);
        }}
      />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, gap: 12 },
    flex: { flex: 1 },
    bloco: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 14,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    blocoTitulo: { fontSize: 16, fontWeight: "800", color: colors.text },
    local: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
    subtitulo: { fontSize: 12, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 6 },
    texto: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 19 },
    resumo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    resumoTexto: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
    trocar: { fontSize: 13.5, fontWeight: "800", color: colors.primaryDark },
    aviso: {
      flexDirection: "row",
      gap: 10,
      padding: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.warningBg,
    },
    nome: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
    nomeTexto: { fontSize: 14.5, fontWeight: "600", color: colors.text },
    nomeCadastro: { fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
    papel: { fontWeight: "800", color: colors.primaryDark },
    linhaSwitch: { flexDirection: "row", alignItems: "center", gap: 12 },
  });
