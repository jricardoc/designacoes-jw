import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { Compromisso } from "@/api/types";
import { Sheet } from "@/components/ui";
import { MESES, radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/** Visual da categoria, resolvido pelo tema na tela que abre a folha. */
export interface VisualCategoria {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}

interface CompromissoSheetProps {
  /** O compromisso aberto. `null` fecha a folha. */
  compromisso: Compromisso | null;
  onClose: () => void;
  visual: VisualCategoria;
  /** "Amanhã às 19:30", já pronto — quem tem o relógio e a Config é a tela. */
  quando: string;
  /** Rótulo de status quando o quadro de origem ainda é rascunho. */
  rascunho?: boolean;
}

/**
 * Os detalhes de um compromisso de "Minhas designações".
 *
 * O cartão da lista é apertado de propósito — data, ícone, título e uma linha só de
 * apoio, com `numberOfLines` cortando o resto. Tudo que não coube fica aqui: o título
 * inteiro, a data por extenso, horário e local separados em vez de espremidos numa
 * linha, e de onde a designação veio (o quadro, a escala ou a programação), que o
 * cartão não mostra em lugar nenhum.
 *
 * A folha não busca nada: recebe o compromisso que a tela já tem em mãos.
 */
export function CompromissoSheet({
  compromisso,
  onClose,
  visual,
  quando,
  rascunho,
}: CompromissoSheetProps) {
  const { colors, styles, statusConfig } = useTema(criarEstilos);

  const linhas: { icone: keyof typeof Ionicons.glyphMap; rotulo: string; valor: string }[] = [];
  if (compromisso) {
    linhas.push({ icone: "calendar-outline", rotulo: "Data", valor: dataPorExtenso(compromisso) });
    if (compromisso.horario) {
      linhas.push({ icone: "time-outline", rotulo: "Horário", valor: compromisso.horario });
    }
    if (compromisso.local) {
      linhas.push({ icone: "location-outline", rotulo: "Local", valor: compromisso.local });
    }
    if (compromisso.papel) {
      linhas.push({ icone: "person-outline", rotulo: "Seu papel", valor: compromisso.papel });
    }
    if (compromisso.detalhe) {
      linhas.push({ icone: "information-circle-outline", rotulo: "Detalhes", valor: compromisso.detalhe });
    }
    if (compromisso.origem?.titulo) {
      linhas.push({ icone: "folder-open-outline", rotulo: "Vem de", valor: compromisso.origem.titulo });
    }
  }

  return (
    <Sheet visible={!!compromisso} onClose={onClose} maxHeightPct={0.8}>
      {compromisso ? (
        <ScrollView contentContainerStyle={styles.corpo} showsVerticalScrollIndicator={false}>
          <View style={styles.topo}>
            <View style={[styles.icone, { backgroundColor: visual.bg }]}>
              <Ionicons name={visual.icon} size={20} color={visual.color} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.categoria, { color: visual.color }]}>{visual.label}</Text>
              {/* Sem numberOfLines: o título inteiro é justamente o que o cartão corta. */}
              <Text style={styles.titulo}>{compromisso.titulo}</Text>
            </View>
          </View>

          <View style={[styles.quando, { backgroundColor: visual.bg }]}>
            <Ionicons name="hourglass-outline" size={15} color={visual.color} />
            <Text style={[styles.quandoTexto, { color: visual.color }]}>{quando}</Text>
          </View>

          {rascunho ? (
            <View style={[styles.tag, { backgroundColor: statusConfig.rascunho.bg }]}>
              <Ionicons name="create-outline" size={13} color={statusConfig.rascunho.color} />
              <Text style={[styles.tagTexto, { color: statusConfig.rascunho.color }]}>
                Este quadro ainda é rascunho e pode mudar
              </Text>
            </View>
          ) : null}

          <View style={styles.painel}>
            {linhas.map((linha, i) => (
              <View key={linha.rotulo} style={[styles.linha, i > 0 && styles.linhaBorda]}>
                <Ionicons name={linha.icone} size={16} color={colors.textMuted} style={styles.linhaIcone} />
                <View style={styles.flex}>
                  <Text style={styles.linhaRotulo}>{linha.rotulo}</Text>
                  <Text style={styles.linhaValor}>{linha.valor}</Text>
                </View>
              </View>
            ))}
          </View>

          {compromisso.dataAproximada ? (
            <View style={styles.aviso}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.amber} />
              <Text style={styles.avisoTexto}>
                Data aproximada — confirme na programação antes de se programar por ela.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </Sheet>
  );
}

/**
 * "Quinta-Feira, 3 de setembro de 2026".
 *
 * Sai do `dataISO` (que já vem no fuso local do servidor) em vez de `new Date(...)` sobre
 * a string: interpretar "2026-09-03" como Date joga para UTC e, em fuso negativo, volta um
 * dia. Sem data, diz isso — o compromisso existe, só não tem dia marcado.
 */
function dataPorExtenso(c: Compromisso): string {
  const partes = (c.dataISO ?? "").split("-").map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) {
    return c.data ? `${c.diaSemana ? `${c.diaSemana}, ` : ""}${c.data}` : "Sem data definida";
  }
  const [ano, mes, dia] = partes;
  const nomeMes = (MESES[mes] ?? "").toLowerCase();
  const prefixo = c.diaSemana ? `${c.diaSemana}, ` : "";
  return `${prefixo}${dia} de ${nomeMes} de ${ano}`;
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1 },
    corpo: { paddingBottom: 8 },
    topo: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
    icone: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    categoria: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 3,
    },
    titulo: { fontSize: 19, fontWeight: "700", color: colors.text, lineHeight: 25 },
    quando: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      alignSelf: "flex-start",
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      marginBottom: 14,
    },
    quandoTexto: { fontSize: 13, fontWeight: "800", letterSpacing: 0.2 },
    tag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: radius.sm,
      marginBottom: 14,
    },
    tagTexto: { fontSize: 12, fontWeight: "700" },
    painel: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      paddingHorizontal: 14,
    },
    linha: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingVertical: 12 },
    linhaBorda: { borderTopWidth: 1, borderTopColor: colors.border },
    linhaIcone: { marginTop: 2 },
    linhaRotulo: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: colors.textMuted,
      marginBottom: 2,
    },
    linhaValor: { fontSize: 15, color: colors.text, lineHeight: 21 },
    aviso: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 14 },
    avisoTexto: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  });
