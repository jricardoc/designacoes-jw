import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useRegistrarVisita } from "@/api/hooks/usePioneiro";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { Button, Sheet, TextField, useToast } from "@/components/ui";
import { type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { dataHoraISO, isoDoDia, SeletorDia, SeletorHora } from "./escolhas";

/** A visita feita agora (com uma nota) e, se quiser, a próxima já marcada. */
export function VisitaSheet({ revisitaId, nome, onClose }: { revisitaId: number | null; nome: string; onClose: () => void }) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const { feito } = useCelebracao();
  const registrar = useRegistrarVisita();
  const [observacao, setObservacao] = useState("");
  const [marcar, setMarcar] = useState(true);
  const [dia, setDia] = useState(() => isoDoDia(new Date(Date.now() + 7 * 86400000)));
  const [hora, setHora] = useState("15:00");

  useEffect(() => {
    if (!revisitaId) return;
    setObservacao("");
    setMarcar(true);
    // A próxima, por padrão, uma semana depois, na mesma hora de agora (arredondada).
    const daqui = new Date(Date.now() + 7 * 86400000);
    setDia(isoDoDia(daqui));
    setHora(`${String(Math.min(21, Math.max(6, daqui.getHours()))).padStart(2, "0")}:00`);
  }, [revisitaId]);

  const salvar = () => {
    if (!revisitaId) return;
    registrar.mutate(
      { id: revisitaId, observacao: observacao.trim() || null, proximaVisita: marcar ? dataHoraISO(dia, hora) : null },
      {
        onSuccess: () => {
          onClose();
          feito({ titulo: "Visita registrada", detalhe: nome, icone: "checkmark-done" });
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para registrar", "error"),
      },
    );
  };

  return (
    <Sheet visible={!!revisitaId} onClose={onClose} scroll>
      <View style={styles.conteudo}>
        <View>
          <Text style={styles.titulo}>Visita de agora</Text>
          <Text style={styles.sub}>{nome}</Text>
        </View>
        <TextField label="Como foi (opcional)" value={observacao} onChangeText={setObservacao} maxLength={1000} multiline placeholder="O que conversaram, o que ficou para a próxima..." />
        <View style={styles.linha}>
          <Text style={[styles.rotulo, styles.flex]}>Marcar a próxima visita</Text>
          <Switch value={marcar} onValueChange={setMarcar} trackColor={{ true: colors.primary, false: colors.border }} />
        </View>
        {marcar ? (
          <View style={styles.bloco}>
            <SeletorDia valor={dia} onMudar={setDia} sentido="futuro" quantos={30} />
            <SeletorHora valor={hora} onMudar={setHora} />
          </View>
        ) : null}
        <Button label="Registrar visita" icon="checkmark" onPress={salvar} loading={registrar.isPending} fullWidth />
      </View>
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    conteudo: { gap: 14, paddingBottom: 8 },
    titulo: { fontSize: 20, fontWeight: "800", color: colors.text },
    sub: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
    flex: { flex: 1 },
    bloco: { gap: 8 },
    linha: { flexDirection: "row", alignItems: "center", gap: 12 },
    rotulo: { fontSize: 15, fontWeight: "700", color: colors.text },
  });
