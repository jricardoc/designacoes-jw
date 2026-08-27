import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useCatalogoEscopos } from "@/api/hooks/useMisc";
import type { EscopoAdmin, Usuario } from "@/api/types";
import { Sheet } from "@/components/ui";
import { radius, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

interface Props {
  user: Usuario | null;
  salvando?: boolean;
  onClose: () => void;
  onSalvar: (escopos: EscopoAdmin[]) => void;
}

/**
 * Escolhe em quais áreas o irmão pode administrar.
 *
 * Quem é admin GERAL não aparece aqui com caixas: ele já contempla tudo, e
 * marcar área para ele criaria uma permissão ambígua na hora de rebaixar — a
 * folha explica isso em vez de oferecer controles que o backend recusaria.
 */
export function EscoposSheet({ user, salvando, onClose, onSalvar }: Props) {
  const { colors, styles } = useTema(criarEstilos);
  const { data, isLoading } = useCatalogoEscopos(!!user && !user.isAdmin);
  const [marcados, setMarcados] = useState<EscopoAdmin[]>([]);

  // Recarrega ao trocar de usuário: sem isto a folha abriria com as caixas do
  // irmão anterior.
  useEffect(() => {
    setMarcados(user?.escopos ?? []);
  }, [user]);

  const alternar = (id: EscopoAdmin) =>
    setMarcados((antes) =>
      antes.includes(id) ? antes.filter((e) => e !== id) : [...antes, id],
    );

  const opcoes = data?.escopos ?? [];

  return (
    <Sheet visible={!!user} onClose={onClose} scroll>
      {user ? (
        <View>
          <Text style={styles.titulo}>Áreas de acesso</Text>
          <Text style={styles.subtitulo}>{user.nome}</Text>

          {user.isAdmin ? (
            <View style={styles.avisoGeral}>
              <Ionicons name="shield-checkmark" size={18} color={colors.greenDark} />
              <Text style={styles.avisoGeralTexto}>
                Este irmão é <Text style={styles.negrito}>Admin geral</Text> e já
                administra todas as áreas. Para dar acesso a áreas específicas,
                remova o admin geral primeiro.
              </Text>
            </View>
          ) : isLoading ? (
            <View style={styles.carregando}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <>
              <Text style={styles.ajuda}>
                Ele passa a criar e editar só nas áreas marcadas. O resto continua
                sendo só leitura.
              </Text>

              {opcoes.map((opcao, i) => {
                const marcado = marcados.includes(opcao.id);
                return (
                  <Pressable
                    key={opcao.id}
                    style={[styles.linha, i > 0 && styles.divisoria]}
                    onPress={() => alternar(opcao.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: marcado }}
                  >
                    <View style={[styles.caixa, marcado && styles.caixaMarcada]}>
                      {marcado ? (
                        <Ionicons name="checkmark" size={15} color={colors.textOnPrimary} />
                      ) : null}
                    </View>
                    <View style={styles.textos}>
                      <Text style={styles.label}>{opcao.label}</Text>
                      <Text style={styles.descricao}>{opcao.descricao}</Text>
                    </View>
                  </Pressable>
                );
              })}

              <Pressable
                style={[styles.botao, salvando && styles.botaoInativo]}
                disabled={salvando}
                onPress={() => onSalvar(marcados)}
              >
                {salvando ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.botaoTexto}>
                    {marcados.length === 0
                      ? "Salvar (sem áreas)"
                      : `Salvar ${marcados.length} área(s)`}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      ) : null}
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    titulo: { fontSize: 20, fontWeight: "800", color: colors.text },
    subtitulo: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
    ajuda: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    carregando: { paddingVertical: spacing.xl, alignItems: "center" },
    avisoGeral: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      backgroundColor: colors.successBg,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginTop: spacing.lg,
    },
    avisoGeralTexto: {
      flex: 1,
      fontSize: 13.5,
      color: colors.greenDark,
      lineHeight: 19,
    },
    negrito: { fontWeight: "800" },
    linha: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    divisoria: { borderTopWidth: 1, borderTopColor: colors.border },
    caixa: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    caixaMarcada: { backgroundColor: colors.primary, borderColor: colors.primary },
    textos: { flex: 1, gap: 2 },
    label: { fontSize: 15.5, fontWeight: "600", color: colors.text },
    descricao: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    botao: {
      marginTop: spacing.lg,
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      paddingVertical: 14,
      alignItems: "center",
    },
    botaoInativo: { opacity: 0.6 },
    botaoTexto: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 15 },
  });
