import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError } from "@/api/client";

/**
 * Busca no servidor e guarda uma cópia no celular; sem conexão, devolve a última cópia.
 *
 * É o que deixa o dirigente abrir o território (mapa, onde paramos, Não bater) no meio da rua
 * sem sinal. Só cai para a cópia quando o servidor NÃO respondeu (status 0): erro de verdade,
 * como 404 ou 403, continua sendo erro.
 */
export async function comCopiaLocal<T extends object>(
  chave: string,
  buscar: () => Promise<T>,
): Promise<T & { copiaLocalDe?: string }> {
  try {
    const dados = await buscar();
    AsyncStorage.setItem(`copia:${chave}`, JSON.stringify({ em: new Date().toISOString(), dados })).catch(() => {});
    return dados;
  } catch (erro) {
    if (!(erro instanceof ApiError) || erro.status !== 0) throw erro;
    const bruto = await AsyncStorage.getItem(`copia:${chave}`).catch(() => null);
    if (!bruto) throw erro;
    const { em, dados } = JSON.parse(bruto) as { em: string; dados: T };
    return { ...dados, copiaLocalDe: em };
  }
}
