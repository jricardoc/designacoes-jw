import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { colors, radius, shadow } from "@/theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setErro("");
    setLoading(true);
    const result = await login(nickname.trim(), senha);
    setLoading(false);
    if (result.success) {
      router.replace("/(tabs)");
    } else {
      setErro(result.error || "Erro ao fazer login");
    }
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
              <Ionicons name="lock-closed" size={34} color="#fff" />
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
            </View>

            <Text style={styles.footer}>Congregação Norte de Itapuã</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
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
