import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLancarHoras } from "@/api/hooks/usePioneiro";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { Button, Sheet, TextField, useToast } from "@/components/ui";
import { type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { Contador, diaCurto, duracao, isoDoDia, SeletorDia } from "./escolhas";

/** Lançar horas à mão: o dia (até 3 semanas para trás), horas e minutos, e uma nota. */
export function HorasSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { styles } = useTema(criarEstilos);
  const toast = useToast();
  const { feito } = useCelebracao();
  const lancar = useLancarHoras();
  const [dia, setDia] = useState(() => isoDoDia(new Date()));
  const [horas, setHoras] = useState(1);
  const [minutos, setMinutos] = useState(0);
  const [observacao, setObservacao] = useState("");

  // Cada abertura começa de hoje e de 1 hora.
  useEffect(() => {
    if (!visible) return;
    setDia(isoDoDia(new Date()));
    setHoras(1);
    setMinutos(0);
    setObservacao("");
  }, [visible]);

  const total = horas * 60 + minutos;
  const salvar = () =>
    lancar.mutate(
      { data: dia, minutos: total, observacao: observacao.trim() || null },
      {
        onSuccess: () => {
          onClose();
          feito({ titulo: "Horas lançadas", detalhe: `${duracao(total)} em ${diaCurto(dia)}`, icone: "time" });
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para lançar", "error"),
      },
    );

  return (
    <Sheet visible={visible} onClose={onClose} scroll>
      <View style={styles.conteudo}>
        <Text style={styles.titulo}>Lançar horas</Text>
        <View style={styles.bloco}>
          <Text style={styles.rotulo}>Dia</Text>
          <SeletorDia valor={dia} onMudar={setDia} sentido="passado" />
        </View>
        <View style={styles.linha}>
          <View style={styles.bloco}>
            <Text style={styles.rotulo}>Horas</Text>
            <Contador valor={horas} onMudar={setHoras} max={12} rotulo="horas" />
          </View>
          <View style={styles.bloco}>
            <Text style={styles.rotulo}>Minutos</Text>
            <Contador valor={minutos} onMudar={setMinutos} max={55} passo={5} rotulo="minutos" />
          </View>
        </View>
        <TextField label="Observação (opcional)" value={observacao} onChangeText={setObservacao} maxLength={200} placeholder="Ex.: carrinho, cartas" />
        <Button label={total ? `Lançar ${duracao(total)}` : "Escolha o tempo"} icon="checkmark" onPress={salvar} loading={lancar.isPending} disabled={!total} fullWidth />
      </View>
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    conteudo: { gap: 16, paddingBottom: 8 },
    titulo: { fontSize: 20, fontWeight: "800", color: colors.text },
    bloco: { gap: 8 },
    linha: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
    rotulo: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
  });
