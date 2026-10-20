import * as Location from "expo-location";

export interface Localizacao {
  lat: number;
  lng: number;
  /** Raio de incerteza em metros, como o aparelho informou. */
  precisao: number | null;
}

/**
 * A posição atual pelo GPS. Funciona sem internet (o GPS não precisa de dados).
 *
 * Com teto de tempo: dentro de casa ou em rua estreita o GPS pode demorar a fixar, e o irmão
 * não pode ficar parado olhando um spinner. Passado o teto, vale a última posição conhecida,
 * se for recente.
 */
export async function minhaLocalizacao(): Promise<Localizacao> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Permita o acesso à localização nas configurações do celular para marcar no mapa.");
  }
  const atual = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const teto = new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000));
  const posicao =
    (await Promise.race([atual, teto])) ??
    (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60000 }));
  if (!posicao) throw new Error("Não consegui achar sua localização. Vá para um lugar aberto e tente de novo.");
  return {
    lat: posicao.coords.latitude,
    lng: posicao.coords.longitude,
    precisao: posicao.coords.accuracy ?? null,
  };
}
