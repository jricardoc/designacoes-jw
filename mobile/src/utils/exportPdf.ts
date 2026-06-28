import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

/**
 * Renderiza um HTML para PDF (expo-print), renomeia para um nome amigável e abre
 * a folha de compartilhamento (salvar em Arquivos, enviar por WhatsApp, etc.).
 */
export async function exportarPdf(html: string, fileName: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html, base64: false });

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
      mimeType: "application/pdf",
      dialogTitle: fileName,
      UTI: "com.adobe.pdf",
    });
  }
}
