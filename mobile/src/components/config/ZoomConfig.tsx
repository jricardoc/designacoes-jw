import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { useAtualizarConfig, useConfig } from "@/api/hooks/useMisc";
import type { ConfigZoom, ZoomReuniao } from "@/api/types";
import { Button, useToast } from "@/components/ui";
import { radius, shadow, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

const CAMPOS: {
  chave: keyof ZoomReuniao;
  rotulo: string;
  placeholder: string;
  teclado?: TextInputProps["keyboardType"];
}[] = [
  { chave: "link", rotulo: "Link", placeholder: "https://zoom.us/j/...", teclado: "url" },
  { chave: "id", rotulo: "ID da reunião", placeholder: "000 0000 0000", teclado: "numbers-and-punctuation" },
  { chave: "senha", rotulo: "Senha", placeholder: "Senha de acesso" },
  { chave: "salaAberta", rotulo: "Sala abre às", placeholder: "19:00", teclado: "numbers-and-punctuation" },
];

const TIPOS = [
  { tipo: "meio", rotulo: "Meio de semana" },
  { tipo: "fds", rotulo: "Fim de semana" },
] as const;

/**
 * Os dados do Zoom que entram nos convites da tela de Reunião. Sem link nem ID, o convite
 * daquela reunião não aparece no "Compartilhar" — é o estado de uma instalação nova.
 */
export function ZoomConfig() {
  const { colors, styles } = useTema(criarEstilos);
  const { data: config } = useConfig();
  const atualizar = useAtualizarConfig();
  const toast = useToast();
  const [zoom, setZoom] = useState<ConfigZoom>({});

  useEffect(() => {
    if (config) setZoom(config.zoom ?? {});
  }, [config]);

  const mudar = (tipo: keyof ConfigZoom, chave: keyof ZoomReuniao, valor: string) =>
    setZoom((z) => ({ ...z, [tipo]: { ...z[tipo], [chave]: valor } }));

  const salvar = () =>
    atualizar.mutate(
      { zoom },
      {
        onSuccess: () => toast.show("Zoom atualizado!"),
        onError: (err) => toast.show(err.message || "Erro ao salvar", "error"),
      },
    );

  return (
    <View style={styles.card}>
      {TIPOS.map(({ tipo, rotulo }) => (
        <View key={tipo} style={styles.bloco}>
          <Text style={styles.titulo}>{rotulo}</Text>
          {CAMPOS.map((c) => (
            <View key={c.chave} style={styles.linha}>
              <Text style={styles.rotulo}>{c.rotulo}</Text>
              <TextInput
                value={zoom[tipo]?.[c.chave] ?? ""}
                onChangeText={(v) => mudar(tipo, c.chave, v)}
                placeholder={c.placeholder}
                placeholderTextColor={colors.textMuted}
                keyboardType={c.teclado}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.campo}
              />
            </View>
          ))}
        </View>
      ))}
      <Button
        label="Salvar Zoom"
        icon="checkmark"
        onPress={salvar}
        loading={atualizar.isPending}
        fullWidth
      />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: spacing.lg,
      gap: spacing.lg,
      ...shadow.card,
    },
    bloco: { gap: 8 },
    titulo: { fontSize: 15, fontWeight: "600", color: colors.text },
    linha: { gap: 4 },
    rotulo: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: colors.textMuted,
    },
    campo: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
    },
  });
