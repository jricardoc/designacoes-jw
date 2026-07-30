import { LinearGradient } from "expo-linear-gradient";
import { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Quadro } from "@/api/types";
import { MESES_CURTO, MESES } from "@/theme";
import type { GrupoDia } from "@/utils/designacaoRules";
import { ordenarFuncoes } from "@/utils/funcoes";

/**
 * Um dia do quadro no visual do PDF (gerarHtmlQuadro / TabelaPDF do web), para virar imagem
 * via react-native-view-shot e ser compartilhado sozinho.
 *
 * As cores aqui sao as do PDF (azul/roxo), NAO as do tema terroso do app: o irmao que recebe
 * a imagem no WhatsApp reconhece o quadro que ja conhece impresso.
 *
 * Renderiza fora da tela (o pai o posiciona), entao a largura e fixa em px: o resultado nao
 * pode depender do tamanho do aparelho de quem compartilha.
 */

const LARGURA = 760;

export interface DiaShareCardProps {
  quadro: Quadro;
  grupo: GrupoDia;
}

export const DiaShareCard = forwardRef<View, DiaShareCardProps>(
  function DiaShareCard({ quadro, grupo }, ref) {
    const funcoes = ordenarFuncoes(grupo.funcoes);
    const isDomingo = grupo.dia === "Domingo";
    const mesLongo = (MESES[quadro.mes] ?? "").toUpperCase();

    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        <LinearGradient
          colors={["#2563eb", "#7c3aed"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>
            Quadro de Designações {mesLongo} {quadro.ano}
          </Text>
          {quadro.status === "rascunho" ? (
            <View style={styles.rascunhoTag}>
              <Text style={styles.rascunhoText}>RASCUNHO — SUJEITO A ALTERAÇÃO</Text>
            </View>
          ) : null}
        </LinearGradient>

        <View style={styles.colunas}>
          <Text style={[styles.colunaLabel, styles.colData]}>Data</Text>
          <Text style={[styles.colunaLabel, styles.colFuncao]}>Função</Text>
          <Text style={[styles.colunaLabel, styles.colIrmao]}>Irmão 01</Text>
          <Text style={[styles.colunaLabel, styles.colIrmao]}>Irmão 02</Text>
        </View>

        <View style={styles.linha}>
          <View style={styles.dataBox}>
            <Text style={styles.dataNumero}>{grupo.data.split("/")[0]}</Text>
            <Text style={styles.dataMes}>{MESES_CURTO[quadro.mes] ?? ""}</Text>
            <View
              style={[
                styles.diaPill,
                { backgroundColor: isDomingo ? "#f59e0b" : "#10b981" },
              ]}
            >
              <Text
                style={[
                  styles.diaPillText,
                  { color: isDomingo ? "#78350f" : "#064e3b" },
                ]}
              >
                {grupo.dia}
              </Text>
            </View>
          </View>

          <View style={styles.funcoesCol}>
            {funcoes.map((f, i) => (
              <View
                key={f.funcao}
                style={[
                  styles.funcaoLinha,
                  i < funcoes.length - 1 && styles.funcaoLinhaBorda,
                ]}
              >
                <Text style={[styles.funcaoNome, styles.colFuncao]}>{f.funcao}</Text>
                <Text style={[styles.irmao, styles.colIrmao]}>{f.irmao1 || "—"}</Text>
                <Text style={[styles.irmao, styles.colIrmao]}>{f.irmao2 || "—"}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: { width: LARGURA, backgroundColor: "#ffffff", padding: 16 },
  header: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  rascunhoTag: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  rascunhoText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  colunas: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginTop: 10,
    paddingVertical: 8,
  },
  colunaLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    textAlign: "center",
  },
  // 124 = largura da caixa da data (120) + a borda roxa de 4, para o cabecalho cair em cima
  // das colunas do corpo.
  colData: { width: 124 },
  colFuncao: { flex: 1 },
  colIrmao: { flex: 1.4 },
  linha: {
    flexDirection: "row",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#e5e7eb",
  },
  dataBox: {
    width: 120,
    backgroundColor: "#2563eb",
    borderRightWidth: 4,
    borderRightColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 4,
  },
  dataNumero: { color: "#ffffff", fontSize: 44, fontWeight: "800", lineHeight: 48 },
  dataMes: { color: "#dbeafe", fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  diaPill: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  diaPillText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  funcoesCol: { flex: 1 },
  funcaoLinha: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  funcaoLinhaBorda: { borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  funcaoNome: {
    fontSize: 12,
    fontWeight: "800",
    color: "#000000",
    textTransform: "uppercase",
    textAlign: "center",
  },
  irmao: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
  },
});
