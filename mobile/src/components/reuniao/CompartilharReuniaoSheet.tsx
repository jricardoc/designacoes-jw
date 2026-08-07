import { Ionicons } from "@expo/vector-icons";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import type { SemanaReuniao } from "@/api/types";
import { Sheet } from "@/components/ui";
import { radius, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import {
  conviteZoomFimDeSemana,
  conviteZoomMeioSemana,
} from "@/utils/conviteZoom";
import { faixaSemana } from "@/utils/semanaReuniao";

interface CompartilharReuniaoSheetProps {
  semana: SemanaReuniao | null;
  onClose: () => void;
  /** Dispara o fluxo já existente da imagem completa (view-shot + share). */
  onImagem: () => void;
}

/**
 * O botão Compartilhar deixou de mandar direto a imagem: primeiro pergunta O QUE
 * compartilhar — a programação inteira em imagem ou um dos convites de Zoom em
 * texto, prontos para colar no WhatsApp.
 */
export function CompartilharReuniaoSheet({
  semana,
  onClose,
  onImagem,
}: CompartilharReuniaoSheetProps) {
  const { colors, styles } = useTema(criarEstilos);

  /**
   * Fecha a folha ANTES de abrir o share do sistema: no iOS apresentar o share
   * por cima de um modal que está saindo derruba um dos dois. O timeout dá
   * tempo do modal desmontar.
   */
  const compartilharTexto = (texto: string) => {
    onClose();
    setTimeout(() => {
      Share.share({ message: texto }).catch(() => {});
    }, 350);
  };

  const opcoes = semana
    ? ([
        {
          chave: "imagem",
          titulo: "Reunião completa",
          descricao: "Imagem com toda a programação da semana",
          icone: "image-outline" as const,
          acao: () => {
            onClose();
            onImagem();
          },
        },
        {
          chave: "zoom-meio",
          titulo: "Zoom — meio de semana",
          descricao: "Convite em texto com o link e a leitura da semana",
          icone: "videocam-outline" as const,
          acao: () => compartilharTexto(conviteZoomMeioSemana(semana)),
        },
        {
          chave: "zoom-fds",
          titulo: "Zoom — fim de semana",
          descricao: "Convite em texto com orador, tema e link",
          icone: "videocam-outline" as const,
          acao: () => compartilharTexto(conviteZoomFimDeSemana(semana)),
        },
      ] as const)
    : [];

  return (
    <Sheet visible={!!semana} onClose={onClose}>
      {semana ? (
        <View style={styles.corpo}>
          <Text style={styles.titulo}>Compartilhar</Text>
          <Text style={styles.subtitulo}>Semana de {faixaSemana(semana)}</Text>

          {opcoes.map((opcao) => (
            <Pressable key={opcao.chave} style={styles.opcao} onPress={opcao.acao}>
              <View style={styles.icone}>
                <Ionicons name={opcao.icone} size={20} color={colors.primaryDark} />
              </View>
              <View style={styles.textos}>
                <Text style={styles.opcaoTitulo}>{opcao.titulo}</Text>
                <Text style={styles.opcaoDescricao}>{opcao.descricao}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    corpo: { paddingBottom: spacing.sm },
    titulo: { fontSize: 20, fontWeight: "800", color: colors.text },
    subtitulo: {
      fontSize: 13.5,
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: spacing.md,
    },
    opcao: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    icone: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.infoBg,
      alignItems: "center",
      justifyContent: "center",
    },
    textos: { flex: 1, gap: 2 },
    opcaoTitulo: { fontSize: 15.5, fontWeight: "700", color: colors.text },
    opcaoDescricao: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  });
