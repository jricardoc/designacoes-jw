import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Os dois "apps" dentro do app: o Servir Mais (designações da congregação) e o Ministério (o
 * do pioneiro). O último escolhido é onde o app abre na próxima vez.
 */
export type Ambiente = "servir" | "ministerio";

const KEY = "ambiente";

export const HREF_AMBIENTE = { servir: "/(tabs)/minhas", ministerio: "/ministerio" } as const;

export const guardarAmbiente = (a: Ambiente) => {
  AsyncStorage.setItem(KEY, a).catch(() => {});
};

export async function lerAmbiente(): Promise<Ambiente> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "ministerio" ? "ministerio" : "servir";
  } catch {
    return "servir";
  }
}

/** O tour das novidades do Ministério, mostrado na primeira entrada. */
export const KEY_TOUR_MINISTERIO = "ministerio_tour_v1";
