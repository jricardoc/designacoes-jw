import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useCatalogoTarefas, useTarefasDoUsuario } from "@/api/hooks/useTarefas";
import type { TarefaAtribuivel, Usuario } from "@/api/types";
import { Sheet } from "@/components/ui";
import { radius, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

interface Props {
  user: Usuario | null;
  salvando?: boolean;
  onClose: () => void;
  onSalvar: (tarefas: TarefaAtribuivel[]) => void;
}

/**
 * Escolhe as tarefas de sistema de um irmão.
 *
 * É uma folha SEPARADA das "Áreas de acesso", e não uma seção dentro dela, porque as duas
 * respondem coisas diferentes: escopo é onde a pessoa PODE mexer, tarefa é o que ela DEVE
 * fazer. Quem manda o link do Zoom não administra área nenhuma, e o admin geral — que já
 * administra tudo — costuma ser justamente quem monta os quadros. Por isso, ao contrário da
 * folha de escopos, aqui o admin geral TAMBÉM aparece com as caixas.
 *
 * A limpeza do salão não está na lista de propósito: ela não se designa, vem do grupo de
 * campo do irmão (ver LimpezaGrupoService). O backend recusa recebê-la aqui.
 */
export function TarefasSheet({ user, salvando, onClose, onSalvar }: Props) {
  const { colors, styles } = useTema(criarEstilos);
  const { data: catalogo, isLoading: carregandoCatalogo } = useCatalogoTarefas(!!user);
  const { data: atuais, isLoading: carregandoAtuais } = useTarefasDoUsuario(user?.id ?? null);
  const [marcados, setMarcados] = useState<TarefaAtribuivel[]>([]);

  // Recarrega ao trocar de usuário E quando as tarefas dele chegam: sem isto a folha abriria
  // com as caixas do irmão anterior, ou vazia enquanto a consulta não voltasse.
  useEffect(() => {
    setMarcados(atuais?.tarefas ?? []);
  }, [atuais, user]);

  const alternar = (id: TarefaAtribuivel) =>
    setMarcados((antes) =>
      antes.includes(id) ? antes.filter((t) => t !== id) : [...antes, id],
    );

  const opcoes = catalogo?.tarefas ?? [];
  const carregando = carregandoCatalogo || carregandoAtuais;

  return (
    <Sheet visible={!!user} onClose={onClose} scroll>
      {user ? (
        <View>
          <Text style={styles.titulo}>Tarefas</Text>
          <Text style={styles.subtitulo}>{user.nome}</Text>

          {carregando ? (
            <View style={styles.carregando}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <>
              <Text style={styles.ajuda}>
                O que este irmão fica de fazer para o sistema andar. As tarefas marcadas
                aparecem na tela de início dele, com prazo, e ele recebe lembrete quando o
                prazo se aproxima.
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
                      <View style={styles.linhaTitulo}>
                        <Ionicons
                          name={opcao.icone as keyof typeof Ionicons.glyphMap}
                          size={15}
                          color={colors.oliveSoft}
                        />
                        <Text style={styles.label}>{opcao.label}</Text>
                      </View>
                      <Text style={styles.descricao}>{opcao.descricao}</Text>
                      <View style={[styles.cadencia, { backgroundColor: colors.infoBg }]}>
                        <Text style={[styles.cadenciaTexto, { color: colors.primaryDark }]}>
                          {opcao.cadenciaLabel}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}

              {/* A limpeza aparece nas tarefas do irmão sem passar por aqui. Dizer isso
                  evita o admin procurar uma caixa que não existe. */}
              <View style={styles.nota}>
                <Ionicons name="information-circle-outline" size={16} color={colors.teal} />
                <Text style={styles.notaTexto}>
                  A limpeza do salão não se designa: ela aparece sozinha para quem está no
                  grupo de campo escalado na semana.
                </Text>
              </View>

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
                      ? "Salvar (sem tarefas)"
                      : `Salvar ${marcados.length} tarefa(s)`}
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
    linha: {
      flexDirection: "row",
      alignItems: "flex-start",
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
      marginTop: 2,
    },
    caixaMarcada: { backgroundColor: colors.primary, borderColor: colors.primary },
    textos: { flex: 1, gap: 4 },
    linhaTitulo: { flexDirection: "row", alignItems: "center", gap: 7 },
    label: { flex: 1, fontSize: 15.5, fontWeight: "600", color: colors.text },
    descricao: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    cadencia: {
      alignSelf: "flex-start",
      borderRadius: radius.sm,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginTop: 2,
    },
    cadenciaTexto: { fontSize: 11, fontWeight: "700" },
    nota: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      backgroundColor: colors.tealBg,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.md,
    },
    notaTexto: { flex: 1, fontSize: 12.5, color: colors.teal, lineHeight: 17 },
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
