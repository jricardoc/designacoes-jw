import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Os "apps" dentro do app: o Servir Mais (designações da congregação), o Ministério (o do
 * pioneiro) e o Território (mapas e saídas). O último escolhido é onde o app abre na próxima vez.
 */
export type Ambiente = "servir" | "ministerio" | "territorio";

const KEY = "ambiente";

export const HREF_AMBIENTE = { servir: "/(tabs)/minhas", ministerio: "/ministerio", territorio: "/territorio" } as const;

export const guardarAmbiente = (a: Ambiente) => {
  AsyncStorage.setItem(KEY, a).catch(() => {});
};

export async function lerAmbiente(): Promise<Ambiente> {
  try {
    const a = await AsyncStorage.getItem(KEY);
    return a === "ministerio" || a === "territorio" ? a : "servir";
  } catch {
    return "servir";
  }
}

/** O tour das novidades do Ministério, mostrado na primeira entrada. */
export const KEY_TOUR_MINISTERIO = "ministerio_tour_v1";
