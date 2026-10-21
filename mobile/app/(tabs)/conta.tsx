import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiRequest } from "@/api/client";
import {
  useAlterarFoto,
  useAlterarNickname,
  useAlterarNome,
  useAlterarSenha,
  useCriarUsuario,
  useExcluirUsuario,
  useResetSenhaUsuario,
  useAtualizarEscopos,
  useToggleAdmin,
  useUsuarios,
} from "@/api/hooks/useMisc";
import type { EscopoAdmin, TarefaAtribuivel, Usuario } from "@/api/types";
import {
  Avatar,
  Button,
  ConfirmDialog,
  GradientHeader,
  SelectSheet,
  Sheet,
  TextField,
  useConfirm,
  useToast,
} from "@/components/ui";
import { PrivilegioBadge } from "@/components/PrivilegioBadge";
import { EscoposSheet } from "@/components/conta/EscoposSheet";
import { useDefinirTarefas } from "@/api/hooks/useTarefas";
import { TarefasSheet } from "@/components/conta/TarefasSheet";
import { UserActionSheet } from "@/components/conta/UserActionSheet";
import { VincularIrmaoSheet } from "@/components/conta/VincularIrmaoSheet";
import { useIrmaosDisponiveis } from "@/api/hooks/useMinhasDesignacoes";
import { useAuth } from "@/context/AuthContext";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { useBarraFlutuante } from "@/components/layout/contextoRolagem";
import {
  ativarBiometria,
  atualizarBiometria,
  biometriaAtiva,
  desativarBiometria,
  nomeDaBiometria,
} from "@/utils/biometria";
import { escolherFotoPerfil } from "@/utils/fotoPerfil";

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
  const { colors, styles } = useTema(criarEstilos);
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
  // Chamado UMA vez, no topo: o ScrollView abaixo mora dentro de um condicional
  // (carregando / vazio / lista), e espalhar o hook lá dentro o tornaria uma
  // chamada condicional — proibido, e quebra na primeira troca de estado.
  const { rolagem, recuo } = useBarraFlutuante();
  const { colors, styles } = useTema(criarEstilos);
  const { usuario, logout, refreshUsuario } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [nickname, setNickname] = useState(usuario?.nickname ?? "");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [showNovo, setShowNovo] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoNickname, setNovoNickname] = useState("");
  const [menuUser, setMenuUser] = useState<Usuario | null>(null);
  const [vinculandoUser, setVinculandoUser] = useState<Usuario | null>(null);
  const [escoposUser, setEscoposUser] = useState<Usuario | null>(null);
  const [tarefasUser, setTarefasUser] = useState<Usuario | null>(null);
  const [novoIrmaoId, setNovoIrmaoId] = useState<number | null>(null);
  const [fotoMenu, setFotoMenu] = useState(false);
  // Biometria deste aparelho: nome ("Face ID", "digital") quando existe, e se está ligada.
  const [bioNome, setBioNome] = useState<string | null>(null);
  const [bioLigada, setBioLigada] = useState(false);
  const [senhaBio, setSenhaBio] = useState<string | null>(null);
  const [confirmandoBio, setConfirmandoBio] = useState(false);

  useEffect(() => {
    (async () => {
      const nome = await nomeDaBiometria();
      setBioNome(nome);
      setBioLigada(nome ? await biometriaAtiva() : false);
    })().catch(() => {});
  }, []);

  useEffect(() => {
    setNome(usuario?.nome ?? "");
    setNickname(usuario?.nickname ?? "");
  }, [usuario]);

  const alterarNome = useAlterarNome();
  const alterarNickname = useAlterarNickname();
  const alterarSenha = useAlterarSenha();
  const alterarFoto = useAlterarFoto();
  const isAdmin = !!usuario?.isAdmin;
  const { data: usuarios } = useUsuarios(isAdmin);
  const criarUsuario = useCriarUsuario();
  const toggleAdmin = useToggleAdmin();
  const salvarEscopos = useAtualizarEscopos();
  const salvarTarefas = useDefinirTarefas();
  const resetSenha = useResetSenhaUsuario();
  const excluirUsuario = useExcluirUsuario();
  const { data: irmaosLivres } = useIrmaosDisponiveis(null, isAdmin && showNovo);

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
      if (usuario && nickname.trim() !== usuario.nickname) {
        await alterarNickname.mutateAsync(nickname.trim());
        await atualizarBiometria(usuario.nickname, { nickname: nickname.trim() });
      }
      await refreshUsuario();
    }, "Perfil atualizado!");

  const trocarFoto = async (opcao: string) => {
    setFotoMenu(false);
    try {
      let imagem: string | null = null;
      if (opcao !== "remover") {
        // No iOS o seletor não abre enquanto a folha ainda está fechando.
        if (Platform.OS === "ios") await new Promise((r) => setTimeout(r, 400));
        imagem = await escolherFotoPerfil(opcao === "camera" ? "camera" : "galeria");
        if (!imagem) return;
      }
      await alterarFoto.mutateAsync(imagem);
      await refreshUsuario();
      toast.show(imagem ? "Foto atualizada!" : "Foto removida");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao trocar a foto", "error");
    }
  };

  const alternarBiometria = async (ligar: boolean) => {
    if (ligar) {
      setSenhaBio("");
      return;
    }
    await desativarBiometria();
    setBioLigada(false);
    toast.show(`${bioNome} desligado neste aparelho`);
  };

  const confirmarBiometria = async () => {
    if (!usuario || !senhaBio) return;
    setConfirmandoBio(true);
    try {
      // Confere a senha antes de guardar: guardada errada, a biometria só falharia no
      // próximo login, longe daqui.
      await apiRequest("/auth/login", {
        method: "POST",
        body: { nickname: usuario.nickname, senha: senhaBio },
        skipAuth: true,
      });
      await ativarBiometria({ nickname: usuario.nickname, senha: senhaBio });
      setBioLigada(true);
      setSenhaBio(null);
      toast.show(`${bioNome} ativado!`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao ativar", "error");
    } finally {
      setConfirmandoBio(false);
    }
  };

  const doToggleAdmin = (u: Usuario) => {
    setMenuUser(null);
    run(() => toggleAdmin.mutateAsync(u.id), "Permissões alteradas!");
  };

  const doSalvarEscopos = async (escopos: EscopoAdmin[]) => {
    if (!escoposUser) return;
    await run(
      () => salvarEscopos.mutateAsync({ id: escoposUser.id, escopos }),
      "Áreas de acesso atualizadas!",
    );
    setEscoposUser(null);
  };

  const doSalvarTarefas = async (tarefas: TarefaAtribuivel[]) => {
    if (!tarefasUser) return;
    await run(
      () => salvarTarefas.mutateAsync({ id: tarefasUser.id, tarefas }),
      "Tarefas atualizadas!",
    );
    setTarefasUser(null);
  };

  const doReset = (u: Usuario) => {
    setMenuUser(null);
    confirm.confirm({
      title: "Redefinir senha",
      message: `Redefinir a senha de ${u.nome} para a senha padrão?`,
      confirmText: "Redefinir",
      onConfirm: async () => {
        try {
          const r = await resetSenha.mutateAsync(u.id);
          toast.show(`Senha redefinida para ${r?.senha ?? "a senha padrão"}`);
        } catch (err) {
          toast.show(err instanceof Error ? err.message : "Erro", "error");
        }
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
      <GradientHeader title="Conta" description="Perfil e usuários" />

      <ScrollView {...rolagem} contentContainerStyle={[styles.scroll, recuo]} automaticallyAdjustKeyboardInsets>
        {/* Perfil */}
        <View style={styles.card}>
          <View style={styles.profileTop}>
            {usuario ? (
              <Pressable
                onPress={() => setFotoMenu(true)}
                disabled={alterarFoto.isPending}
                accessibilityRole="button"
                accessibilityLabel="Trocar foto de perfil"
              >
                <Avatar
                  usuario={usuario}
                  tamanho={58}
                  fundo={colors.oliveSoft}
                  corTexto={colors.textOnPrimary}
                />
                <View style={styles.fotoBadge}>
                  <Ionicons name="camera" size={12} color={colors.textOnPrimary} />
                </View>
              </Pressable>
            ) : null}
            <View style={styles.flex}>
              <Text style={styles.profileName} numberOfLines={1}>
                {usuario?.nome}
              </Text>
              <View style={styles.linhaCargo}>
                <Text style={styles.profileNick}>@{usuario?.nickname}</Text>
                <PrivilegioBadge privilegio={usuario?.privilegio} size="sm" />
              </View>
            </View>
            {isAdmin ? (
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={12} color={colors.greenDark} />
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
                if (usuario) await atualizarBiometria(usuario.nickname, { senha: novaSenha });
                setSenhaAtual("");
                setNovaSenha("");
              }, "Senha alterada!")
            }
          >
            <Text style={styles.btnPrimaryText}>Alterar Senha</Text>
          </Pressable>
        </View>

        {/* Biometria: só aparece em aparelho com Face ID/digital cadastrado. */}
        {bioNome ? (
          <View style={styles.card}>
            <View style={styles.cardHeadRow}>
              <View style={[styles.cardHead, styles.flex]}>
                <Ionicons
                  name={/digital|Touch/.test(bioNome) ? "finger-print" : "scan-outline"}
                  size={18}
                  color={colors.oliveSoft}
                />
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>Entrar com {bioNome}</Text>
                  <Text style={styles.cardSub}>Pede o {bioNome} ao abrir o app e no lugar da senha</Text>
                </View>
              </View>
              <Switch
                value={bioLigada}
                onValueChange={alternarBiometria}
                trackColor={{ true: colors.primary, false: colors.borderStrong }}
                thumbColor="#fff"
              />
            </View>
          </View>
        ) : null}

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

                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
                  Sincronizar com um irmão
                </Text>
                <Text style={styles.novoHint}>
                  É o vínculo que faz as designações dele aparecerem em “Minhas
                  Designações”.
                </Text>
                <View style={styles.irmaoChips}>
                  <Pressable
                    onPress={() => setNovoIrmaoId(null)}
                    style={[styles.irmaoChip, novoIrmaoId === null && styles.irmaoChipAtivo]}
                  >
                    <Text style={[styles.irmaoChipTexto, novoIrmaoId === null && styles.irmaoChipTextoAtivo]}>
                      Sem vínculo
                    </Text>
                  </Pressable>
                  {(irmaosLivres ?? []).filter((i) => i.disponivel).map((i) => {
                    const ativo = novoIrmaoId === i.id;
                    return (
                      <Pressable
                        key={i.id}
                        onPress={() => setNovoIrmaoId(i.id)}
                        style={[styles.irmaoChip, ativo && styles.irmaoChipAtivo]}
                      >
                        <Text style={[styles.irmaoChipTexto, ativo && styles.irmaoChipTextoAtivo]}>
                          {i.nome}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  style={[styles.btnPrimary, { marginTop: 14 }]}
                  onPress={async () => {
                    try {
                      if (!novoNome.trim() || !novoNickname.trim())
                        throw new Error("Preencha nome e nickname");
                      const criado = await criarUsuario.mutateAsync({
                        nome: novoNome.trim(),
                        nickname: novoNickname.trim(),
                        irmaoId: novoIrmaoId,
                      });
                      setNovoNome("");
                      setNovoNickname("");
                      setNovoIrmaoId(null);
                      setShowNovo(false);
                      toast.show(`Usuário criado! Senha: ${criado.senhaInicial ?? "a senha padrão"}`);
                    } catch (err) {
                      toast.show(err instanceof Error ? err.message : "Erro", "error");
                    }
                  }}
                >
                  <Text style={styles.btnPrimaryText}>Criar Usuário</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={{ marginTop: 4 }}>
              {usuarios?.map((u) => (
                <View key={u.id} style={styles.userRow}>
                  <Avatar usuario={u} tamanho={40} fundo={colors.sand} corTexto={colors.brown} />
                  <View style={styles.flex}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {u.nome}
                    </Text>
                    <View style={styles.linhaCargo}>
                      <Text style={styles.userNick}>@{u.nickname}</Text>
                      <PrivilegioBadge privilegio={u.privilegio} size="sm" abreviado />
                    </View>
                  </View>
                  {u.isAdmin ? (
                    <View style={styles.adminBadgeSm}>
                      <Ionicons name="shield-checkmark" size={10} color={colors.greenDark} />
                      <Text style={styles.adminBadgeSmText}>Admin</Text>
                    </View>
                  ) : null}
                  {u.id === usuario?.id ? <Text style={styles.voce}>Você</Text> : null}
                  {/* O "..." aparece TAMBÉM na própria linha. Antes ele dava lugar ao
                      rótulo "Você", e com isso o admin geral não conseguia designar uma
                      tarefa a si mesmo — justamente quem costuma montar os quadros. As
                      ações que o backend recusa em si mesmo (admin, áreas, excluir) somem
                      dentro da folha; ver UserActionSheet. */}
                  <Pressable style={styles.menuBtn} onPress={() => setMenuUser(u)} hitSlop={6}>
                    <Ionicons name="ellipsis-horizontal" size={18} color="#9A8F7D" />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Configurações — `replace` e não `push`: agora é um item do menu como
            os outros, e sem botão "Voltar" próprio empilhar deixaria o irmão sem
            saída visível da tela. */}
        <Pressable
          style={styles.linkRow}
          onPress={() => router.replace("/(tabs)/config")}
        >
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
        ehVoce={menuUser?.id === usuario?.id}
        onClose={() => setMenuUser(null)}
        onToggleAdmin={doToggleAdmin}
        onEscopos={(u) => { setMenuUser(null); setEscoposUser(u); }}
        onTarefas={(u) => { setMenuUser(null); setTarefasUser(u); }}
        onResetSenha={doReset}
        onExcluir={doExcluir}
        onVincular={(u) => { setMenuUser(null); setVinculandoUser(u); }}
      />
      <EscoposSheet
        user={escoposUser}
        salvando={salvarEscopos.isPending}
        onClose={() => setEscoposUser(null)}
        onSalvar={doSalvarEscopos}
      />
      <TarefasSheet
        user={tarefasUser}
        salvando={salvarTarefas.isPending}
        onClose={() => setTarefasUser(null)}
        onSalvar={doSalvarTarefas}
      />
      <VincularIrmaoSheet
        user={vinculandoUser}
        onClose={() => setVinculandoUser(null)}
        onVinculado={refreshUsuario}
      />
      <SelectSheet
        visible={fotoMenu}
        title="Foto de perfil"
        allowClear={false}
        options={[
          { value: "galeria", label: "Escolher da galeria" },
          { value: "camera", label: "Tirar foto" },
          ...(usuario?.fotoEm
            ? [{ value: "remover", label: "Remover foto", color: colors.red }]
            : []),
        ]}
        onSelect={trocarFoto}
        onClose={() => setFotoMenu(false)}
      />
      <Sheet visible={senhaBio !== null} onClose={() => setSenhaBio(null)}>
        <View style={styles.bioSheet}>
          <Text style={styles.cardTitle}>Ativar {bioNome}</Text>
          <Text style={styles.cardSub}>
            Confirme sua senha. Ela fica guardada no chaveiro deste aparelho e só sai com o seu{" "}
            {bioNome}.
          </Text>
          <TextField
            label="Senha"
            icon="lock-closed"
            secure
            value={senhaBio ?? ""}
            onChangeText={setSenhaBio}
            onSubmitEditing={confirmarBiometria}
          />
          <Button
            label="Ativar"
            onPress={confirmarBiometria}
            loading={confirmandoBio}
            disabled={!senhaBio}
            fullWidth
          />
        </View>
      </Sheet>
      <ConfirmDialog config={confirm.config} onClose={confirm.close} />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 18, paddingTop: 4 },

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
  fotoBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  bioSheet: { gap: 14, paddingBottom: 8 },
  profileName: { fontSize: 20, fontWeight: "600", color: colors.text },
  profileNick: { fontSize: 13, color: colors.textMuted, marginTop: 3 },
  linhaCargo: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  novoHint: { fontSize: 12, color: colors.textMuted, marginTop: 3, marginBottom: 8, lineHeight: 17 },
  irmaoChips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  irmaoChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  irmaoChipAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  irmaoChipTexto: { fontSize: 12.5, fontWeight: "500", color: colors.textSecondary },
  irmaoChipTextoAtivo: { color: colors.textOnPrimary },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.successBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  adminBadgeText: { color: colors.greenDark, fontWeight: "700", fontSize: 11.5 },
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
    borderColor: colors.handle,
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
    borderTopColor: colors.border,
  },
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
  adminBadgeSmText: { color: colors.greenDark, fontWeight: "700", fontSize: 10.5 },
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
    borderColor: colors.border,
    backgroundColor: colors.dangerBg,
    borderRadius: 16,
  },
  logoutText: { color: colors.redDark, fontSize: 15, fontWeight: "600" },
  flex: { flex: 1 },
});
