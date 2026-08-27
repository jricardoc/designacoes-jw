import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Altura do teclado em pixels, ou 0 quando ele está fechado.
 *
 * Por que os eventos e não `KeyboardAvoidingView`: quem precisa disto aqui são os modais, e
 * no Android um `Modal` é uma JANELA própria — ela não recebe o `adjustResize` da janela
 * principal, então o KeyboardAvoidingView não reage lá dentro. Medindo o teclado e aplicando
 * o recuo à mão, o comportamento fica igual nas duas plataformas.
 *
 * No iOS os eventos `will*` chegam ANTES da animação do teclado, então o conteúdo sobe junto
 * com ele em vez de dar um pulo depois. O Android só tem os `did*`.
 */
export function useAlturaTeclado(): number {
  const [altura, setAltura] = useState(0);

  useEffect(() => {
    const eventoMostrar = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const eventoEsconder = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const aoMostrar = Keyboard.addListener(eventoMostrar, (e) =>
      setAltura(e.endCoordinates?.height ?? 0),
    );
    const aoEsconder = Keyboard.addListener(eventoEsconder, () => setAltura(0));

    return () => {
      aoMostrar.remove();
      aoEsconder.remove();
    };
  }, []);

  return altura;
}
