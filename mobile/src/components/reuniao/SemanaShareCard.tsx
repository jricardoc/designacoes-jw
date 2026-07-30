import { LinearGradient } from "expo-linear-gradient";
import { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SemanaReuniao } from "@/api/types";
import { MESES } from "@/theme";
import { datasDaSemana, faixaSemana, parteTitulo } from "@/utils/semanaReuniao";

/**
 * A semana inteira como imagem, para mandar no WhatsApp.
 *
 * Mesma ideia do DiaShareCard do quadro: renderiza fora da tela, o react-native-view-shot
 * captura. A largura é fixa em px para a imagem sair igual em qualquer aparelho.
 *
 * O PDF (gerarHtmlSemana) é paisagem, de afixar no quadro; esta é retrato, de ler no celular.
 * Por isso as duas metades ficam empilhadas aqui e lado a lado lá.
 *
 * As linhas são construídas por FUNÇÃO, não por componente: `linha()` e `parte()` devolvem
 * `null` quando não há o que mostrar, e aí `Secao` consegue sumir junto com o título. Com
 * componentes isso não funcionava — `<Linha valor={null} />` é um elemento válido mesmo
 * renderizando nada, e a seção "Mecânicas" aparecia como um título solto, sem conteúdo.
 */

const LARGURA = 760;
const SENTINELA = "__DELETADO__";

const limpo = (v?: string | null): string | null => {
  const t = String(v ?? "").trim();
  return !t || t === SENTINELA || t === "-" ? null : t;
};

/**
 * "Rótulo .... valor", ou null quando não há valor.
 *
 * O nome vai encostado na direita, na mesma coluna em que as partes colocam quem faz: numa
 * seção como "Nossa Vida Cristã", que mistura partes e linhas simples, os nomes ficavam em
 * duas colunas diferentes e a leitura em diagonal se perdia.
 */
function linha(label: string, valor?: string | null) {
  const v = limpo(valor);
  if (!v) return null;
  return (
    <View key={label} style={styles.linha}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.valorDireita}>{v}</Text>
    </View>
  );
}

/**
 * Parte da reunião: hora + título à esquerda, quem faz à direita (Sala B embaixo).
 *
 * `largo` alarga a coluna dos nomes. É para o Ministério, onde cada parte tem DUAS duplas
 * (principal e Sala B) e o título é curto — com a coluna estreita, um sobrenome a mais já
 * quebrava a linha enquanto sobrava espaço vazio no meio da linha.
 */
function parte(
  chave: string,
  titulo?: string | null,
  principal?: string | null,
  salaB?: string | null,
  largo = false,
) {
  const t = parteTitulo(titulo);
  const p = limpo(principal);
  const b = limpo(salaB);
  if (!t && !p && !b) return null;
  return (
    <View key={chave} style={styles.linha}>
      <Text style={styles.parteTitulo}>
        {t?.hora ? <Text style={styles.parteHora}>{t.hora} </Text> : null}
        {t?.texto || "—"}
      </Text>
      <View style={largo ? styles.parteQuemLargo : styles.parteQuem}>
        <Text style={styles.valor}>{p || "—"}</Text>
        {b ? <Text style={styles.salaB}>Sala B: {b}</Text> : null}
      </View>
    </View>
  );
}

