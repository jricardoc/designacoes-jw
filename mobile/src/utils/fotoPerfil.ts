import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/**
 * Escolhe (galeria) ou tira (câmera) a foto de perfil, recortada em quadrado e reduzida a
 * 384 px em JPEG. Pequena de propósito: vai em base64 no corpo JSON e mora no banco, e um
 * avatar não precisa de mais que isso. Devolve null quando o irmão cancela.
 */
export async function escolherFotoPerfil(origem: "galeria" | "camera"): Promise<string | null> {
  const opcoes: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  };
  if (origem === "camera") {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) throw new Error("Permita o acesso à câmera nas configurações do aparelho.");
  }
  const escolha =
    origem === "camera"
      ? await ImagePicker.launchCameraAsync(opcoes)
      : await ImagePicker.launchImageLibraryAsync(opcoes);
  if (escolha.canceled || !escolha.assets?.length) return null;

  const contexto = ImageManipulator.manipulate(escolha.assets[0].uri);
  contexto.resize({ width: 384 });
  const imagem = await contexto.renderAsync();
  const salva = await imagem.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  return salva.base64 ?? null;
}
