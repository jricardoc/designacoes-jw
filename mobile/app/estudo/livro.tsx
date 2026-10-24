import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMarcarLeitura } from "@/api/hooks/useEstudo";
import { linkWol, LIVROS } from "@/components/estudo/biblia";
import { Cartao, useAbrir, useLeitura, useLerEMarcar } from "@/components/estudo/comum";
import { capitulosLidos } from "@/components/estudo/programas";
import { MenuAcoes, Topo } from "@/components/ministerio/kit";
import { Button } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/**
 * Um livro da Bíblia, capítulo por capítulo: ler (JW Library ou Biblioteca On-line) e marcar.
 * O que foi lido em qualquer programa já aparece marcado; aqui se marca a leitura livre.
 */
export default function LivroEstudo() {
  const { styles } = useTema(criarEstilos);
  const n = Number(useLocalSearchParams<{ n: string }>().n);
  const livro = LIVROS[n - 1];
  const { estado, reunioes } = useLeitura();
  const marcar = useMarcarLeitura();
  const abrir = useAbrir();
  const ler = useLerEMarcar();
  const [capitulo, setCapitulo] = useState<number | null>(null);

  const lidos = useMemo(() => (estado ? capitulosLidos(estado.leituras, reunioes) : new Set<string>()), [estado, reunioes]);
  const livres = useMemo(() => new Set((estado?.leituras ?? []).filter((l) => l.plano === "livre").map((l) => l.item)), [estado]);
  if (!livro) return <Topo titulo="Livro" inicio="/estudo" />;

  const caps = Array.from({ length: livro.capitulos }, (_, i) => i + 1);
  const quantos = caps.filter((c) => lidos.has(`${n}:${c}`)).length;
  const faltam = caps.filter((c) => !lidos.has(`${n}:${c}`)).map((c) => `${n}:${c}`);
  const id = (c: number) => `${n}:${c}`;

  return (
    <View style={styles.tela}>
      <Topo titulo={livro.nome} inicio="/estudo" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Cartao style={styles.gap}>
          <Text style={styles.medio}>
            {quantos} de {livro.capitulos} {livro.capitulos === 1 ? "capítulo lido" : "capítulos lidos"}
          </Text>
          <Text style={styles.texto}>Toque num capítulo para ler no JW Library ou na Biblioteca On-line, e para marcar.</Text>
          {faltam.length ? (
            <Button
              label={faltam.length === livro.capitulos ? "Marcar o livro todo" : "Marcar o resto do livro"}
              icon="checkmark-done"
              variant="secondary"
              onPress={() => marcar.mutate({ plano: "livre", itens: faltam })}
              fullWidth
            />
          ) : null}
        </Cartao>
        <View style={styles.grade}>
          {caps.map((c) => {
            const lido = lidos.has(id(c));
            return (
              <Pressable
                key={c}
                onPress={() => setCapitulo(c)}
                style={({ pressed }) => [styles.cap, lido && styles.capLido, pressed && styles.pressionado]}
                accessibilityRole="button"
                accessibilityLabel={`Capítulo ${c}${lido ? ", lido" : ""}`}
              >
                <Text style={[styles.capTexto, lido && styles.capTextoLido]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <MenuAcoes
        visible={capitulo !== null}
        onClose={() => setCapitulo(null)}
        titulo={capitulo ? `${livro.nome} ${capitulo}` : null}
        subtitulo={capitulo && lidos.has(id(capitulo)) && !livres.has(id(capitulo)) ? "Lido no programa de leitura" : null}
        acoes={
          capitulo
            ? [
                {
                  rotulo: "Ler no JW Library",
                  icone: "book",
                  onPress: () => ler("livre", { id: id(capitulo), titulo: `${livro.nome} ${capitulo}`, partes: [{ livro: n, de: capitulo, ate: capitulo }] }),
                },
                { rotulo: "Abrir na Biblioteca On-line", icone: "globe-outline", onPress: () => abrir(linkWol(n, capitulo)) },
                ...(livres.has(id(capitulo))
                  ? [{ rotulo: "Desmarcar", icone: "close-circle-outline" as const, onPress: () => marcar.mutate({ plano: "livre", itens: [id(capitulo)], lido: false }) }]
                  : lidos.has(id(capitulo))
                    ? []
                    : [{ rotulo: "Marcar como lido", icone: "checkmark-circle-outline" as const, onPress: () => marcar.mutate({ plano: "livre", itens: [id(capitulo)] }) }]),
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
    scroll: { paddingHorizontal: 16, paddingBottom: 40, gap: 14 },
    gap: { gap: 10 },
    pressionado: { opacity: 0.7 },
    medio: { fontSize: 17, fontWeight: "800", color: colors.text },
    texto: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
    grade: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    cap: {
      width: 52,
      height: 52,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    capLido: { backgroundColor: colors.primary, borderColor: colors.primary },
    capTexto: { fontSize: 16, fontWeight: "800", color: colors.text },
    capTextoLido: { color: colors.textOnPrimary },
  });