/** Some por inteiro — título junto — quando nenhuma linha sobrou. */
function Secao({
  titulo,
  itens,
}: {
  titulo: string;
  itens: (React.ReactElement | null)[];
}) {
  const visiveis = itens.filter(Boolean);
  if (visiveis.length === 0) return null;
  return (
    <View style={styles.secao}>
      <Text style={styles.secaoTitulo}>{titulo}</Text>
      <View>{visiveis}</View>
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

    // Presidente, Conselheiro B e Oração inicial numa faixa só, centralizados: sem o título
    // "Presidência" sobra a altura que paga a fonte maior no resto do cartão.
    const presidencia: [string, string | null][] = [
      ["Presidente", limpo(semana.presidente)],
      ["Conselheiro B", limpo(semana.conselheiroB)],
      ["Oração inicial", limpo(semana.oracaoInicial)],
    ];
    const temPresidencia = presidencia.some(([, nome]) => nome);

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
          <Text style={styles.headerFaixa}>{faixaSemana(semana)}</Text>
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

          {temPresidencia ? (
            <View style={styles.presidencia}>
              {presidencia.map(([rotulo, nome]) => (
                <View key={rotulo} style={styles.presidCol}>
                  <Text style={styles.presidRotulo}>{rotulo}</Text>
                  <Text style={styles.presidNome}>{nome || "—"}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Secao
            titulo="Tesouros da Palavra de Deus"
            itens={[
              parte("t1", semana.tesouro1_titulo, semana.tesouro1_irmao),
              parte("t2", semana.tesouro2_titulo, semana.tesouro2_irmao),
              parte("t3", semana.tesouro3_titulo, semana.tesouro3_principal, semana.tesouro3_salaB),
            ]}
          />

          <Secao
            titulo="Faça Seu Melhor no Ministério"
            itens={[
              parte("m1", semana.ministerio1_titulo, semana.ministerio1_principal, semana.ministerio1_salaB, true),
              parte("m2", semana.ministerio2_titulo, semana.ministerio2_principal, semana.ministerio2_salaB, true),
              parte("m3", semana.ministerio3_titulo, semana.ministerio3_principal, semana.ministerio3_salaB, true),
              parte("m4", semana.ministerio4_titulo, semana.ministerio4_principal, semana.ministerio4_salaB, true),
            ]}
          />

          <Secao
            titulo="Nossa Vida Cristã"
            itens={[
              parte("vc1", semana.vidaCrista1_titulo, semana.vidaCrista1_irmao),
              parte("vc2", semana.vidaCrista2_titulo, semana.vidaCrista2_irmao),
              linha("Estudo — dirigente", semana.estudoBiblico_dirigente),
              linha("Estudo — leitor", semana.estudoBiblico_leitor),
              linha("Oração final", semana.oracaoFinal),
            ]}
          />
        </View>

        <View style={[styles.metade, styles.metadeFds]}>
          <View style={styles.metadeHeader}>
            <Text style={styles.metadeTitulo}>Fim de semana</Text>
            <Text style={styles.metadeData}>
              {fds ? `${fds.diaSemana}, ${fds.diaMes}` : ""}
            </Text>
          </View>

          <Secao
            titulo="Reunião pública"
            itens={[
              linha("Presidente", semana.fds_presidente),
              linha("Tema", semana.fds_tema),
              linha("Orador", semana.fds_orador),
              linha("Congregação", semana.fds_congregacao),
              linha("Leitor (Sentinela)", semana.fds_leitor),
            ]}
          />

          <Secao titulo="Limpeza" itens={[linha("Responsável", semana.limpeza)]} />
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: { width: LARGURA, backgroundColor: "#FBF7EF" },
  header: { padding: 24, gap: 5 },
  headerMes: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  headerFaixa: { color: "#fff", fontSize: 34, fontWeight: "800" },
  headerLeitura: { color: "rgba(255,255,255,0.92)", fontSize: 17, marginTop: 2 },
  metade: { paddingHorizontal: 24, paddingVertical: 18 },
  metadeFds: { backgroundColor: "#F3EDE2" },
  metadeHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#5E6B48",
    paddingBottom: 7,
    marginBottom: 12,
  },
  metadeTitulo: {
    fontSize: 21,
    fontWeight: "800",
    color: "#566239",
    textTransform: "uppercase",
  },
  metadeData: { fontSize: 17, fontWeight: "700", color: "#8A8071" },
  presidencia: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ECE3D3",
    paddingBottom: 10,
    marginBottom: 12,
  },
  presidCol: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  presidRotulo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8A8071",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  presidNome: {
    fontSize: 19,
    fontWeight: "700",
    color: "#2B2620",
    marginTop: 4,
    textAlign: "center",
  },
  secao: { marginBottom: 12 },
  secaoTitulo: {
    fontSize: 15,
    fontWeight: "800",
    color: "#8A8071",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  linha: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#ECE3D3",
  },
  label: { fontSize: 17, color: "#8A8071", fontWeight: "600", width: 210 },
  valor: { fontSize: 17, color: "#2B2620", fontWeight: "700", flex: 1 },
  valorDireita: { fontSize: 17, color: "#2B2620", fontWeight: "700", flex: 1, textAlign: "right" },
  parteTitulo: { fontSize: 17, color: "#2B2620", flex: 1 },
  parteHora: { color: "#8A8071", fontWeight: "700" },
  parteQuem: { width: 290, alignItems: "flex-end" },
  // Só o Ministério: duas duplas por linha precisam de mais largura que o título curto usa.
  parteQuemLargo: { width: 430, alignItems: "flex-end" },
  salaB: { fontSize: 15, color: "#8A8071", fontWeight: "600", marginTop: 2, textAlign: "right" },
});
