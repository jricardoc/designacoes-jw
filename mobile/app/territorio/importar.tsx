import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAtualizarMyMaps, useImportarMyMaps, usePreviaMyMaps } from "@/api/hooks/useTerritorios";
import type { CamadaMyMaps } from "@/api/types";
import { Button, GradientHeader, useToast } from "@/components/ui";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

interface Escolha {
  camada: CamadaMyMaps;
  incluir: boolean;
  numero: string;
  nome: string;
}

/**
 * Importar do My Maps: cola os links, o servidor lê os mapas e devolve as camadas; cada camada
 * vira um território, com o número sugerido pela semelhança de nome. Quem importa confere e
 * ajusta antes de gravar — nada é gravado na leitura.
 */
export default function ImportarMyMapsScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const previa = usePreviaMyMaps();
  const importar = useImportarMyMaps();
  const atualizar = useAtualizarMyMaps();
  const [links, setLinks] = useState("");
  const [escolhas, setEscolhas] = useState<Escolha[]>([]);

  const ler = () =>
    previa.mutate(
      links
        .split(/[\s,]+/)
        .map((l) => l.trim())
        .filter(Boolean),
      {
        onSuccess: (r) => {
          const comErro = r.mapas.filter((m) => m.erro);
          if (comErro.length) toast.show(comErro.map((m) => m.erro).join("\n"), "error");
          setEscolhas(
            r.camadas.map((c) => ({
              camada: c,
              incluir: !c.repetida,
              numero: c.numeroSugerido ?? "",
              nome: c.camada,
            })),
          );
        },
        onError: (e) => toast.show(e.message, "error"),
      },
    );

  const mudar = (i: number, parcial: Partial<Escolha>) =>
    setEscolhas((lista) => lista.map((e, j) => (j === i ? { ...e, ...parcial } : e)));

  const escolhidas = escolhas.filter((e) => e.incluir);
  const semNumero = escolhidas.filter((e) => !e.numero.trim()).length;

  const gravar = () =>
    importar.mutate(
      escolhidas.map((e) => ({ mid: e.camada.mid, camada: e.camada.camada, numero: e.numero.trim(), nome: e.nome.trim() })),
      {
        onSuccess: (r) => {
          if (r.erros.length) {
            toast.show(r.erros.map((e) => `${e.numero}: ${e.erro}`).join("\n"), "error");
          } else {
            toast.show(`${r.importados.length} territórios importados!`);
            router.back();
          }
        },
        onError: (e) => toast.show(e.message, "error"),
      },
    );

  return (
    <View style={styles.flex}>
      <GradientHeader title="Importar do My Maps" description="Cada camada do mapa vira um território" showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.cartao}>
          <Text style={styles.titulo}>Já importou antes?</Text>
          <Text style={styles.ajuda}>
            Editou o desenho no My Maps? Busque as mudanças sem mexer nos números, nas saídas nem nos pontos marcados.
          </Text>
          <Button
            label="Atualizar do My Maps"
            icon="refresh"
            variant="secondary"
            loading={atualizar.isPending}
            onPress={() =>
              atualizar.mutate(undefined, {
                onSuccess: (r) =>
                  toast.show(
                    `${r.atualizados.length} atualizados` +
                      (r.naoEncontrados.length ? ` · camada não achada: ${r.naoEncontrados.join(", ")}` : "") +
                      (r.erros.length ? ` · ${r.erros[0].erro}` : ""),
                    r.erros.length || r.naoEncontrados.length ? "error" : undefined,
                  ),
                onError: (e) => toast.show(e.message, "error"),
              })
            }
            fullWidth
          />
        </View>

        <View style={styles.cartao}>
          <Text style={styles.titulo}>1. Cole os links dos mapas</Text>
          <Text style={styles.ajuda}>
            No My Maps: Compartilhar → “Qualquer pessoa com o link pode ver” → copiar. Um link por linha.
          </Text>
          <TextInput
            value={links}
            onChangeText={setLinks}
            placeholder="https://www.google.com/maps/d/edit?mid=..."
            placeholderTextColor={colors.textMuted}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.links}
          />
          <Button label="Ler os mapas" icon="search" onPress={ler} loading={previa.isPending} disabled={!links.trim()} fullWidth />
        </View>

        {escolhas.length > 0 ? (
          <>
            <Text style={styles.secao}>2. Confira o número de cada território</Text>
            <Text style={styles.ajuda}>
              O número liga o mapa ao cartão que vocês já usam. Camadas repetidas em dois mapas vêm desmarcadas.
            </Text>
            {escolhas.map((e, i) => (
              <View key={`${e.camada.mid}-${e.camada.camada}`} style={[styles.camada, !e.incluir && styles.camadaFora]}>
                <Pressable style={styles.camadaTopo} onPress={() => mudar(i, { incluir: !e.incluir })}>
                  <Ionicons
                    name={e.incluir ? "checkbox" : "square-outline"}
                    size={24}
                    color={e.incluir ? colors.primary : colors.textMuted}
                  />
                  <View style={[styles.cor, { backgroundColor: e.camada.cor ?? colors.primary }]} />
                  <View style={styles.flex1}>
                    <Text style={styles.camadaNome}>{e.camada.camada}</Text>
                    <Text style={styles.camadaSub} numberOfLines={2}>
                      {e.camada.quadras} quadra{e.camada.quadras > 1 ? "s" : ""}: {e.camada.nomesQuadras.join(", ")}
                    </Text>
                    {e.camada.repetida ? <Text style={styles.aviso}>Repetida em outro mapa</Text> : null}
                    {e.camada.territorioAtual ? (
                      <Text style={styles.ok}>Já importada como território {e.camada.territorioAtual}</Text>
                    ) : null}
                  </View>
                </Pressable>
                {e.incluir ? (
                  <View style={styles.campos}>
                    <TextInput
                      value={e.numero}
                      onChangeText={(v) => mudar(i, { numero: v })}
                      placeholder="Nº"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="characters"
                      style={[styles.campo, styles.campoNumero, !e.numero.trim() && styles.campoFaltando]}
                    />
                    <TextInput
                      value={e.nome}
                      onChangeText={(v) => mudar(i, { nome: v })}
                      placeholder="Nome"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.campo, styles.flex1]}
                    />
                  </View>
                ) : null}
              </View>
            ))}
            <Button
              label={
                semNumero
                  ? `Falta o número de ${semNumero} território${semNumero > 1 ? "s" : ""}`
                  : `Importar ${escolhidas.length} territórios`
              }
              icon="cloud-download"
              onPress={gravar}
              loading={importar.isPending}
              disabled={escolhidas.length === 0 || semNumero > 0}
              fullWidth
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    flex1: { flex: 1 },
    scroll: { padding: 16, gap: 12 },
    cartao: { gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    titulo: { fontSize: 16.5, fontWeight: "800", color: colors.text },
    secao: { fontSize: 16.5, fontWeight: "800", color: colors.text, marginTop: 8 },
    ajuda: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    links: {
      minHeight: 110,
      textAlignVertical: "top",
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      padding: 12,
      fontSize: 13.5,
      color: colors.text,
    },
    camada: { gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
    camadaFora: { opacity: 0.6 },
    camadaTopo: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    cor: { width: 12, height: 12, borderRadius: 6, marginTop: 6 },
    camadaNome: { fontSize: 15.5, fontWeight: "800", color: colors.text },
    camadaSub: { fontSize: 12.5, color: colors.textSecondary },
    aviso: { fontSize: 12.5, fontWeight: "700", color: colors.amber, marginTop: 2 },
    ok: { fontSize: 12.5, fontWeight: "700", color: colors.greenDark, marginTop: 2 },
    campos: { flexDirection: "row", gap: 8 },
    campo: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    campoNumero: { width: 72, fontWeight: "800", textAlign: "center" },
    campoFaltando: { borderColor: colors.amber },
  });
