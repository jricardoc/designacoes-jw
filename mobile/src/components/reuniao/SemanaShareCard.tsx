import { LinearGradient } from "expo-linear-gradient";
import { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SemanaReuniao } from "@/api/types";
import { MESES } from "@/theme";
import { datasDaSemana, parteTitulo } from "@/utils/semanaReuniao";

/**
 * A semana inteira como imagem, para mandar no WhatsApp.
 *
 * Mesma ideia do DiaShareCard do quadro: renderiza fora da tela, o react-native-view-shot
 * captura. A largura é fixa em px para a imagem sair igual em qualquer aparelho.
 *
 * O PDF (gerarHtmlSemana) é paisagem, de afixar no quadro; esta é retrato, de ler no celular.
 * Por isso as duas metades ficam empilhadas aqui e lado a lado lá.
 */

const LARGURA = 760;
const SENTINELA = "__DELETADO__";

const limpo = (v?: string | null): string | null => {
  const t = String(v ?? "").trim();
  return !t || t === SENTINELA || t === "-" ? null : t;
};

function Linha({ label, valor }: { label: string; valor?: string | null }) {
  const v = limpo(valor);
  if (!v) return null;
  return (
    <View style={styles.linha}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.valor}>{v}</Text>
    </View>
  );
}

function Parte({
  titulo,
  principal,
  salaB,
}: {
  titulo?: string | null;
  principal?: string | null;
  salaB?: string | null;
}) {
  const t = parteTitulo(titulo);
  const p = limpo(principal);
  const b = limpo(salaB);
  if (!t && !p && !b) return null;
  return (
    <View style={styles.linha}>
      <Text style={styles.parteTitulo}>
        {t?.hora ? <Text style={styles.parteHora}>{t.hora} </Text> : null}
        {t?.texto || "—"}
      </Text>
      <View style={styles.parteQuem}>
        <Text style={styles.valor}>{p || "—"}</Text>
        {b ? <Text style={styles.salaB}>Sala B: {b}</Text> : null}
      </View>
    </View>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const temAlgo = Array.isArray(children)
    ? children.some((c) => c !== null && c !== false)
    : Boolean(children);
  if (!temAlgo) return null;
  return (
    <View style={styles.secao}>
      <Text style={styles.secaoTitulo}>{titulo}</Text>
      <View>{children}</View>
    </View>
  );
}

export interface SemanaShareCardProps {
  reuniao: { mes: number; ano: number };
  semana: SemanaReuniao;
}

export const SemanaShareCard = forwardRef<View, SemanaShareCardProps>(
  function SemanaShareCard({ reuniao, semana }, ref) {
    const { meio, fds } = datasDaSemana(semana);

    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        <LinearGradient
          colors={["#6E7B57", "#5E6B48"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Text style={styles.headerMes}>
            {(MESES[reuniao.mes] ?? "").toUpperCase()} / {reuniao.ano}
          </Text>
          <Text style={styles.headerFaixa}>
            {meio && fds ? `${meio.diaMes} a ${fds.diaMes}` : semana.faixaData}
          </Text>
          {limpo(semana.leituraSemanal) ? (
            <Text style={styles.headerLeitura}>📖 {semana.leituraSemanal}</Text>
          ) : null}
        </LinearGradient>

        <View style={styles.metade}>
          <View style={styles.metadeHeader}>
            <Text style={styles.metadeTitulo}>Meio da semana</Text>
            <Text style={styles.metadeData}>
              {meio ? `${meio.diaSemana}, ${meio.diaMes}` : ""}
            </Text>
          </View>

          <Secao titulo="Presidência">
            <Linha label="Presidente" valor={semana.presidente} />
            <Linha label="Conselheiro B" valor={semana.conselheiroB} />
            <Linha label="Oração inicial" valor={semana.oracaoInicial} />
          </Secao>

          <Secao titulo="Tesouros da Palavra de Deus">
            <Parte titulo={semana.tesouro1_titulo} principal={semana.tesouro1_irmao} />
            <Parte titulo={semana.tesouro2_titulo} principal={semana.tesouro2_irmao} />
            <Parte
              titulo={semana.tesouro3_titulo}
              principal={semana.tesouro3_principal}
              salaB={semana.tesouro3_salaB}
            />
          </Secao>

          <Secao titulo="Faça Seu Melhor no Ministério">
            <Parte
              titulo={semana.ministerio1_titulo}
              principal={semana.ministerio1_principal}
              salaB={semana.ministerio1_salaB}
            />
            <Parte
              titulo={semana.ministerio2_titulo}
              principal={semana.ministerio2_principal}
              salaB={semana.ministerio2_salaB}
            />
            <Parte
              titulo={semana.ministerio3_titulo}
              principal={semana.ministerio3_principal}
              salaB={semana.ministerio3_salaB}
            />
            <Parte
              titulo={semana.ministerio4_titulo}
              principal={semana.ministerio4_principal}
              salaB={semana.ministerio4_salaB}
            />
          </Secao>

          <Secao titulo="Nossa Vida Cristã">
            <Parte titulo={semana.vidaCrista1_titulo} principal={semana.vidaCrista1_irmao} />
            <Parte titulo={semana.vidaCrista2_titulo} principal={semana.vidaCrista2_irmao} />
            <Linha label="Estudo — dirigente" valor={semana.estudoBiblico_dirigente} />
            <Linha label="Estudo — leitor" valor={semana.estudoBiblico_leitor} />
            <Linha label="Oração final" valor={semana.oracaoFinal} />
          </Secao>

          <Secao titulo="Mecânicas">
            <Linha label="Áudio e vídeo" valor={semana.mecanica_audioVideo} />
            <Linha label="Indicadores" valor={semana.mecanica_indicadores} />
            <Linha label="Microfones" valor={semana.mecanica_microfone} />
          </Secao>
        </View>

        <View style={[styles.metade, styles.metadeFds]}>
          <View style={styles.metadeHeader}>
            <Text style={styles.metadeTitulo}>Fim de semana</Text>
            <Text style={styles.metadeData}>
              {fds ? `${fds.diaSemana}, ${fds.diaMes}` : ""}
            </Text>
          </View>

          <Secao titulo="Reunião pública">
            <Linha label="Presidente" valor={semana.fds_presidente} />
            <Linha label="Tema" valor={semana.fds_tema} />
            <Linha label="Orador" valor={semana.fds_orador} />
            <Linha label="Congregação" valor={semana.fds_congregacao} />
            <Linha label="Leitor (Sentinela)" valor={semana.fds_leitor} />
          </Secao>

          <Secao titulo="Mecânicas">
            <Linha label="Áudio e vídeo" valor={semana.fds_mecanica_audioVideo} />
            <Linha label="Indicadores" valor={semana.fds_mecanica_indicadores} />
            <Linha label="Microfones" valor={semana.fds_mecanica_microfone} />
            <Linha label="Portão" valor={semana.fds_mecanica_portao} />
          </Secao>

          <Secao titulo="Limpeza">
            <Linha label="Responsável" valor={semana.limpeza} />
          </Secao>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: { width: LARGURA, backgroundColor: "#FBF7EF" },
  header: { padding: 22, gap: 4 },
  headerMes: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  headerFaixa: { color: "#fff", fontSize: 28, fontWeight: "800" },
  headerLeitura: { color: "rgba(255,255,255,0.92)", fontSize: 14, marginTop: 2 },
  metade: { paddingHorizontal: 22, paddingVertical: 16 },
  metadeFds: { backgroundColor: "#F3EDE2" },
  metadeHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#5E6B48",
    paddingBottom: 6,
    marginBottom: 10,
  },
  metadeTitulo: {
    fontSize: 17,
    fontWeight: "800",
    color: "#566239",
    textTransform: "uppercase",
  },
  metadeData: { fontSize: 14, fontWeight: "700", color: "#8A8071" },
  secao: { marginBottom: 10 },
  secaoTitulo: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8A8071",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  linha: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: "#ECE3D3",
  },
  label: { fontSize: 14, color: "#8A8071", fontWeight: "600", width: 190 },
  valor: { fontSize: 14, color: "#2B2620", fontWeight: "700", flex: 1 },
  parteTitulo: { fontSize: 14, color: "#2B2620", flex: 1 },
  parteHora: { color: "#8A8071", fontWeight: "700" },
  parteQuem: { width: 250, alignItems: "flex-end" },
  salaB: { fontSize: 12.5, color: "#8A8071", fontWeight: "600", marginTop: 1 },
});
