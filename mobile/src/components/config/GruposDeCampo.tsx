import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  useAtualizarGrupo,
  useCriarGrupo,
  useExcluirGrupo,
  useGrupos,
} from "@/api/hooks/useGrupos";
import type { GrupoCampo } from "@/api/types";
import { ConfirmDialog, Sheet, useConfirm, useToast } from "@/components/ui";
import { radius, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/**
 * Os grupos de campo da congregação.
 *
 * O grupo é batizado com o nome de quem o dirige, e quando a designação troca o grupo inteiro
 * é renomeado. Como o publicador aponta para o grupo e não guarda o texto, renomear aqui
 * acerta todo mundo de uma vez — foi por isso que o campo deixou de ser texto livre.
 */
export function GruposDeCampo() {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const confirmar = useConfirm();
  const { data: grupos, isLoading } = useGrupos();
  const criar = useCriarGrupo();
  const atualizar = useAtualizarGrupo();
  const excluir = useExcluirGrupo();

  // `null` = criando; um grupo = renomeando. A folha é a mesma para os dois.
  const [editando, setEditando] = useState<GrupoCampo | null | undefined>(undefined);
  const [nome, setNome] = useState("");

  const abrir = (grupo: GrupoCampo | null) => {
    setEditando(grupo);
    setNome(grupo?.nome ?? "");
  };

  const fechar = () => {
    setEditando(undefined);
    setNome("");
  };

  const salvar = async () => {
    const valor = nome.trim();
    if (!valor) {
      toast.show("Informe o nome do grupo", "error");
      return;
    }
    try {
      if (editando) {
        await atualizar.mutateAsync({ id: editando.id, nome: valor });
      } else {
        await criar.mutateAsync(valor);
      }
      fechar();
      toast.show("Grupo salvo!");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao salvar", "error");
    }
  };

  const remover = (grupo: GrupoCampo) => {
    const quantos = grupo._count?.publicadores ?? 0;
    confirmar.confirm({
      title: `Excluir ${grupo.nome}?`,
      // Diz o que acontece com quem estava no grupo: ninguém é apagado, todos ficam sem
      // grupo e reaparecem para ser reatribuídos.
      message:
        quantos > 0
          ? `${quantos} publicador(es) ficam sem grupo. Ninguém é apagado — é só reatribuir depois.`
          : "Nenhum publicador está neste grupo.",
      type: "danger",
      confirmText: "Excluir",
      onConfirm: async () => {
        try {
          await excluir.mutateAsync(grupo.id);
          toast.show("Grupo excluído");
        } catch (err) {
          toast.show(err instanceof Error ? err.message : "Erro ao excluir", "error");
        } finally {
          confirmar.close();
        }
      },
    });
  };

  const salvando = criar.isPending || atualizar.isPending;

  return (
    <View style={styles.card}>
      {isLoading ? (
        <Text style={styles.vazio}>Carregando...</Text>
      ) : (grupos?.length ?? 0) === 0 ? (
        <Text style={styles.vazio}>Nenhum grupo cadastrado.</Text>
      ) : (
        grupos?.map((grupo, i) => (
          <View key={grupo.id} style={[styles.linha, i > 0 && styles.divisoria]}>
            <View style={styles.flex}>
              <Text style={styles.nome}>{grupo.nome}</Text>
              <Text style={styles.contagem}>
                {grupo._count?.publicadores ?? 0} publicador(es)
              </Text>
            </View>
            <Pressable
              onPress={() => abrir(grupo)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Renomear ${grupo.nome}`}
              style={({ pressed }) => [styles.acao, pressed && styles.pressionado]}
            >
              <Ionicons name="create-outline" size={17} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => remover(grupo)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Excluir ${grupo.nome}`}
              style={({ pressed }) => [styles.acao, pressed && styles.pressionado]}
            >
              <Ionicons name="trash-outline" size={17} color={colors.red} />
            </Pressable>
          </View>
        ))
      )}

      <Pressable
        onPress={() => abrir(null)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.novo, pressed && styles.pressionado]}
      >
        <Ionicons name="add" size={16} color={colors.primaryDark} />
        <Text style={styles.novoTexto}>Novo grupo</Text>
      </Pressable>

      <Sheet visible={editando !== undefined} onClose={fechar} scroll>
        <View style={styles.folha}>
          <Text style={styles.folhaTitulo}>
            {editando ? "Renomear grupo" : "Novo grupo"}
          </Text>
          {editando ? (
            <Text style={styles.folhaAviso}>
              Renomear vale para todos os {editando._count?.publicadores ?? 0} publicadores
              deste grupo.
            </Text>
          ) : null}
          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Nome de quem dirige o grupo"
            placeholderTextColor={colors.textMuted}
            style={styles.campo}
            autoFocus
          />
          <Pressable
            onPress={salvar}
            disabled={salvando}
            style={({ pressed }) => [
              styles.salvar,
              (salvando || pressed) && styles.pressionado,
            ]}
          >
            <Text style={styles.salvarTexto}>{salvando ? "Salvando..." : "Salvar"}</Text>
          </Pressable>
        </View>
      </Sheet>

      {confirmar.config ? (
        <ConfirmDialog config={confirmar.config} onClose={confirmar.close} />
      ) : null}
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingHorizontal: 14,
      overflow: "hidden",
    },
    linha: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
    divisoria: { borderTopWidth: 1, borderTopColor: colors.border },
    nome: { fontSize: 15, fontWeight: "600", color: colors.text },
    contagem: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
    acao: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
    },
    pressionado: { opacity: 0.55 },
    vazio: { fontSize: 13.5, color: colors.textMuted, paddingVertical: 14 },
    novo: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 13,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    novoTexto: { fontSize: 14, fontWeight: "700", color: colors.primaryDark },

    folha: { gap: spacing.md, paddingBottom: 4 },
    folhaTitulo: { fontSize: 19, fontWeight: "800", color: colors.text },
    folhaAviso: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    campo: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
    },
    salvar: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingVertical: 14,
      alignItems: "center",
    },
    salvarTexto: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 15 },
  });
