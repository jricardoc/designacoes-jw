import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CREAM, SplashAnimated, VISUAL } from "@/components/SplashAnimated";
import { useAuth } from "@/context/AuthContext";
import { radius } from "@/theme";
import { lerAmbiente, type Ambiente } from "@/utils/ambiente";
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
 * A tela é a splash do ambiente em que a pessoa está, parada, com o desbloqueio embaixo: a
 * abertura continua com a cara do ambiente enquanto o Face ID pede.
 *
 * Montar UMA vez, na área logada.
 */
export function BloqueioBiometria() {
  const { logout } = useAuth();
  const [ambiente, setAmbiente] = useState<Ambiente>("servir");
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
      const [n, amb] = await Promise.all([nomeDaBiometria(), lerAmbiente()]);
      setNome(n);
      setAmbiente(amb);
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
      // Cada ambiente se guarda ao entrar, então o guardado é o da vez.
      const [ligada, amb] = await Promise.all([biometriaAtiva().catch(() => false), lerAmbiente()]);
      setAtiva(ligada);
      setAmbiente(amb);
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
  // O botão é creme com o tom do meio do degradê do ambiente.
  const cor = VISUAL[ambiente].fundo[1];
  const artigo = nome === "digital" || nome === "biometria" ? "a" : "o";

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <SplashAnimated ambiente={ambiente} fica>
        {bloqueado ? (
          <View style={styles.acoes}>
            <View style={styles.aviso}>
              <Ionicons name="lock-closed" size={15} color={CREAM} />
              <Text style={styles.texto}>
                Use {artigo} {nome ?? "Face ID"} para desbloquear.
              </Text>
            </View>
            <Pressable style={styles.botao} onPress={pedir} disabled={pedindo} accessibilityRole="button">
              {pedindo ? (
                <ActivityIndicator color={cor} />
              ) : (
                <>
                  <Ionicons name={nome && /digital|Touch/.test(nome) ? "finger-print" : "scan-outline"} size={22} color={cor} />
                  <Text style={[styles.botaoTexto, { color: cor }]}>Desbloquear</Text>
                </>
              )}
            </Pressable>
            <Pressable onPress={logout} hitSlop={8} accessibilityRole="button">
              <Text style={styles.senha}>Entrar com a senha</Text>
            </Pressable>
          </View>
        ) : null}
      </SplashAnimated>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Embaixo, no lugar dos dots; o meio da tela é o da splash.
  acoes: { position: "absolute", bottom: 48, left: 32, right: 32, alignItems: "center", gap: 10 },
  aviso: { flexDirection: "row", alignItems: "center", gap: 7 },
  texto: { fontSize: 14.5, fontWeight: "600", color: CREAM },
  botao: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minWidth: 220,
    minHeight: 56,
    paddingHorizontal: 24,
    borderRadius: radius.lg,
    backgroundColor: CREAM,
  },
  botaoTexto: { fontSize: 17, fontWeight: "800" },
  senha: { fontSize: 14.5, fontWeight: "700", color: CREAM, paddingVertical: 4 },
});
