import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { Component } from "react";
import { captureRef } from "react-native-view-shot";

/**
 * Captura uma view em PNG (react-native-view-shot), renomeia para um nome amigável e abre a
 * folha de compartilhamento. É o irmão gêmeo de exportarPdf, para quando a imagem serve
 * melhor que o arquivo — mandar um dia solto no WhatsApp, por exemplo.
 *
 * A view precisa estar montada e já com layout; quem chama garante isso (ver o onLayout do
 * cartão escondido em app/quadro/[id].tsx).
 */
export async function exportarImagem(
  ref: React.RefObject<Component | null>,
  fileName: string,
): Promise<void> {
  const uri = await captureRef(ref, {
    format: "png",
    quality: 1,
    result: "tmpfile",
  });

  let shareUri = uri;
  const cacheDir = FileSystem.cacheDirectory;
  if (cacheDir) {
    try {
      const dest = `${cacheDir}${fileName}`;
      await FileSystem.deleteAsync(dest, { idempotent: true });
      await FileSystem.copyAsync({ from: uri, to: dest });
      shareUri = dest;
    } catch {
      // Mantém o arquivo temporário original caso a cópia falhe.
    }
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(shareUri, {
      mimeType: "image/png",
      dialogTitle: fileName,
      UTI: "public.png",
    });
  }
}
