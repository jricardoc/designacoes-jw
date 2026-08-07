import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useCompartilhamentosSemana } from "@/api/hooks/useReunioes";
import type { SemanaReuniao } from "@/api/types";
import { Sheet } from "@/components/ui";
import { radius, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { faixaSemana } from "@/utils/semanaReuniao";

interface CompartilharReuniaoSheetProps {
  semana: SemanaReuniao | null;
  onClose: () => void;
  /** Dispara o fluxo já existente da imagem completa (view-shot + share). */
  onImagem: () => void;
}

/**
 * O botão Compartilhar pergunta O QUE compartilhar: a programação inteira em
 * imagem ou um dos convites de Zoom em texto.
 *
 * Os textos NÃO são montados aqui — vêm prontos de
 * `GET /reunioes/semanas/:id/compartilhamentos`, junto da própria lista de
 * opções. O app não tem EAS Update, então tudo que ele montasse sozinho ficaria
 * preso ao build instalado; do jeito que está, mudar uma palavra do convite é
 * um deploy do backend.
 */
export function CompartilharReuniaoSheet({
  semana,
  onClose,
  onImagem,
}: CompartilharReuniaoSheetProps) {
  const { colors, styles } = useTema(criarEstilos);
  const { data, isLoading, isError } = useCompartilhamentosSemana(semana?.id ?? null);

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

  return (
    <Sheet visible={!!semana} onClose={onClose}>
      {semana ? (
        <View style={styles.corpo}>
          <Text style={styles.titulo}>Compartilhar</Text>
          <Text style={styles.subtitulo}>Semana de {faixaSemana(semana)}</Text>

          {/* A imagem é capacidade do próprio app (view-shot), então fica aqui
              mesmo — as opções de TEXTO é que vêm do servidor. */}
          <Pressable
            style={styles.opcao}
            onPress={() => {
              onClose();
              onImagem();
            }}
          >
            <View style={styles.icone}>
              <Ionicons name="image-outline" size={20} color={colors.primaryDark} />
            </View>
            <View style={styles.textos}>
              <Text style={styles.opcaoTitulo}>Reunião completa</Text>
              <Text style={styles.opcaoDescricao}>
                Imagem com toda a programação da semana
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          {isLoading ? (
            <View style={styles.estado}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.estadoTexto}>Carregando os convites...</Text>
            </View>
          ) : isError || !data?.opcoes?.length ? (
            <View style={styles.estado}>
              <Ionicons name="cloud-offline-outline" size={20} color={colors.textMuted} />
              <Text style={styles.estadoTexto}>
                Não consegui carregar os convites de Zoom. Confira a conexão e tente de novo.
              </Text>
            </View>
          ) : (
            data.opcoes.map((opcao) => (
              <Pressable
                key={opcao.id}
                style={styles.opcao}
                onPress={() => compartilharTexto(opcao.texto)}
              >
                <View style={styles.icone}>
                  <Ionicons
                    name={opcao.icone as keyof typeof Ionicons.glyphMap}
                    size={20}
                    color={colors.primaryDark}
                  />
                </View>
                <View style={styles.textos}>
                  <Text style={styles.opcaoTitulo}>{opcao.titulo}</Text>
                  <Text style={styles.opcaoDescricao}>{opcao.descricao}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))
          )}
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
    estado: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    estadoTexto: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  });
