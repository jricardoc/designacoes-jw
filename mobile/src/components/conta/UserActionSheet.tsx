import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Usuario } from "@/api/types";
import { Sheet } from "@/components/ui";
import { colors } from "@/theme";

function initials(name?: string | null) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
}

interface Props {
  user: Usuario | null;
  onClose: () => void;
  onToggleAdmin: (u: Usuario) => void;
  onResetSenha: (u: Usuario) => void;
  onExcluir: (u: Usuario) => void;
}

/** Bottom sheet de ações de um usuário (Conta → Usuários), fiel ao design. */
export function UserActionSheet({ user, onClose, onToggleAdmin, onResetSenha, onExcluir }: Props) {
  return (
    <Sheet visible={!!user} onClose={onClose}>
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
                @{user.nickname} · {user.isAdmin ? "Administrador" : "Membro"}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 6 }}>
            <Action
              iconBg="#EAEFDC"
              icon="shield-checkmark-outline"
              iconColor={colors.primary}
              title={user.isAdmin ? "Remover admin" : "Tornar admin"}
              sub={user.isAdmin ? "Remove o acesso de administrador" : "Concede acesso de administrador"}
              onPress={() => onToggleAdmin(user)}
            />
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

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1EAD9",
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
  actionBorder: { borderBottomWidth: 1, borderBottomColor: "#F1EAD9" },
  pressed: { backgroundColor: "#F8F3E9" },
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
