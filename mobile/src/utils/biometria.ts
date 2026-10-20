import Constants from "expo-constants";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Entrar com Face ID (iPhone) ou digital (Android).
 *
 * Guarda nickname e senha no chaveiro do aparelho (Keychain/Keystore, via SecureStore) e só
 * os devolve depois que a biometria confirma o dono. É a senha, e não o token, de propósito:
 * o token vence em 7 dias e o "Sair" o apaga — com ele, a biometria pararia de funcionar
 * justamente na volta ao app, que é quando ela serve.
 */

const CHAVE = "biometria_credenciais";
// Oferecer a ativação uma vez só: quem disse "agora não" ativa depois pela Conta.
const CHAVE_OFERECIDA = "biometria_oferecida";

export interface Credenciais {
  nickname: string;
  senha: string;
}

/** "Face ID", "digital"... ou null quando o aparelho não tem biometria cadastrada. */
export async function nomeDaBiometria(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!(await LocalAuthentication.hasHardwareAsync())) return null;
  if (!(await LocalAuthentication.isEnrolledAsync())) return null;
  const tipos = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const { FACIAL_RECOGNITION, FINGERPRINT } = LocalAuthentication.AuthenticationType;
  const ios = Platform.OS === "ios";
  if (tipos.includes(FACIAL_RECOGNITION)) return ios ? "Face ID" : "reconhecimento facial";
  if (tipos.includes(FINGERPRINT)) return ios ? "Touch ID" : "digital";
  return "biometria";
}

export async function biometriaAtiva(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  return !!(await SecureStore.getItemAsync(CHAVE));
}

export async function ativarBiometria(credenciais: Credenciais): Promise<void> {
  await SecureStore.setItemAsync(CHAVE, JSON.stringify(credenciais));
}

export async function desativarBiometria(): Promise<void> {
  await SecureStore.deleteItemAsync(CHAVE);
}

/**
 * Troca de senha ou nickname com a biometria ligada: sem isto, o próximo login falharia.
 * Só mexe se a biometria guardada for de `nickname` — num aparelho emprestado, o login de
 * outra pessoa não pode passar a abrir com o rosto do dono.
 */
export async function atualizarBiometria(
  nickname: string,
  novos: Partial<Credenciais>,
): Promise<void> {
  const bruto = Platform.OS === "web" ? null : await SecureStore.getItemAsync(CHAVE);
  if (!bruto) return;
  const atuais = JSON.parse(bruto) as Credenciais;
  if (atuais.nickname !== nickname) return;
  await ativarBiometria({ ...atuais, ...novos });
}

/** Pede a biometria e devolve as credenciais; null se cancelar ou não for o dono. */
export async function lerComBiometria(): Promise<Credenciais | null> {
  const nomeApp = Constants.expoConfig?.name ?? "o app";
  const resultado = await LocalAuthentication.authenticateAsync({
    promptMessage: `Entrar no ${nomeApp}`,
    cancelLabel: "Usar senha",
  });
  if (!resultado.success) return null;
  const bruto = await SecureStore.getItemAsync(CHAVE);
  return bruto ? (JSON.parse(bruto) as Credenciais) : null;
}

export async function biometriaJaOferecida(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync(CHAVE_OFERECIDA));
}

export async function marcarBiometriaOferecida(): Promise<void> {
  await SecureStore.setItemAsync(CHAVE_OFERECIDA, "1");
}
