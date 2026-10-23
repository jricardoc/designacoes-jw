import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSalvarViagem } from "@/api/hooks/usePioneiro";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { Button, Sheet, TextField, useToast } from "@/components/ui";
import { type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { isoDoDia, SeletorDia } from "./escolhas";

/** Uma viagem do ministério: o dia, quantos km e (se quiser) o gasto com combustível. */
export function ViagemSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { styles } = useTema(criarEstilos);
  const toast = useToast();
  const { feito } = useCelebracao();
  const salvar = useSalvarViagem();
  const [dia, setDia] = useState(() => isoDoDia(new Date()));
  const [km, setKm] = useState("");
  const [custo, setCusto] = useState("");
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (!visible) return;
    setDia(isoDoDia(new Date()));
    setKm("");
    setCusto("");
    setNota("");
  }, [visible]);

  const confirmar = () =>
    salvar.mutate(
      { data: dia, km, custo: custo.trim() || null, nota: nota.trim() || null },
      {
        onSuccess: (r) => {
          onClose();
          feito({ titulo: "Viagem anotada", detalhe: `${String(r.viagem.km).replace(".", ",")} km`, icone: "car" });
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para salvar", "error"),
      },
    );

  return (
    <Sheet visible={visible} onClose={onClose} scroll>
      <View style={styles.conteudo}>
        <View>
          <Text style={styles.titulo}>Registrar viagem</Text>
          <Text style={styles.sub}>A quilometragem do mês soma sozinha.</Text>
        </View>
        <SeletorDia valor={dia} onMudar={setDia} sentido="passado" quantos={31} />
        <View style={styles.linha}>
          <View style={styles.flex}>
            <TextField label="Distância (km)" value={km} onChangeText={setKm} keyboardType="decimal-pad" maxLength={7} placeholder="12,5" />
          </View>
          <View style={styles.flex}>
            <TextField label="Combustível (R$)" value={custo} onChangeText={setCusto} keyboardType="decimal-pad" maxLength={8} placeholder="opcional" />
          </View>
        </View>
        <TextField label="Nota (opcional)" value={nota} onChangeText={setNota} maxLength={200} placeholder="Para onde, com quem..." />
        <Button label="Salvar viagem" icon="checkmark" onPress={confirmar} loading={salvar.isPending} disabled={!km.trim()} fullWidth />
      </View>
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    conteudo: { gap: 14, paddingBottom: 8 },
    titulo: { fontSize: 20, fontWeight: "800", color: colors.text },
    sub: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
    linha: { flexDirection: "row", gap: 10 },
    flex: { flex: 1 },
  });
