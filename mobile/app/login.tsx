import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useConfigPublica } from "@/api/hooks/useMisc";
import { Button, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import {
  ativarBiometria,
  atualizarBiometria,
  biometriaAtiva,
  biometriaJaOferecida,
  desativarBiometria,
  lerComBiometria,
  marcarBiometriaOferecida,
  nomeDaBiometria,
} from "@/utils/biometria";

export default function LoginScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const { login } = useAuth();
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  // Nome da biometria do aparelho ("Face ID", "digital"); null = não tem ou não cadastrou.
  const [biometria, setBiometria] = useState<string | null>(null);
  const [bioAtiva, setBioAtiva] = useState(false);
  const { data: publica } = useConfigPublica();

  const entrarComBiometria = async (nome: string | null = biometria) => {
    setErro("");
    const cred = await lerComBiometria().catch(() => null);
    if (!cred) return;
    setLoading(true);
    const result = await login(cred.nickname, cred.senha);
    setLoading(false);
    if (result.success) {
      router.replace("/(tabs)/minhas");
    } else if (result.status === 401) {
      // A senha guardada não vale mais (trocada em outro aparelho ou redefinida pelo admin).
      await desativarBiometria();
      setBioAtiva(false);
      setNickname(cred.nickname);
      setErro(`Sua senha mudou. Entre com a nova senha para voltar a usar ${nome ?? "a biometria"}.`);
    } else {
      setErro(result.error || "Erro ao fazer login");
    }
  };

  useEffect(() => {
    (async () => {
      const nome = await nomeDaBiometria();
      const ativa = nome ? await biometriaAtiva() : false;
      setBiometria(nome);
      setBioAtiva(ativa);
      // Abre sozinho: quem ativou a biometria quer entrar sem tocar em nada.
      if (ativa) await entrarComBiometria(nome);
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    setErro("");
    setLoading(true);
    const nick = nickname.trim();
    const result = await login(nick, senha);
    setLoading(false);
    if (!result.success) {
      setErro(result.error || "Erro ao fazer login");
      return;
    }
    // Biometria já ligada para esta conta: guarda a senha que acabou de funcionar.
    await atualizarBiometria(nick, { senha }).catch(() => {});
    if (biometria && !bioAtiva && !(await biometriaJaOferecida())) {
      await marcarBiometriaOferecida();
      Alert.alert(
        `Entrar com ${biometria}?`,
        "Nas próximas vezes você entra sem digitar a senha. Dá para desligar na tela Conta.",
        [
          { text: "Agora não", style: "cancel" },
          { text: "Ativar", onPress: () => ativarBiometria({ nickname: nick, senha }) },
        ],
      );
    }
    router.replace("/(tabs)/minhas");
  };

  return (
    <LinearGradient colors={colors.loginGradient} style={styles.flex}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, shadow.raised]}>
            <View style={styles.logoBox}>
              <Ionicons name="lock-closed" size={34} color={colors.textOnPrimary} />
            </View>
            <Text style={styles.title}>Quadro de Designações</Text>
            <Text style={styles.subtitle}>Acesse sua conta para continuar</Text>

            <View style={styles.form}>
              <TextField
                label="Nickname"
                icon="person"
                placeholder="admin"
                autoCapitalize="none"
                autoCorrect={false}
                value={nickname}
                onChangeText={setNickname}
              />
              <TextField
                label="Senha"
                icon="lock-closed"
                placeholder="Digite sua senha"
                secure
                value={senha}
                onChangeText={setSenha}
                onSubmitEditing={handleSubmit}
              />

              {erro ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color={colors.redDark} />
                  <Text style={styles.errorText}>{erro}</Text>
                </View>
              ) : null}

              <Button
                label="Entrar"
                onPress={handleSubmit}
                loading={loading}
                fullWidth
                style={{ marginTop: 4 }}
              />

              {bioAtiva && biometria ? (
                <Button
                  label={`Entrar com ${biometria}`}
                  icon={/digital|Touch/.test(biometria) ? "finger-print" : "scan-outline"}
                  variant="secondary"
                  onPress={() => entrarComBiometria()}
                  disabled={loading}
                  fullWidth
                />
              ) : null}
            </View>

            {publica?.congregacao ? (
              <Text style={styles.footer}>{publica.congregacao}</Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 30,
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
    ...shadow.raised,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.oliveSoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  form: { gap: 14, marginTop: 26 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: 12,
  },
  errorText: { color: colors.redDark, flex: 1, fontSize: 14 },
  footer: {
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 26,
  },
  });
