import { Ionicons } from "@expo/vector-icons";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useApagarSaida, useRetirarMarcacao } from "@/api/hooks/useTerritorios";
import type { TerritorioDetalhe } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { Button, Sheet, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { radius, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { abrirComoChegar, MARCACOES, quandoFoi } from "@/territorios/constantes";
import { descartar, useFilaTerritorios } from "@/territorios/fila";

/**
 * O que é o pino tocado no mapa, e o "remover" para quem marcou errado.
 *
 * `chave` segue a do mapa: "m-<id>" é marcação do servidor, "s-<id>" é o ponto de uma saída
 * ("onde paramos") e "f-<clientKey>" é o que ainda está na fila do celular. Remover segue a
 * regra do servidor: quem marcou, ou quem cuida dos territórios.
 */
export function PinoSheet({
  chave,
  territorio: t,
  onClose,
}: {
  chave: string | null;
  territorio: TerritorioDetalhe;
  onClose: () => void;
}) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const { feito } = useCelebracao();
  const { usuario } = useAuth();
  const { itens } = useFilaTerritorios();
  const retirar = useRetirarMarcacao();
  const apagarSaida = useApagarSaida();

  const [tipoChave, id] = chave ? [chave.slice(0, 1), chave.slice(2)] : ["", ""];
  const marcacao = tipoChave === "m" ? t.marcacoes.find((m) => String(m.id) === id) : undefined;
  const saida = tipoChave === "s" ? t.ondeParamos.find((s) => String(s.id) === id) : undefined;
  const naFila = tipoChave === "f" ? itens.find((i) => i.clientKey === id) : undefined;

  const tipo = marcacao?.tipo ?? (saida ? "parada" : (naFila?.corpo.tipo as keyof typeof MARCACOES | undefined));
  if (!chave || !tipo || !MARCACOES[tipo]) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;

  const info = MARCACOES[tipo];
  const autor = marcacao?.autor ?? saida?.autor ?? null;
  const podeRemover = !!naFila || t.permissoes.gerenciar || (!!autor && autor.id === usuario?.id);
  const texto = marcacao?.texto ?? saida?.ondeParou ?? (naFila?.corpo.texto as string | null | undefined) ?? null;
  const lat = marcacao?.lat ?? saida?.lat ?? (naFila?.corpo.lat as number | undefined) ?? null;
  const lng = marcacao?.lng ?? saida?.lng ?? (naFila?.corpo.lng as number | undefined) ?? null;
  const quando = marcacao
    ? new Date(marcacao.marcadaEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : saida
      ? quandoFoi(saida.dia)
      : "ainda no celular, esperando internet";

  const remover = () => {
    if (naFila) {
      descartar(naFila.clientKey);
      feito({ titulo: "Marcação cancelada", icone: "close", cor: colors.textSecondary });
      onClose();
      return;
    }
    Alert.alert(
      saida ? "Apagar este registro de saída?" : "Remover esta marcação?",
      saida ? "O \"onde paramos\" volta a ser o registro anterior." : "Ela sai do mapa para todos. O histórico guarda que existiu.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: saida ? "Apagar" : "Remover",
          style: "destructive",
          onPress: () => {
            const opcoes = {
              onSuccess: () => {
                feito({ titulo: saida ? "Registro apagado" : "Marcação removida", icone: "trash-outline", cor: colors.textSecondary });
                onClose();
              },
              onError: (e: Error) => toast.show(e.message, "error"),
            };
            if (saida) apagarSaida.mutate(saida.id, opcoes);
            else if (marcacao) retirar.mutate(marcacao.id, opcoes);
          },
        },
      ],
    );
  };

  return (
    <Sheet visible={!!chave} onClose={onClose}>
      <View style={styles.corpo}>
        <View style={styles.topo}>
          <View style={[styles.bolinha, { backgroundColor: info.cor(colors) }]}>
            <Text style={styles.letra}>{info.letra}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.titulo}>{saida ? "Onde paramos" : info.rotulo}</Text>
            <Text style={styles.sub}>
              {autor ? `${autor.nome} · ` : ""}
              {quando}
            </Text>
          </View>
        </View>
        {texto ? <Text style={styles.texto}>{texto}</Text> : null}
        {naFila ? (
          <View style={styles.aviso}>
            <Ionicons name="cloud-upload-outline" size={16} color={colors.amber} />
            <Text style={styles.avisoTexto}>Ainda não chegou ao servidor: só você está vendo.</Text>
          </View>
        ) : null}
        {lat !== null && lng !== null ? (
          <Button
            label="Como chegar aqui"
            icon="navigate"
            variant="secondary"
            onPress={() => abrirComoChegar(lat, lng)}
            fullWidth
          />
        ) : null}
        {podeRemover ? (
          <Button
            label={naFila ? "Cancelar esta marcação" : saida ? "Apagar registro de saída" : "Remover marcação"}
            icon="trash-outline"
            variant="danger"
            onPress={remover}
            loading={retirar.isPending || apagarSaida.isPending}
            fullWidth
          />
        ) : (
          <Text style={styles.sub}>Só quem marcou ou quem cuida dos territórios pode remover.</Text>
        )}
      </View>
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    corpo: { gap: spacing.md, paddingBottom: spacing.sm },
    topo: { flexDirection: "row", alignItems: "center", gap: 12 },
    flex: { flex: 1 },
    bolinha: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    letra: { color: "#fff", fontWeight: "900", fontSize: 19 },
    titulo: { fontSize: 19, fontWeight: "800", color: colors.text },
    sub: { fontSize: 13, color: colors.textSecondary },
    texto: { fontSize: 16, color: colors.text, lineHeight: 22 },
    aviso: { flexDirection: "row", gap: 8, alignItems: "center", padding: 10, borderRadius: radius.md, backgroundColor: colors.warningBg },
    avisoTexto: { flex: 1, fontSize: 13, color: colors.text },
  });
