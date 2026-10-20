import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TipoAssistencia } from "@/api/types";

/**
 * A assistência de uma reunião como imagem, para mandar no WhatsApp.
 *
 * Mesma mecânica e mesmas cores do SemanaShareCard: renderiza fora da tela e o
 * react-native-view-shot captura. As cores são fixas, e não as do tema, para a imagem sair
 * igual de quem está no modo escuro.
 */

const LARGURA = 600;

export interface AssistenciaShareCardProps {
  tipo: TipoAssistencia;
  /** "Quinta, 16/10/2026" */
  data: string;
  presencial: number;
  zoom: number;
  congregacao?: string | null;
}

function parte(icone: keyof typeof Ionicons.glyphMap, rotulo: string, valor: number) {
  return (
    <View style={styles.parte}>
      <Ionicons name={icone} size={30} color="#5E6B48" />
      <Text style={styles.parteValor}>{valor}</Text>
      <Text style={styles.parteRotulo}>{rotulo}</Text>
    </View>
  );
}

export const AssistenciaShareCard = forwardRef<View, AssistenciaShareCardProps>(
  function AssistenciaShareCard({ tipo, data, presencial, zoom, congregacao }, ref) {
    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        <LinearGradient
          colors={["#6E7B57", "#5E6B48"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Text style={styles.headerRotulo}>ASSISTÊNCIA DA REUNIÃO</Text>
          <Text style={styles.headerTipo}>
            {tipo === "meio" ? "Meio de semana" : "Fim de semana"}
          </Text>
          <Text style={styles.headerData}>{data}</Text>
        </LinearGradient>

        <View style={styles.corpo}>
          <Text style={styles.totalRotulo}>TOTAL</Text>
          <Text style={styles.total}>{presencial + zoom}</Text>
          <View style={styles.partes}>
            {parte("people", "Presencial", presencial)}
            {parte("videocam", "Pelo Zoom", zoom)}
          </View>
        </View>

        {congregacao ? <Text style={styles.rodape}>{congregacao}</Text> : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: { width: LARGURA, backgroundColor: "#FBF7EF" },
  header: { padding: 28, gap: 6 },
  headerRotulo: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  headerTipo: { color: "#fff", fontSize: 36, fontWeight: "800" },
  headerData: { color: "rgba(255,255,255,0.92)", fontSize: 20 },
  corpo: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 28 },
  totalRotulo: {
    fontSize: 16,
    fontWeight: "800",
    color: "#8A8071",
    letterSpacing: 1.2,
  },
  total: { fontSize: 104, fontWeight: "800", color: "#2B2620", lineHeight: 116 },
  partes: { flexDirection: "row", gap: 16, marginTop: 18, alignSelf: "stretch" },
  parte: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3EDE2",
    borderRadius: 18,
    paddingVertical: 18,
  },
  parteValor: { fontSize: 40, fontWeight: "800", color: "#2B2620" },
  parteRotulo: {
    fontSize: 15,
    fontWeight: "700",
    color: "#8A8071",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
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
