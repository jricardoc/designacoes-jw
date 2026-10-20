import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { useImagemProtegida } from "@/api/hooks/useImagemProtegida";
import type { Usuario } from "@/api/types";

export function iniciais(nome?: string | null) {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? "";
  const b = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (a + b).toUpperCase() || "?";
}

interface AvatarProps {
  usuario: Pick<Usuario, "id" | "nome" | "fotoEm">;
  tamanho: number;
  /** Fundo e cor das iniciais, para quem não tem foto. */
  fundo: string;
  corTexto: string;
}

/**
 * Foto de perfil, ou as iniciais quando não há foto (ou ela não carregou).
 *
 * A foto vem de GET /usuarios/:id/foto, que exige login. `fotoEm` vai na URL para trocar a
 * foto furar o cache de imagem do Android, que indexa pela URL e não revalida.
 */
export function Avatar({ usuario, tamanho, fundo, corTexto }: AvatarProps) {
  const fonte = useImagemProtegida();
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [usuario.fotoEm]);

  const source =
    usuario.fotoEm && !falhou
      ? fonte(`/usuarios/${usuario.id}/foto?v=${encodeURIComponent(usuario.fotoEm)}`)
      : null;

  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        backgroundColor: fundo,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {source ? (
        <Image
          source={source}
          style={{ width: tamanho, height: tamanho }}
          onError={() => setFalhou(true)}
          accessibilityLabel={`Foto de ${usuario.nome}`}
        />
      ) : (
        <Text style={{ color: corTexto, fontSize: tamanho * 0.35, fontWeight: "700" }}>
          {iniciais(usuario.nome)}
        </Text>
      )}
    </View>
  );
}
