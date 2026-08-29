import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Usuario } from "@/api/types";
import { Sheet } from "@/components/ui";
import type { Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { privilegioLabel } from "@/utils/funcoes";

function initials(name?: string | null) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
}

interface Props {
  user: Usuario | null;
  /**
   * A linha aberta é a do próprio admin?
   *
   * Muda o que a folha oferece: o backend recusa em si mesmo trocar admin, mexer nas áreas
   * e excluir a conta (é assim que ninguém se tranca fora). Mostrar botões que voltariam
   * 400 seria pior do que não mostrar. Tarefa, essa, vale para si mesmo — quem monta os
   * quadros costuma ser justamente o admin geral.
   */
  ehVoce?: boolean;
  onClose: () => void;
  onToggleAdmin: (u: Usuario) => void;
  onEscopos: (u: Usuario) => void;
  onTarefas: (u: Usuario) => void;
  onResetSenha: (u: Usuario) => void;
  onExcluir: (u: Usuario) => void;
  onVincular: (u: Usuario) => void;
}

/** Bottom sheet de ações de um usuário (Conta → Usuários), fiel ao design. */
export function UserActionSheet({ user, ehVoce, onClose, onToggleAdmin, onEscopos, onTarefas, onResetSenha, onExcluir, onVincular }: Props) {
  const { colors, styles } = useTema(criarEstilos);
  return (
    <Sheet visible={!!user} onClose={onClose} scroll>
      {user ? (
        <>
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(user.nome)}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>
                {user.nome}
              </Text>
              <Text style={styles.sub}>
                @{user.nickname} ·{" "}
                {user.isAdmin
                  ? "Admin geral"
                  : user.escopos?.length
                    ? `Admin de ${user.escopos.length} área(s)`
                    : "Membro"}
                {user.privilegio ? ` · ${privilegioLabel(user.privilegio)}` : ""}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 6 }}>
            <Action
              iconBg="#E4EFF2"
              icon="link-outline"
              iconColor="#2F6F7E"
              title={user.irmaoId ? "Alterar irmão vinculado" : "Vincular a um irmão"}
              sub={user.irmaoId ? user.irmao?.nome ?? "Vinculado" : "Sem vínculo, ele não vê as próprias designações"}
              onPress={() => onVincular(user)}
            />
            {ehVoce ? null : (
              <>
                <Action
                  iconBg="#EAEFDC"
                  icon="shield-checkmark-outline"
                  iconColor={colors.primary}
                  title={user.isAdmin ? "Remover admin" : "Tornar admin"}
                  sub={user.isAdmin ? "Remove o acesso de administrador" : "Concede acesso de administrador"}
                  onPress={() => onToggleAdmin(user)}
                />
                <Action
                  iconBg={colors.infoBg}
                  icon="options-outline"
                  iconColor={colors.primaryDark}
                  title="Áreas de acesso"
                  sub={
                    user.isAdmin
                      ? "Admin geral já administra tudo"
                      : user.escopos?.length
                        ? user.escopos.join(", ")
                        : "Nenhuma área — só leitura"
                  }
                  onPress={() => onEscopos(user)}
                />
              </>
            )}
            {/* Vem logo depois das areas porque a dupla se le junta: o que ele PODE
                mexer, e o que ele DEVE fazer. Sao decisoes vizinhas e do mesmo dono. */}
            <Action
              iconBg={colors.tealBg}
              icon="checkbox-outline"
              iconColor={colors.teal}
              title="Tarefas"
              sub={
                user.tarefas?.length
                  ? `${user.tarefas.length} tarefa(s) do sistema`
                  : "Link do Zoom, quadros, confirmações..."
              }
              onPress={() => onTarefas(user)}
            />
            {ehVoce ? (
              <View style={styles.notaVoce}>
                <Ionicons name="information-circle-outline" size={16} color={colors.teal} />
                <Text style={styles.notaVoceTexto}>
                  Trocar o próprio admin, as próprias áreas ou excluir a própria conta não é
                  possível — é o que impede alguém de se trancar fora. Para mudar a sua senha,
                  use a seção de senha desta tela.
                </Text>
              </View>
            ) : (
              <>
                <Action
                  iconBg={colors.sand}
                  icon="key-outline"
                  iconColor={colors.brown}
                  title="Redefinir senha"
                  sub='Volta a senha para "jw1010"'
                  onPress={() => onResetSenha(user)}
                />
                <Action
                  iconBg="#F6E7E0"
                  icon="trash-outline"
                  iconColor={colors.red}
                  title="Excluir usuário"
                  titleColor={colors.red}
                  sub="Remove o acesso permanentemente"
                  onPress={() => onExcluir(user)}
                  last
                />
              </>
            )}
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

function Action({
  iconBg,
  icon,
  iconColor,
  title,
  titleColor,
  sub,
  onPress,
  last,
}: {
  iconBg: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  titleColor?: string;
  sub: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { styles } = useTema(criarEstilos);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, !last && styles.actionBorder, pressed && styles.pressed]}
    >
      <View style={[styles.actionIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={19} color={iconColor} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.actionTitle, titleColor ? { color: titleColor } : null]}>{title}</Text>
        <Text style={styles.actionSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    notaVoce: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      backgroundColor: colors.tealBg,
      borderRadius: 14,
      padding: 14,
      marginTop: 8,
    },
    notaVoceTexto: { flex: 1, fontSize: 12.5, color: colors.teal, lineHeight: 17 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 13,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 999,
      backgroundColor: colors.sand,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 15, fontWeight: "700", color: colors.brown },
    name: { fontSize: 18, fontWeight: "600", color: colors.text },
    sub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    action: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 4,
    },
    actionBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    pressed: { backgroundColor: colors.surfaceMuted },
    actionIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    actionTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
    actionSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
    flex: { flex: 1, minWidth: 0 },
  });
