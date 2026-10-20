import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { biometriaAtiva, confirmarDono, desbloqueadoHa, nomeDaBiometria, registrarDesbloqueio } from "@/utils/biometria";

/** Fora do app por menos que isto (ir ao WhatsApp compartilhar e voltar) não pede de novo. */
const TOLERANCIA_MS = 2 * 60_000;

/**
 * Bloqueio do app com Face ID / digital, para quem ligou "Entrar com Face ID" na Conta.
 *
 * Pede ao abrir o app e ao voltar depois de mais de 2 minutos fora; logo depois de um login
 * não pede (o dono acabou de provar quem é). Em segundo plano a tela fica coberta, para o
 * seletor de apps do celular não mostrar o conteúdo.
 *
 * É bloqueio de TELA: a sessão continua a mesma por baixo. Serve para quem pega o celular
 * desbloqueado não abrir o app de cara — não substitui a senha da conta.
 *
 * Montar UMA vez, na área logada.
 */
export function BloqueioBiometria() {
  const { colors, styles } = useTema(criarEstilos);
  const { logout } = useAuth();
  const [ativa, setAtiva] = useState(false);
  const [nome, setNome] = useState<string | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [coberto, setCoberto] = useState(false);
  const [pedindo, setPedindo] = useState(false);
  const saiuEm = useRef(0);

  const pedir = useCallback(async () => {
    setPedindo(true);
    try {
      if (await confirmarDono()) {
        registrarDesbloqueio();
        setBloqueado(false);
      }
    } catch {
      // Biometria indisponível agora: fica a tela com "tentar de novo" e "entrar com a senha".
    } finally {
      setPedindo(false);
    }
  }, []);

  // Ao abrir o app (sessão já existente): pede, a menos que tenha acabado de logar.
  useEffect(() => {
    (async () => {
      const n = await nomeDaBiometria();
      setNome(n);
      const ligada = !!n && (await biometriaAtiva());
      setAtiva(ligada);
      if (ligada && desbloqueadoHa() > TOLERANCIA_MS) {
        setBloqueado(true);
        pedir();
      }
    })().catch(() => {});
  }, [pedir]);

  // A chave pode ser ligada/desligada na Conta com o app aberto: relê ao voltar ao app.
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (estado) => {
      const ligada = await biometriaAtiva().catch(() => false);
      setAtiva(ligada);
      if (!ligada) {
        setCoberto(false);
        return;
      }
      if (estado === "background" || estado === "inactive") {
        if (estado === "background") saiuEm.current = Date.now();
        setCoberto(true);
        return;
      }
      if (estado === "active") {
        setCoberto(false);
        if (saiuEm.current && Date.now() - saiuEm.current > TOLERANCIA_MS && desbloqueadoHa() > TOLERANCIA_MS) {
          setBloqueado(true);
          pedir();
        }
        saiuEm.current = 0;
      }
    });
    return () => sub.remove();
  }, [pedir]);

  if (!ativa || (!bloqueado && !coberto)) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.tela}>
        <View style={styles.cadeado}>
          <Ionicons name="lock-closed" size={34} color={colors.textOnPrimary} />
        </View>
        {bloqueado ? (
          <>
            <Text style={styles.titulo}>App bloqueado</Text>
            <Text style={styles.texto}>Use o {nome ?? "Face ID"} para continuar.</Text>
            <Pressable style={styles.botao} onPress={pedir} disabled={pedindo}>
              {pedindo ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <>
                  <Ionicons
                    name={nome && /digital|Touch/.test(nome) ? "finger-print" : "scan-outline"}
                    size={22}
                    color={colors.textOnPrimary}
                  />
                  <Text style={styles.botaoTexto}>Desbloquear</Text>
                </>
              )}
            </Pressable>
            <Pressable onPress={logout} hitSlop={8}>
              <Text style={styles.senha}>Entrar com a senha</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32, backgroundColor: colors.background },
    cadeado: {
      width: 72,
      height: 72,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      marginBottom: 6,
    },
    titulo: { fontSize: 22, fontWeight: "800", color: colors.text },
    texto: { fontSize: 15, color: colors.textSecondary, textAlign: "center" },
    botao: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      minWidth: 220,
      minHeight: 56,
      paddingHorizontal: 24,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      marginTop: 8,
    },
    botaoTexto: { fontSize: 17, fontWeight: "800", color: colors.textOnPrimary },
    senha: { fontSize: 14.5, fontWeight: "700", color: colors.primaryDark, marginTop: 6 },
  });
