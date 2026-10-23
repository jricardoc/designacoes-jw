import { StyleSheet, Text, View } from "react-native";
import type { Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/** "**negrito**" dentro da linha. */
function comNegrito(texto: string, estiloNegrito: object) {
  return texto.split(/\*\*(.+?)\*\*/g).map((pedaco, i) =>
    i % 2 === 1 ? (
      <Text key={i} style={estiloNegrito}>
        {pedaco}
      </Text>
    ) : (
      pedaco.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    ),
  );
}

/**
 * O resumo do Zoom como veio (Markdown), lido na tela: títulos (#, ##, ###), listas com
 * recuo e negrito. É o que o AI Companion usa; o resto aparece como texto.
 */
export function MarkdownSimples({ texto }: { texto: string }) {
  const { styles } = useTema(criarEstilos);
  const linhas = texto.replace(/\r/g, "").split("\n");
  return (
    <View style={styles.bloco}>
      {linhas.map((linha, i) => {
        const titulo = /^(#{1,3})\s+(.+)$/.exec(linha);
        if (titulo) {
          const nivel = titulo[1].length;
          return (
            <Text key={i} style={nivel === 1 ? styles.h1 : nivel === 2 ? styles.h2 : styles.h3} accessibilityRole="header">
              {comNegrito(titulo[2], styles.negrito)}
            </Text>
          );
        }
        const item = /^(\s*)(?:[-*+]|(\d+)[.)])\s+(.*)$/.exec(linha);
        if (item) {
          const recuo = Math.min(3, Math.floor(item[1].replace(/\t/g, "    ").length / 2));
          return (
            <View key={i} style={[styles.item, { paddingLeft: recuo * 14 }]}>
              <Text style={styles.marca}>{item[2] ? `${item[2]}.` : recuo > 0 ? "◦" : "•"}</Text>
              <Text style={styles.texto}>{comNegrito(item[3], styles.negrito)}</Text>
            </View>
          );
        }
        if (!linha.trim()) return <View key={i} style={styles.espaco} />;
        return (
          <Text key={i} style={styles.texto}>
            {comNegrito(linha.trim(), styles.negrito)}
          </Text>
        );
      })}
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    bloco: { gap: 3 },
    h1: { fontSize: 19, fontWeight: "800", color: colors.text, marginTop: 6 },
    h2: { fontSize: 16.5, fontWeight: "800", color: colors.text, marginTop: 10 },
    h3: { fontSize: 15, fontWeight: "800", color: colors.primaryDark, marginTop: 8 },
    item: { flexDirection: "row", gap: 6 },
    marca: { fontSize: 14.5, color: colors.textSecondary, lineHeight: 21, minWidth: 12 },
    texto: { flex: 1, fontSize: 14.5, color: colors.text, lineHeight: 21 },
    negrito: { fontWeight: "800" },
    espaco: { height: 4 },
  });
