import { LinearGradient } from "expo-linear-gradient";
import { forwardRef, useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

/**
 * O mapa do território como imagem, com os pinos marcados, para mandar no WhatsApp.
 *
 * Mesma mecânica do AssistenciaShareCard: renderiza fora da tela e o react-native-view-shot
 * captura. A foto do mapa vem pronta (MapaTerritorio.foto()); o cartão só avisa que está
 * pronto depois que ela carregou e ganhou a proporção certa, senão a imagem sai em branco.
 * Cores fixas, e não as do tema, para a imagem sair igual do modo escuro.
 */

const LARGURA = 600;

export interface ItemLegenda {
  letra: string;
  rotulo: string;
  cor: string;
  quantidade: number;
}

export interface MapaShareCardProps {
  numero: string;
  nome: string;
  descricao?: string | null;
  /** file:// da foto do mapa. */
  foto: string;
  legenda: ItemLegenda[];
  /** "23/10/2026 às 14:05" */
  geradoEm: string;
  onPronto: () => void;
  onErro: () => void;
}

export const MapaShareCard = forwardRef<View, MapaShareCardProps>(function MapaShareCard(
  { numero, nome, descricao, foto, legenda, geradoEm, onPronto, onErro },
  ref,
) {
  const [proporcao, setProporcao] = useState<number | null>(null);

  useEffect(() => {
    if (proporcao) onPronto();
    // Só quando a foto ganhou a proporção: é o sinal de que dá para capturar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proporcao]);

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <LinearGradient colors={["#6E7B57", "#5E6B48"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <Text style={styles.headerRotulo}>MAPA DO TERRITÓRIO</Text>
        <Text style={styles.headerTitulo}>{nome || `Território ${numero}`}</Text>
        <Text style={styles.headerNome}>Território {numero}</Text>
        {descricao ? <Text style={styles.headerDescricao}>{descricao}</Text> : null}
      </LinearGradient>

      <Image
        source={{ uri: foto }}
        style={{ width: LARGURA, aspectRatio: proporcao ?? 1 }}
        resizeMode="cover"
        onLoad={(e) => {
          const { width, height } = e.nativeEvent.source;
          setProporcao(width && height ? width / height : 1);
        }}
        onError={onErro}
      />

      {legenda.length > 0 ? (
        <View style={styles.legenda}>
          {legenda.map((item) => (
            <View key={item.rotulo} style={styles.item}>
              <View style={[styles.bolinha, { backgroundColor: item.cor }]}>
                <Text style={styles.letra}>{item.letra}</Text>
              </View>
              <Text style={styles.itemTexto}>
                {item.rotulo}
                {item.quantidade > 1 ? ` (${item.quantidade})` : ""}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.rodape}>Servir Mais · {geradoEm}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: LARGURA, backgroundColor: "#FBF7EF" },
  header: { padding: 28, gap: 4 },
  headerRotulo: { color: "rgba(255,255,255,0.85)", fontSize: 16, fontWeight: "800", letterSpacing: 1.3 },
  headerTitulo: { color: "#fff", fontSize: 36, fontWeight: "800" },
  headerNome: { color: "rgba(255,255,255,0.95)", fontSize: 22, fontWeight: "700" },
  headerDescricao: { color: "rgba(255,255,255,0.88)", fontSize: 18, lineHeight: 24, marginTop: 4 },
  legenda: { flexDirection: "row", flexWrap: "wrap", gap: 14, paddingHorizontal: 28, paddingVertical: 22 },
  item: { flexDirection: "row", alignItems: "center", gap: 8 },
  bolinha: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  letra: { color: "#fff", fontSize: 15, fontWeight: "900" },
  itemTexto: { fontSize: 17, fontWeight: "700", color: "#2B2620" },
  rodape: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
    color: "#8A8071",
    borderTopWidth: 1,
    borderTopColor: "#ECE3D3",
    paddingVertical: 16,
  },
});
