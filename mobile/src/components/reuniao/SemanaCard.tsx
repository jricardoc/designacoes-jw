import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { SemanaReuniao } from "@/api/types";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { canticoLegivel, datasDaSemana, parteTitulo } from "@/utils/semanaReuniao";

// Sentinela gravada pela web para marcar uma linha como excluida.
const SENTINELA_DELETADO = "__DELETADO__";

export function limpar(value?: string | null): string | null {
  if (!value || value === SENTINELA_DELETADO) return null;
  const t = String(value).trim();
  return t && t !== "-" ? t : null;
}

/** Uma parte com título e quem faz — e, quando existe, o irmão da Sala B. */
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
  const p = limpar(principal);
  const b = limpar(salaB);
  if (!t && !p && !b) return null;

  return (
    <View style={styles.parte}>
      <Text style={styles.parteTitulo}>
        {t?.hora ? <Text style={styles.parteHora}>{t.hora} </Text> : null}
        {t?.texto || rotulo || "—"}
      </Text>
      <View style={styles.parteQuem}>
        {p ? (
          <View style={styles.chip}>
            <Text style={styles.chipTexto}>{p}</Text>
          </View>
        ) : null}
        {b ? (
          <View style={[styles.chip, styles.chipSalaB]}>
            <Text style={[styles.chipTexto, styles.chipTextoSalaB]}>Sala B: {b}</Text>
          </View>
        ) : null}
      </View>
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

/** O bloco de data: número grande, mês e o dia da semana — como no quadro de designações. */
function BlocoData({
  dia,
  mes,
  diaSemana,
  rotulo,
}: {
  dia: string;
  mes: string;
  diaSemana: string;
  rotulo: string;
}) {
  const { styles } = useTema(criarEstilos);
  return (
    <View style={styles.blocoData}>
      <Text style={styles.blocoRotulo}>{rotulo}</Text>
      <View style={styles.blocoLinha}>
        <Text style={styles.blocoDia}>{dia}</Text>
        <View>
          <Text style={styles.blocoMes}>{mes}</Text>
          <View style={styles.blocoPill}>
            <Text style={styles.blocoPillTexto}>{diaSemana}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function SemanaCard({
  semana,
  index = 0,
  destaque = false,
  onCompartilhar,
  onPdf,
  onAssistencia,
  compartilhando = false,
  gerandoPdf = false,
}: {
  semana: SemanaReuniao;
  index?: number;
  /** Semana atual hasteada no topo da tela: ganha borda viva na cor da marca. */
  destaque?: boolean;
  onCompartilhar?: () => void;
  onPdf?: () => void;
  /**
   * Abre o registro de assistência. Só chega para quem gerencia reuniões e
   * quando a semana tem data importada — sem os dois, o botão nem aparece
   * (diferente de PDF/Compartilhar, que são de leitura e ficam para todos).
   */
  onAssistencia?: () => void;
  compartilhando?: boolean;
  gerandoPdf?: boolean;
}) {
  const { colors, styles } = useTema(criarEstilos);
  const [open, setOpen] = useState(false);
  const { meio, fds } = datasDaSemana(semana);

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
    <Animated.View
      entering={FadeInDown.delay(index * 55).duration(300)}
      style={[styles.card, destaque && styles.cardDestaque]}
    >
      <Pressable style={styles.header} onPress={() => setOpen((o) => !o)}>
        {/* As datas vêm primeiro: é o que o irmão procura ao abrir a tela. O rótulo textual
            do PDF ("Agosto 03 - 09") só aparece quando a importação não trouxe a data. */}
        {meio || fds ? (
          <View style={styles.datas}>
            {meio ? (
              <BlocoData
                rotulo="Meio de semana"
                dia={meio.dia}
                mes={meio.mes}
                diaSemana={meio.diaSemana}
              />
            ) : null}
            {fds ? (
              <BlocoData
                rotulo="Fim de semana"
                dia={fds.dia}
                mes={fds.mes}
                diaSemana={fds.diaSemana}
              />
            ) : null}
          </View>
        ) : (
          <Text style={styles.faixa}>{semana.faixaData}</Text>
        )}

        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.textSecondary}
        />
      </Pressable>

      {limpar(semana.leituraSemanal) ? (
        <Text style={styles.leitura}>📖 {semana.leituraSemanal}</Text>
      ) : null}

      <View style={styles.acoes}>
        <Pressable
          style={styles.acao}
          onPress={onPdf}
          disabled={gerandoPdf || !onPdf}
        >
          {gerandoPdf ? (
            <ActivityIndicator size="small" color={colors.primaryDark} />
          ) : (
            <Ionicons name="download-outline" size={15} color={colors.primaryDark} />
          )}
          <Text style={styles.acaoTexto}>PDF</Text>
        </Pressable>
        {onAssistencia ? (
          <Pressable style={styles.acao} onPress={onAssistencia}>
            <Ionicons name="people-outline" size={15} color={colors.primaryDark} />
            <Text style={styles.acaoTexto}>Assistência</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={styles.acao}
          onPress={onCompartilhar}
          disabled={compartilhando || !onCompartilhar}
        >
          {compartilhando ? (
            <ActivityIndicator size="small" color={colors.primaryDark} />
          ) : (
            <Ionicons name="share-social-outline" size={15} color={colors.primaryDark} />
          )}
          <Text style={styles.acaoTexto}>Compartilhar</Text>
        </Pressable>
      </View>

      {open ? (
        <View style={styles.body}>
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

          {/* Faltava por inteiro na tela antiga, mesmo sendo o maior bloco da reunião. */}
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
              <Parte
                titulo={semana.vidaCrista1_titulo}
                principal={semana.vidaCrista1_irmao}
              />
              <Parte
                titulo={semana.vidaCrista2_titulo}
                principal={semana.vidaCrista2_irmao}
              />
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
      ) : null}
    </Animated.View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      overflow: "hidden",
      paddingBottom: 4,
    },
    cardDestaque: {
      borderWidth: 2,
      borderColor: colors.primary,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      paddingBottom: 8,
      gap: 8,
    },
    datas: { flex: 1, flexDirection: "row", gap: 18 },
    blocoData: { gap: 2 },
    blocoRotulo: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    blocoLinha: { flexDirection: "row", alignItems: "center", gap: 6 },
    blocoDia: { fontSize: 30, fontWeight: "700", color: colors.terracotta, lineHeight: 34 },
    blocoMes: { fontSize: 10, fontWeight: "700", color: colors.mesEtiqueta, letterSpacing: 1 },
    blocoPill: {
      backgroundColor: colors.infoBg,
      borderRadius: radius.sm,
      paddingVertical: 2,
      paddingHorizontal: 7,
      marginTop: 2,
    },
    blocoPillTexto: { fontSize: 11, fontWeight: "700", color: colors.primaryDark },
    faixa: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
    leitura: {
      fontSize: 13,
      color: colors.textSecondary,
      paddingHorizontal: 14,
      paddingBottom: 4,
    },
    acoes: {
      flexDirection: "row",
      // Com o botão de Assistência são três ações: em telas estreitas a linha
      // quebra em vez de empurrar o último botão para fora do cartão.
      flexWrap: "wrap",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    acao: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.infoBg,
      borderRadius: radius.pill,
      paddingVertical: 7,
      paddingHorizontal: 12,
    },
    acaoTexto: { fontSize: 12.5, fontWeight: "700", color: colors.primaryDark },
    body: { padding: 14, paddingTop: 4, gap: 12 },
    secao: { flexDirection: "row", gap: 10 },
    secaoBar: { width: 4, borderRadius: 2 },
    secaoBody: { flex: 1, paddingVertical: 2 },
    secaoTitulo: { fontSize: 13, fontWeight: "800", marginBottom: 6 },
    linha: { flexDirection: "row", gap: 8, paddingVertical: 2 },
    linhaLabel: {
      fontSize: 13,
      color: colors.textMuted,
      minWidth: 96,
      fontWeight: "600",
    },
    linhaValue: { fontSize: 13, color: colors.text, flex: 1 },
    parte: { paddingVertical: 5 },
    parteTitulo: { fontSize: 13, color: colors.text, fontWeight: "600" },
    parteHora: { color: colors.textMuted, fontWeight: "700" },
    parteQuem: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
    chip: {
      backgroundColor: colors.slotBg,
      borderWidth: 1,
      borderColor: colors.slotBorder,
      borderRadius: radius.pill,
      paddingVertical: 3,
      paddingHorizontal: 9,
    },
    chipTexto: { fontSize: 12, fontWeight: "600", color: colors.text },
    chipSalaB: { backgroundColor: colors.surfaceMuted },
    chipTextoSalaB: { color: colors.textSecondary },
  });
