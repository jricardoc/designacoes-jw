import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSalvarRevisita } from "@/api/hooks/usePioneiro";
import type { RevisitaDetalhe } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { Button, Sheet, TextField, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { minhaLocalizacao } from "@/territorios/gps";
import { dataHoraISO, doisDig, isoDoDia, SeletorDia, SeletorHora } from "./escolhas";

/** "Rua A, 10 - Itapuã" a partir da posição (o que o aparelho souber). */
async function enderecoDaPosicao(lat: number, lng: number) {
  try {
    const [r] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!r) return null;
    const rua = [r.street, r.streetNumber].filter(Boolean).join(", ");
    return [rua || r.name, r.district].filter(Boolean).join(" - ") || null;
  } catch {
    return null;
  }
}

/** Nova revisita ou edição: nome, endereço (com a posição pelo GPS), telefone, estudo e a próxima visita. */
export function RevisitaSheet({ visible, onClose, revisita }: { visible: boolean; onClose: () => void; revisita?: RevisitaDetalhe | null }) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const { feito } = useCelebracao();
  const salvar = useSalvarRevisita();
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacao, setObservacao] = useState("");
  const [estudo, setEstudo] = useState(false);
  const [posicao, setPosicao] = useState<{ lat: number; lng: number } | null>(null);
  const [marcar, setMarcar] = useState(false);
  const [dia, setDia] = useState(() => isoDoDia(new Date()));
  const [hora, setHora] = useState("15:00");
  const [localizando, setLocalizando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setNome(revisita?.nome ?? "");
    setEndereco(revisita?.endereco ?? "");
    setTelefone(revisita?.telefone ?? "");
    setObservacao(revisita?.observacao ?? "");
    setEstudo(!!revisita?.estudo);
    setPosicao(revisita?.lat != null && revisita?.lng != null ? { lat: revisita.lat, lng: revisita.lng } : null);
    const proxima = revisita?.proximaVisita ? new Date(revisita.proximaVisita) : null;
    setMarcar(!!proxima);
    setDia(isoDoDia(proxima ?? new Date()));
    setHora(proxima ? `${doisDig(proxima.getHours())}:${proxima.getMinutes() < 30 ? "00" : "30"}` : "15:00");
  }, [visible, revisita]);

  const usarLocalizacao = async () => {
    setLocalizando(true);
    try {
      const { lat, lng } = await minhaLocalizacao();
      setPosicao({ lat, lng });
      if (!endereco.trim()) {
        const achado = await enderecoDaPosicao(lat, lng);
        if (achado) setEndereco(achado);
      }
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Não consegui achar sua localização", "error");
    } finally {
      setLocalizando(false);
    }
  };

  const confirmar = () =>
    salvar.mutate(
      {
        id: revisita?.id,
        nome: nome.trim(),
        endereco: endereco.trim() || null,
        telefone: telefone.trim() || null,
        observacao: observacao.trim() || null,
        estudo,
        lat: posicao?.lat ?? null,
        lng: posicao?.lng ?? null,
        proximaVisita: marcar ? dataHoraISO(dia, hora) : null,
      },
      {
        onSuccess: () => {
          onClose();
          feito({ titulo: revisita ? "Revisita atualizada" : "Revisita anotada", detalhe: nome.trim(), icone: estudo ? "book" : "person-add" });
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para salvar", "error"),
      },
    );

  return (
    <Sheet visible={visible} onClose={onClose} scroll>
      <View style={styles.conteudo}>
        <Text style={styles.titulo}>{revisita ? "Editar revisita" : "Nova revisita"}</Text>
        <TextField label="Nome" value={nome} onChangeText={setNome} maxLength={80} placeholder="Como você chama a pessoa" />
        <TextField label="Endereço" value={endereco} onChangeText={setEndereco} maxLength={200} placeholder="Rua, número, ponto de referência" />
        <Pressable style={styles.local} onPress={usarLocalizacao} disabled={localizando} accessibilityRole="button">
          <Ionicons name={posicao ? "location" : "locate-outline"} size={18} color={posicao ? colors.greenDark : colors.primaryDark} />
          <Text style={[styles.localTexto, posicao && { color: colors.greenDark }]}>
            {localizando ? "Procurando sua localização..." : posicao ? "Posição marcada no mapa (tocar atualiza)" : "Usar minha localização (aparece no mapa)"}
          </Text>
          {posicao && !localizando ? (
            <Pressable onPress={() => setPosicao(null)} hitSlop={8} accessibilityLabel="Tirar a posição">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </Pressable>
        <TextField label="Telefone (opcional)" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" maxLength={30} />
        <View style={styles.linha}>
          <View style={styles.flex}>
            <Text style={styles.rotulo}>Estudo bíblico</Text>
            <Text style={styles.ajuda}>Conta nos estudos do relatório</Text>
          </View>
          <Switch value={estudo} onValueChange={setEstudo} trackColor={{ true: colors.primary, false: colors.border }} />
        </View>
        <View style={styles.linha}>
          <View style={styles.flex}>
            <Text style={styles.rotulo}>Marcar a próxima visita</Text>
            <Text style={styles.ajuda}>O app avisa 1 hora antes</Text>
          </View>
          <Switch value={marcar} onValueChange={setMarcar} trackColor={{ true: colors.primary, false: colors.border }} />
        </View>
        {marcar ? (
          <View style={styles.bloco}>
            <SeletorDia valor={dia} onMudar={setDia} sentido="futuro" />
            <SeletorHora valor={hora} onMudar={setHora} />
          </View>
        ) : null}
        <TextField label="Observações (opcional)" value={observacao} onChangeText={setObservacao} maxLength={1000} multiline placeholder="Assunto da conversa, publicação deixada..." />
        <Button label={revisita ? "Salvar" : "Anotar revisita"} icon="checkmark" onPress={confirmar} loading={salvar.isPending} disabled={!nome.trim()} fullWidth />
      </View>
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    conteudo: { gap: 14, paddingBottom: 8 },
    titulo: { fontSize: 20, fontWeight: "800", color: colors.text },
    flex: { flex: 1 },
    bloco: { gap: 8 },
    linha: { flexDirection: "row", alignItems: "center", gap: 12 },
    rotulo: { fontSize: 15, fontWeight: "700", color: colors.text },
    ajuda: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
    local: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.borderStrong,
    },
    localTexto: { flex: 1, fontSize: 13.5, fontWeight: "700", color: colors.primaryDark },
  });
