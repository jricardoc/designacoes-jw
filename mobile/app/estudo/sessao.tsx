import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEstudo, useSessaoEstudo } from "@/api/hooks/useEstudo";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { Cartao, LinkFonte, useAbrir } from "@/components/estudo/comum";
import { FONTES, LINKS, PASSOS, TIPOS_ASSUNTO } from "@/components/estudo/dicas";
import { AssuntoSheet, Fichas } from "@/components/estudo/folhas";
import { Topo } from "@/components/ministerio/kit";
import { Button, Loading, TextField, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

const doisDig = (n: number) => String(n).padStart(2, "0");
/** 754 s -> "12:34"; 3754 s -> "1:02:34". */
const relogio = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}:${doisDig(Math.floor(s / 60) % 60)}:${doisDig(s % 60)}` : `${doisDig(Math.floor(s / 60))}:${doisDig(s % 60)}`);

interface Rascunho {
  passos: number[];
  resumo: string;
  aplicacao: string;
  ideias: string;
}
const VAZIO: Rascunho = { passos: [], resumo: "", aplicacao: "", ideias: "" };

/**
 * A sessão de estudo: escolher o assunto, o cronômetro (no servidor: fechar o app não perde), o
 * passo a passo dos artigos e, no fim, o resumo, a aplicação e as ideias novas para a lista.
 * As anotações ficam num rascunho no celular enquanto a pessoa lê no JW Library: se o sistema
 * fechar o app, nada se perde.
 */
export default function SessaoEstudo() {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const abrir = useAbrir();
  const { feito } = useCelebracao();
  const { data: estado } = useEstudo();
  const sessao = useSessaoEstudo();
  const [assuntoId, setAssuntoId] = useState(0);
  const [novoAssunto, setNovoAssunto] = useState(false);
  const [busca, setBusca] = useState("");
  const [rascunho, setRascunho] = useState<Rascunho>(VAZIO);
  const [agora, setAgora] = useState(Date.now());

  const inicio = estado?.perfil.sessaoInicio ?? null;
  const chave = inicio ? `estudo_rascunho_${inicio}` : null;

  // O relógio anda de segundo em segundo enquanto o estudo roda.
  useEffect(() => {
    if (!inicio) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [inicio]);

  // O rascunho deste estudo (se o app foi fechado no meio) volta; o de um estudo velho, não.
  useEffect(() => {
    if (!chave) return;
    AsyncStorage.getItem(chave)
      .then((t) => setRascunho(t ? { ...VAZIO, ...JSON.parse(t) } : VAZIO))
      .catch(() => {});
  }, [chave]);

  const mudar = (parte: Partial<Rascunho>) =>
    setRascunho((r) => {
      const novo = { ...r, ...parte };
      if (chave) AsyncStorage.setItem(chave, JSON.stringify(novo)).catch(() => {});
      return novo;
    });

  if (!estado) {
    return (
      <View style={styles.tela}>
        <Topo titulo="Estudo pessoal" inicio="/estudo" />
        <Loading label="Carregando..." />
      </View>
    );
  }

  const pendentes = estado.assuntos.filter((a) => !a.estudadoEm).reverse();
  const assunto = inicio ? estado.assuntos.find((a) => a.id === estado.perfil.sessaoAssuntoId) ?? null : null;
  const segundos = inicio ? Math.max(0, Math.floor((agora - new Date(inicio).getTime()) / 1000)) : 0;
  const limpar = () => (chave ? AsyncStorage.removeItem(chave).catch(() => {}) : undefined);

  const comecar = () =>
    sessao.mutate({ acao: "iniciar", assuntoId: assuntoId || null }, { onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para começar", "error") });

  const concluir = () =>
    sessao.mutate(
      {
        acao: "concluir",
        resumo: rascunho.resumo.trim() || undefined,
        aplicacao: rascunho.aplicacao.trim() || undefined,
        estudado: !!assunto,
        ideias: rascunho.ideias.split("\n").map((t) => t.trim()).filter(Boolean),
      },
      {
        onSuccess: (r) => {
          limpar();
          feito({
            titulo: "Estudo concluído",
            detalhe: `${r.sessao?.minutos ?? Math.max(1, Math.round(segundos / 60))} min${r.ideias ? ` · ${r.ideias} ${r.ideias === 1 ? "ideia nova" : "ideias novas"} na lista` : ""}`,
            icone: "bulb",
          });
          router.back();
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para concluir", "error"),
      },
    );

  const descartar = () =>
    Alert.alert("Descartar este estudo?", "O tempo e as anotações não ficam guardados.", [
      { text: "Continuar estudando", style: "cancel" },
      {
        text: "Descartar",
        style: "destructive",
        onPress: () =>
          sessao.mutate(
            { acao: "descartar" },
            {
              onSuccess: () => {
                limpar();
                router.back();
              },
            },
          ),
      },
    ]);

  if (!inicio) {
    return (
      <View style={styles.tela}>
        <Topo titulo="Estudo pessoal" inicio="/estudo" />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Cartao style={styles.gap}>
            <Text style={styles.titulo}>O que vai estudar?</Text>
            {pendentes.length ? (
              <Fichas opcoes={[...pendentes.map((a) => ({ valor: a.id, rotulo: a.titulo })), { valor: 0, rotulo: "Sem assunto" }]} valor={assuntoId} onMudar={setAssuntoId} />
            ) : (
              <Text style={styles.texto}>A lista está vazia. Escolher o assunto antes ajuda a não gastar a hora do estudo nisso.</Text>
            )}
            <Button label="Anotar um assunto" icon="add" variant="secondary" onPress={() => setNovoAssunto(true)} fullWidth />
            <LinkFonte fonte={FONTES.regularidade} />
          </Cartao>
          <Button label="Começar" icon="play" onPress={comecar} loading={sessao.isPending} fullWidth />
          <Text style={styles.centro}>Sem vontade? Comece com dez minutos. Pouco tempo é melhor do que nada.</Text>
        </ScrollView>
        <AssuntoSheet visible={novoAssunto} onClose={() => setNovoAssunto(false)} />
      </View>
    );
  }

  const meta = Math.min(1, segundos / 600);

  return (
    <View style={styles.tela}>
      <Topo titulo="Estudo pessoal" inicio="/estudo" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Cartao style={[styles.gap, styles.centrado]}>
          <Text style={styles.relogio} accessibilityLabel={`${Math.floor(segundos / 60)} minutos de estudo`}>
            {relogio(segundos)}
          </Text>
          <View style={styles.barra}>
            <View style={[styles.barraCheia, { width: `${meta * 100}%` }]} />
          </View>
          <Text style={styles.texto}>{meta < 1 ? "Os primeiros 10 minutos já valem." : "Dez minutos feitos. Continue o quanto der."}</Text>
        </Cartao>

        {assunto ? (
          <Cartao style={styles.gap}>
            <Text style={styles.etiqueta}>{TIPOS_ASSUNTO[assunto.tipo].rotulo.toUpperCase()}</Text>
            <Text style={styles.titulo}>{assunto.titulo}</Text>
            {assunto.nota ? <Text style={styles.texto}>{assunto.nota}</Text> : null}
            {assunto.link ? <Button label="Abrir" icon="open-outline" variant="secondary" onPress={() => abrir(assunto.link!)} fullWidth /> : null}
          </Cartao>
        ) : null}

        <Cartao style={styles.gap}>
          <Text style={styles.titulo}>Passo a passo</Text>
          {PASSOS.map((p, i) => {
            const feitoPasso = rascunho.passos.includes(i);
            return (
              <Pressable
                key={p.titulo}
                onPress={() => mudar({ passos: feitoPasso ? rascunho.passos.filter((x) => x !== i) : [...rascunho.passos, i] })}
                style={styles.passo}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: feitoPasso }}
              >
                <Ionicons name={feitoPasso ? "checkmark-circle" : p.icone} size={22} color={feitoPasso ? colors.green : colors.primary} />
                <View style={styles.flex}>
                  <Text style={[styles.passoTitulo, feitoPasso && styles.passoFeito]}>{p.titulo}</Text>
                  <Text style={styles.texto}>{p.texto}</Text>
                </View>
              </Pressable>
            );
          })}
          <LinkFonte fonte={FONTES.proveito} />
        </Cartao>

        <Cartao style={styles.gap}>
          <Text style={styles.titulo}>Pesquisar</Text>
          <TextField icon="search" placeholder="Um assunto, um texto bíblico..." value={busca} onChangeText={setBusca} returnKeyType="search" onSubmitEditing={() => busca.trim() && abrir(LINKS.pesquisar(busca))} />
          <Button label="Pesquisar na Biblioteca On-line" icon="search" variant="secondary" disabled={!busca.trim()} onPress={() => abrir(LINKS.pesquisar(busca))} fullWidth />
        </Cartao>

        <Cartao style={styles.gap}>
          <Text style={styles.titulo}>Para guardar o que aprendeu</Text>
          <TextField label="Resuma numa frase" value={rascunho.resumo} onChangeText={(resumo) => mudar({ resumo })} maxLength={1000} multiline />
          <TextField label="O que isso significa na minha vida?" value={rascunho.aplicacao} onChangeText={(aplicacao) => mudar({ aplicacao })} maxLength={1000} multiline />
          <TextField
            label="Novas ideias para estudar (uma por linha)"
            value={rascunho.ideias}
            onChangeText={(ideias) => mudar({ ideias })}
            maxLength={1000}
            multiline
          />
          <LinkFonte fonte={FONTES.comoEsta} />
        </Cartao>

        <Button label="Concluir estudo" icon="checkmark" onPress={concluir} loading={sessao.isPending} fullWidth />
        <Button label="Descartar" icon="close" variant="ghost" onPress={descartar} fullWidth />
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
    centrado: { alignItems: "center" },
    etiqueta: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.6, color: colors.textMuted },
    titulo: { fontSize: 17, fontWeight: "800", color: colors.text },
    texto: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
    centro: { fontSize: 13.5, lineHeight: 19, color: colors.textSecondary, textAlign: "center" },
    relogio: { fontSize: 48, fontWeight: "900", color: colors.text, fontVariant: ["tabular-nums"], letterSpacing: -1 },
    barra: { alignSelf: "stretch", height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    barraCheia: { height: 8, borderRadius: 4, backgroundColor: colors.amber },
    passo: { flexDirection: "row", gap: 12, paddingVertical: 6, borderRadius: radius.md },
    passoTitulo: { fontSize: 15, fontWeight: "800", color: colors.text },
    passoFeito: { color: colors.green },
  });
