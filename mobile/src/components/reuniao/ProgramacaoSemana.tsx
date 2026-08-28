import { StyleSheet, Text, View } from "react-native";
import type { SemanaReuniao } from "@/api/types";
import { radius, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { canticoLegivel, limpar, parteTitulo } from "@/utils/semanaReuniao";

/**
 * A programação da semana inteira, seção por seção.
 *
 * Vivia dentro do SemanaCard, escondida atrás de um accordion. Numa tela só para ela, cabe
 * mostrar tudo aberto, com as duas salas separadas em vez de espremidas na mesma linha.
 *
 * Aqui é SÓ leitura. Falar com quem tem parte e anotar quem confirmou é a tela de
 * Confirmações — área própria, com escopo próprio, porque nem todo mundo que lê a
 * programação cuida dessa rotina.
 */

/** "Fulana / Sicrana" são duas pessoas. O arquivo importado usa "/" e "&" para separar. */
function nomes(valor?: string | null): string[] {
  const texto = limpar(valor);
  if (!texto) return [];
  return texto
    .split(/[/&]/)
    .map((n) => n.trim())
    .filter(Boolean);
}

/** Um nome sem ação — as partes em que não há quem confirmar individualmente. */
function ChipSimples({ texto, salaB }: { texto: string; salaB?: boolean }) {
  const { styles } = useTema(criarEstilos);
  return (
    <View style={[styles.chip, salaB && styles.chipSalaB]}>
      <Text style={[styles.chipTexto, salaB && styles.chipTextoSalaB]}>{texto}</Text>
    </View>
  );
}

/**
 * Uma parte com título e quem faz. Quando há Sala B, as duas salas ganham rótulo próprio —
 * no accordion antigo elas dividiam a mesma linha e era fácil ler o nome errado.
 */
function Parte({
  titulo,
  principal,
  salaB,
  rotulo,
}: {
  titulo?: string | null;
  principal?: string | null;
  salaB?: string | null;
  rotulo?: string;
}) {
  const { styles } = useTema(criarEstilos);
  // O título vem com a hora colada ("19:36 1. Joias espirituais"); separada, ela vira a
  // marcação de horário e o texto fica legível.
  const t = parteTitulo(titulo);
  const listaPrincipal = nomes(principal);
  const listaSalaB = nomes(salaB);
  if (!t && listaPrincipal.length === 0 && listaSalaB.length === 0) return null;

  return (
    <View style={styles.parte}>
      <Text style={styles.parteTitulo}>
        {t?.hora ? <Text style={styles.parteHora}>{t.hora} </Text> : null}
        {t?.texto || rotulo || "—"}
      </Text>

      {listaPrincipal.length > 0 ? (
        <View style={styles.grupo}>
          {listaSalaB.length > 0 ? (
            <Text style={styles.grupoRotulo}>Salão principal</Text>
          ) : null}
          <View style={styles.parteQuem}>
            {listaPrincipal.map((n) => (
              <ChipSimples key={n} texto={n} />
            ))}
          </View>
        </View>
      ) : null}

      {listaSalaB.length > 0 ? (
        <View style={styles.grupo}>
          <Text style={styles.grupoRotulo}>Sala B</Text>
          <View style={styles.parteQuem}>
            {listaSalaB.map((n) => (
              <ChipSimples key={n} texto={n} salaB />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Linha simples "rótulo: valor". */
function Linha({ label, value }: { label: string; value?: string | null }) {
  const { styles } = useTema(criarEstilos);
  const conteudo = limpar(value);
  if (!conteudo) return null;
  return (
    <View style={styles.linha}>
      <Text style={styles.linhaLabel}>{label}</Text>
      <Text style={styles.linhaValue}>{conteudo}</Text>
    </View>
  );
}

function Secao({
  titulo,
  cor,
  children,
}: {
  titulo: string;
  cor: string;
  children: React.ReactNode;
}) {
  const { styles } = useTema(criarEstilos);
  return (
    <View style={styles.secao}>
      <View style={[styles.secaoBar, { backgroundColor: cor }]} />
      <View style={styles.secaoBody}>
        <Text style={[styles.secaoTitulo, { color: cor }]}>{titulo}</Text>
        {children}
      </View>
    </View>
  );
}

export function ProgramacaoSemana({ semana }: { semana: SemanaReuniao }) {
  const { colors, styles } = useTema(criarEstilos);

  const temMinisterio =
    limpar(semana.ministerio1_titulo) ||
    limpar(semana.ministerio2_titulo) ||
    limpar(semana.ministerio3_titulo) ||
    limpar(semana.ministerio4_titulo);

  const temFds =
    limpar(semana.fds_tema) ||
    limpar(semana.fds_orador) ||
    limpar(semana.fds_presidente) ||
    limpar(semana.fds_leitor);

  const temMecanicaFds =
    limpar(semana.fds_mecanica_audioVideo) ||
    limpar(semana.fds_mecanica_indicadores) ||
    limpar(semana.fds_mecanica_microfone) ||
    limpar(semana.fds_mecanica_portao);

  return (
    <View style={styles.corpo}>
      <Secao titulo="Presidência" cor={colors.primary}>
        <Linha label="Presidente" value={semana.presidente} />
        <Linha label="Conselheiro B" value={semana.conselheiroB} />
        <Linha label="Oração Inicial" value={semana.oracaoInicial} />
        <Linha label="Cântico Inicial" value={canticoLegivel(semana.canticoInicial)} />
      </Secao>

      {limpar(semana.tesouro1_titulo) ||
      limpar(semana.tesouro2_titulo) ||
      limpar(semana.tesouro3_titulo) ? (
        <Secao titulo="💎 Tesouros da Palavra de Deus" cor="#5E7A8A">
          <Parte
            titulo={semana.tesouro1_titulo}
            principal={semana.tesouro1_irmao}
            rotulo="Discurso"
          />
          <Parte
            titulo={semana.tesouro2_titulo}
            principal={semana.tesouro2_irmao}
            rotulo="Joias espirituais"
          />
          <Parte
            titulo={semana.tesouro3_titulo}
            principal={semana.tesouro3_principal}
            salaB={semana.tesouro3_salaB}
            rotulo="Leitura da Bíblia"
          />
        </Secao>
      ) : null}

      {temMinisterio ? (
        <Secao titulo="🌾 Faça Seu Melhor no Ministério" cor={colors.orangeDark}>
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
      ) : null}

      {limpar(semana.vidaCrista1_titulo) || limpar(semana.vidaCrista2_titulo) ? (
        <Secao titulo="🐑 Nossa Vida Cristã" cor={colors.redDark}>
          <Linha label="Cântico" value={canticoLegivel(semana.canticoMeio)} />
          <Parte titulo={semana.vidaCrista1_titulo} principal={semana.vidaCrista1_irmao} />
          <Parte titulo={semana.vidaCrista2_titulo} principal={semana.vidaCrista2_irmao} />
        </Secao>
      ) : null}

      {limpar(semana.estudoBiblico_dirigente) || limpar(semana.estudoBiblico_leitor) ? (
        <Secao titulo="📕 Estudo Bíblico de Congregação" cor={colors.redDark}>
          <Linha label="Dirigente" value={semana.estudoBiblico_dirigente} />
          <Linha label="Leitor" value={semana.estudoBiblico_leitor} />
          <Linha label="Cântico Final" value={canticoLegivel(semana.canticoFinal)} />
          <Linha label="Oração Final" value={semana.oracaoFinal} />
        </Secao>
      ) : null}

      {limpar(semana.mecanica_audioVideo) ||
      limpar(semana.mecanica_indicadores) ||
      limpar(semana.mecanica_microfone) ? (
        <Secao titulo="🔧 Mecânicas — meio de semana" cor={colors.purple}>
          <Linha label="Áudio e Vídeo" value={semana.mecanica_audioVideo} />
          <Linha label="Indicadores" value={semana.mecanica_indicadores} />
          <Linha label="Microfones" value={semana.mecanica_microfone} />
        </Secao>
      ) : null}

      {temFds ? (
        <Secao titulo="📅 Fim de Semana" cor={colors.amber}>
          <Linha label="Presidente" value={semana.fds_presidente} />
          <Linha label="Tema" value={semana.fds_tema} />
          <Linha label="Orador" value={semana.fds_orador} />
          <Linha label="Congregação" value={semana.fds_congregacao} />
          <Linha label="Leitor" value={semana.fds_leitor} />
        </Secao>
      ) : null}

      {temMecanicaFds ? (
        <Secao titulo="🔧 Mecânicas — fim de semana" cor={colors.purple}>
          <Linha label="Áudio e Vídeo" value={semana.fds_mecanica_audioVideo} />
          <Linha label="Indicadores" value={semana.fds_mecanica_indicadores} />
          <Linha label="Microfones" value={semana.fds_mecanica_microfone} />
          <Linha label="Portão" value={semana.fds_mecanica_portao} />
        </Secao>
      ) : null}

      {limpar(semana.limpeza) ? (
        <Secao titulo="🧹 Limpeza" cor={colors.green}>
          <Linha label="Responsável" value={semana.limpeza} />
        </Secao>
      ) : null}
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    corpo: { gap: spacing.md },

    secao: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.md, overflow: "hidden" },
    secaoBar: { width: 4 },
    secaoBody: { flex: 1, padding: 14, gap: 10 },
    secaoTitulo: { fontSize: 13, fontWeight: "800", letterSpacing: 0.2 },

    linha: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    linhaLabel: { fontSize: 12.5, color: colors.textMuted, width: 108, fontWeight: "600" },
    linhaValue: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 19 },

    parte: { gap: 7 },
    parteTitulo: { fontSize: 13.5, color: colors.text, fontWeight: "600", lineHeight: 19 },
    parteHora: { color: colors.textMuted, fontWeight: "700" },
    grupo: { gap: 4 },
    grupoRotulo: {
      fontSize: 10.5,
      fontWeight: "700",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: colors.textMuted,
    },
    parteQuem: { flexDirection: "row", flexWrap: "wrap", gap: 6 },

    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.infoBg,
      borderRadius: radius.sm,
      paddingVertical: 6,
      paddingLeft: 10,
      paddingRight: 6,
      maxWidth: "100%",
    },
    chipSalaB: { backgroundColor: colors.surfaceMuted },
    chipTexto: { flexShrink: 1, fontSize: 13, fontWeight: "600", color: colors.primaryDark },
    chipTextoSalaB: { color: colors.textSecondary },
  });
