import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSalvarPlano } from "@/api/hooks/usePioneiro";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { Button, Sheet, TextField, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { diaCurto, duracao, isoDoDia, SeletorDia, SeletorHora } from "./escolhas";

const DURACOES = [60, 90, 120, 180, 240];

/** Planejar uma saída: aparece na agenda (e na dos companheiros, se ele compartilha) e no calendário. */
export function PlanoSheet({ visible, onClose, dia: diaInicial }: { visible: boolean; onClose: () => void; dia?: string }) {
  const { styles } = useTema(criarEstilos);
  const toast = useToast();
  const { feito } = useCelebracao();
  const salvar = useSalvarPlano();
  const [dia, setDia] = useState(() => isoDoDia(new Date()));
  const [hora, setHora] = useState("09:00");
  const [duracaoMin, setDuracaoMin] = useState(120);
  const [local, setLocal] = useState("");
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (!visible) return;
    setDia(diaInicial ?? isoDoDia(new Date()));
    setHora("09:00");
    setDuracaoMin(120);
    setLocal("");
    setNota("");
  }, [visible, diaInicial]);

  const confirmar = () =>
    salvar.mutate(
      { data: dia, hora, duracaoMin, local: local.trim() || null, nota: nota.trim() || null },
      {
        onSuccess: () => {
          onClose();
          feito({ titulo: "Saída planejada", detalhe: `${diaCurto(dia)} às ${hora}`, icone: "calendar" });
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para salvar", "error"),
      },
    );

  return (
    <Sheet visible={visible} onClose={onClose} scroll>
      <View style={styles.conteudo}>
        <View>
          <Text style={styles.titulo}>Planejar saída</Text>
          <Text style={styles.sub}>Os pioneiros que saem com você veem na agenda deles.</Text>
        </View>
        <View style={styles.bloco}>
          <Text style={styles.rotulo}>Quando</Text>
          <SeletorDia valor={dia} onMudar={setDia} sentido="futuro" quantos={45} />
          <SeletorHora valor={hora} onMudar={setHora} />
        </View>
        <View style={styles.bloco}>
          <Text style={styles.rotulo}>Quanto tempo</Text>
          <View style={styles.chips}>
            {DURACOES.map((d) => {
              const ativo = d === duracaoMin;
              return (
                <Pressable
                  key={d}
                  style={[styles.chip, ativo && styles.chipAtivo]}
                  onPress={() => setDuracaoMin(d)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ativo }}
                >
                  <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{duracao(d)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <TextField label="Onde (opcional)" value={local} onChangeText={setLocal} maxLength={120} placeholder="Território, praça, carrinho..." />
        <TextField label="Nota (opcional)" value={nota} onChangeText={setNota} maxLength={300} multiline placeholder="Com quem, o que levar..." />
        <Button label="Salvar plano" icon="checkmark" onPress={confirmar} loading={salvar.isPending} fullWidth />
      </View>
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    conteudo: { gap: 14, paddingBottom: 8 },
    titulo: { fontSize: 20, fontWeight: "800", color: colors.text },
    sub: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
    bloco: { gap: 8 },
    rotulo: { fontSize: 15, fontWeight: "700", color: colors.text },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipTexto: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
    chipTextoAtivo: { color: colors.textOnPrimary },
  });
