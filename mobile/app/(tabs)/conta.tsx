import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAlterarNickname,
  useAlterarNome,
  useAlterarSenha,
  useCriarUsuario,
  useExcluirUsuario,
  useResetSenhaUsuario,
  useToggleAdmin,
  useUsuarios,
} from "@/api/hooks/useMisc";
import type { Usuario } from "@/api/types";
import { ConfirmDialog, useConfirm, useToast } from "@/components/ui";
import { UserActionSheet } from "@/components/conta/UserActionSheet";
import { useAuth } from "@/context/AuthContext";
import { colors, radius, shadow } from "@/theme";

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase() || "?";
}

/** Campo de texto estilizado conforme o design (rótulo maiúsculo, ícone, fundo areia). */
function Field({
  label,
  icon,
  prefix,
  value,
  onChangeText,
  placeholder,
  secure,
  autoCapitalize,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  prefix?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  autoCapitalize?: "none" | "sentences";
}) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldBox, focused && styles.fieldBoxFocused]}>
        {icon ? <Ionicons name={icon} size={17} color="#B0A488" /> : null}
        {prefix ? <Text style={styles.fieldPrefix}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={hidden}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.fieldInput}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8}>
            <Ionicons name={hidden ? "eye-off-outline" : "eye-outline"} size={19} color="#9C927E" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function ContaScreen() {
  const { usuario, logout, refreshUsuario } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const insets = useSafeAreaInsets();

  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [nickname, setNickname] = useState(usuario?.nickname ?? "");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [showNovo, setShowNovo] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoNickname, setNovoNickname] = useState("");
  const [menuUser, setMenuUser] = useState<Usuario | null>(null);

  useEffect(() => {
    setNome(usuario?.nome ?? "");
    setNickname(usuario?.nickname ?? "");
  }, [usuario]);

  const alterarNome = useAlterarNome();
  const alterarNickname = useAlterarNickname();
  const alterarSenha = useAlterarSenha();
  const isAdmin = !!usuario?.isAdmin;
  const { data: usuarios } = useUsuarios(isAdmin);
  const criarUsuario = useCriarUsuario();
  const toggleAdmin = useToggleAdmin();
  const resetSenha = useResetSenhaUsuario();
  const excluirUsuario = useExcluirUsuario();

  const profileDirty =
    nome.trim() !== (usuario?.nome ?? "") || nickname.trim() !== (usuario?.nickname ?? "");

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.show(ok);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro", "error");
    }
  };

  const salvarPerfil = () =>
    run(async () => {
      if (nome.trim() !== (usuario?.nome ?? "")) await alterarNome.mutateAsync(nome.trim());
      if (nickname.trim() !== (usuario?.nickname ?? ""))
        await alterarNickname.mutateAsync(nickname.trim());
      await refreshUsuario();
    }, "Perfil atualizado!");

  const doToggleAdmin = (u: Usuario) => {
    setMenuUser(null);
    run(() => toggleAdmin.mutateAsync(u.id), "Permissões alteradas!");
  };

  const doReset = (u: Usuario) => {
    setMenuUser(null);
    confirm.confirm({
      title: "Redefinir senha",
      message: `Redefinir a senha de ${u.nome} para "jw1010"?`,
      confirmText: "Redefinir",
      onConfirm: async () => {
        await run(() => resetSenha.mutateAsync(u.id), "Senha redefinida para jw1010");
        confirm.close();
      },
    });
  };

  const doExcluir = (u: Usuario) => {
    setMenuUser(null);
    confirm.confirm({
      title: "Excluir usuário",
      message: `Excluir ${u.nome}?`,
      type: "danger",
      confirmText: "Excluir",
      onConfirm: async () => {
        await run(() => excluirUsuario.mutateAsync(u.id), "Usuário excluído");
        confirm.close();
      },
    });
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerWrap}>
          <Text style={styles.h1}>Conta</Text>
          <Text style={styles.sub}>Perfil e usuários</Text>
        </View>

        {/* Perfil */}
        <View style={styles.card}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(usuario?.nome)}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.profileName} numberOfLines={1}>
                {usuario?.nome}
              </Text>
              <Text style={styles.profileNick}>@{usuario?.nickname}</Text>
            </View>
            {isAdmin ? (
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#54622F" />
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.divider} />

          <Field label="Nome" icon="person-outline" value={nome} onChangeText={setNome} />
          <View style={{ height: 16 }} />
          <Field
            label="Nickname"
            prefix="@"
            value={nickname}
            onChangeText={setNickname}
            autoCapitalize="none"
          />

          {profileDirty ? (
            <View style={styles.profileActions}>
              <Pressable
                style={styles.btnGhost}
                onPress={() => {
                  setNome(usuario?.nome ?? "");
                  setNickname(usuario?.nickname ?? "");
                }}
              >
                <Text style={styles.btnGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.btnPrimary, { flex: 1.4 }]} onPress={salvarPerfil}>
                <Text style={styles.btnPrimaryText}>Salvar alterações</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Senha */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.oliveSoft} />
            <Text style={styles.cardTitle}>Alterar Senha</Text>
          </View>
          <View style={{ height: 4 }} />
          <Field
            label="Senha atual"
            icon="lock-closed-outline"
            value={senhaAtual}
            onChangeText={setSenhaAtual}
            placeholder="••••••••"
            secure
          />
          <View style={{ height: 16 }} />
          <Field
            label="Nova senha"
            icon="key-outline"
            value={novaSenha}
            onChangeText={setNovaSenha}
            placeholder="Mínimo de 6 caracteres"
            secure
          />
          <Pressable
            style={[styles.btnPrimary, { marginTop: 18, height: 50 }]}
            onPress={() =>
              run(async () => {
                if (!senhaAtual || !novaSenha) throw new Error("Preencha as senhas");
                await alterarSenha.mutateAsync({ senhaAtual, novaSenha });
                setSenhaAtual("");
                setNovaSenha("");
              }, "Senha alterada!")
            }
          >
            <Text style={styles.btnPrimaryText}>Alterar Senha</Text>
          </Pressable>
        </View>

        {/* Usuários (admin) */}
        {isAdmin ? (
          <View style={[styles.card, { paddingBottom: 10 }]}>
            <View style={styles.cardHeadRow}>
              <View style={styles.cardHead}>
                <Ionicons name="people-outline" size={19} color={colors.oliveSoft} />
                <Text style={styles.cardTitle}>Usuários</Text>
              </View>
              <Pressable style={styles.smallBtn} onPress={() => setShowNovo((s) => !s)}>
                <Ionicons name={showNovo ? "close" : "add"} size={14} color={colors.textOnPrimary} />
                <Text style={styles.smallBtnText}>{showNovo ? "Fechar" : "Novo"}</Text>
              </Pressable>
            </View>
            <Text style={styles.cardSub}>{usuarios?.length ?? 0} usuário(s)</Text>

            {showNovo ? (
              <View style={styles.novoBox}>
                <Field label="Nome" value={novoNome} onChangeText={setNovoNome} />
                <View style={{ height: 12 }} />
                <Field
                  label="Nickname"
                  prefix="@"
                  value={novoNickname}
                  onChangeText={setNovoNickname}
                  autoCapitalize="none"
                />
                <Pressable
                  style={[styles.btnPrimary, { marginTop: 14 }]}
                  onPress={() =>
                    run(async () => {
                      if (!novoNome.trim() || !novoNickname.trim())
                        throw new Error("Preencha nome e nickname");
                      await criarUsuario.mutateAsync({
                        nome: novoNome.trim(),
                        nickname: novoNickname.trim(),
                      });
                      setNovoNome("");
                      setNovoNickname("");
                      setShowNovo(false);
                    }, "Usuário criado! Senha: jw1010")
                  }
                >
                  <Text style={styles.btnPrimaryText}>Criar Usuário</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={{ marginTop: 4 }}>
              {usuarios?.map((u) => (
                <View key={u.id} style={styles.userRow}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userInitials}>{initials(u.nome)}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {u.nome}
                    </Text>
                    <Text style={styles.userNick}>@{u.nickname}</Text>
                  </View>
                  {u.isAdmin ? (
                    <View style={styles.adminBadgeSm}>
                      <Ionicons name="shield-checkmark" size={10} color="#54622F" />
                      <Text style={styles.adminBadgeSmText}>Admin</Text>
                    </View>
                  ) : null}
                  {u.id === usuario?.id ? (
                    <Text style={styles.voce}>Você</Text>
                  ) : (
                    <Pressable style={styles.menuBtn} onPress={() => setMenuUser(u)} hitSlop={6}>
                      <Ionicons name="ellipsis-horizontal" size={18} color="#9A8F7D" />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Configurações */}
        <Pressable style={styles.linkRow} onPress={() => router.push("/config")}>
          <View style={styles.linkIcon}>
            <Ionicons name="settings-outline" size={18} color={colors.brown} />
          </View>
          <Text style={styles.linkText}>Configurações</Text>
          <Ionicons name="chevron-forward" size={16} color="#C6BAA0" />
        </Pressable>

        {/* Sair */}
        <Pressable style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color={colors.redDark} />
          <Text style={styles.logoutText}>Sair</Text>
        </Pressable>
      </ScrollView>

      <UserActionSheet
        user={menuUser}
        onClose={() => setMenuUser(null)}
        onToggleAdmin={doToggleAdmin}
        onResetSenha={doReset}
        onExcluir={doExcluir}
      />
      <ConfirmDialog config={confirm.config} onClose={confirm.close} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 18, paddingTop: 58, paddingBottom: 40 },
  headerWrap: { paddingHorizontal: 4, marginBottom: 16 },
  h1: { fontSize: 33, fontWeight: "600", letterSpacing: -0.6, color: colors.text },
  sub: { fontSize: 15, color: colors.textSecondary, marginTop: 6 },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    ...shadow.card,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 9 },
  cardHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: { fontSize: 18, fontWeight: "600", color: colors.text },
  cardSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 5 },

  profileTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: colors.oliveSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.textOnPrimary, fontSize: 20, fontWeight: "700" },
  profileName: { fontSize: 20, fontWeight: "600", color: colors.text },
  profileNick: { fontSize: 13, color: colors.textMuted, marginTop: 3 },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.successBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  adminBadgeText: { color: "#54622F", fontWeight: "700", fontSize: 11.5 },
  divider: { height: 1, backgroundColor: "#EFE7D7", marginVertical: 17 },

  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  fieldBox: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    height: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  fieldBoxFocused: { borderColor: colors.oliveSoft, backgroundColor: colors.surface },
  fieldPrefix: { fontSize: 16, fontWeight: "600", color: "#9DA882" },
  fieldInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },

  profileActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  btnGhost: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: "#E2D9C7",
    backgroundColor: colors.surface,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhostText: { color: "#7A7060", fontSize: 14, fontWeight: "600" },
  btnPrimary: {
    height: 46,
    backgroundColor: colors.primary,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  btnPrimaryText: { color: colors.textOnPrimary, fontSize: 14.5, fontWeight: "600" },

  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  smallBtnText: { color: colors.textOnPrimary, fontSize: 13.5, fontWeight: "600" },
  novoBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 12,
  },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1EAD9",
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.sand,
    alignItems: "center",
    justifyContent: "center",
  },
  userInitials: { fontSize: 13, fontWeight: "700", color: colors.brown },
  userName: { fontSize: 15, fontWeight: "600", color: colors.text },
  userNick: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  adminBadgeSm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.successBg,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  adminBadgeSmText: { color: "#54622F", fontWeight: "700", fontSize: 10.5 },
  voce: { fontSize: 11.5, fontWeight: "600", color: "#B0A488" },
  menuBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    ...shadow.card,
  },
  linkIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.sand,
    alignItems: "center",
    justifyContent: "center",
  },
  linkText: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    height: 52,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E3C9C0",
    backgroundColor: "#F6EAE4",
    borderRadius: 16,
  },
  logoutText: { color: colors.redDark, fontSize: 15, fontWeight: "600" },
  flex: { flex: 1 },
});
