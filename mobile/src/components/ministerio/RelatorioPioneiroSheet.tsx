import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useEnviarRelatorioPioneiro } from "@/api/hooks/usePioneiro";
import type { PainelPioneiro } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { Button, Sheet, TextField, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { Contador } from "./escolhas";

/**
 * O relatório do mês, mandado pelo próprio pioneiro: horas cheias (o que sobra de minutos fica
 * dito), os estudos (já com os que estão marcados como estudo) e uma nota. Cai no relatório do
 * grupo; o dirigente não precisa anotar.
 */
export function RelatorioPioneiroSheet({ painel, visible, onClose }: { painel: PainelPioneiro; visible: boolean; onClose: () => void }) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const { celebrar } = useCelebracao();
  const enviar = useEnviarRelatorioPioneiro();
  const [estudos, setEstudos] = useState(0);
  const [auxiliar, setAuxiliar] = useState(false);
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!visible) return;
    setEstudos(painel.relatorio?.estudos ?? painel.estudos);
    setAuxiliar(!!painel.relatorio?.pioneiroAuxiliar);
    setObservacao(painel.relatorio?.observacao ?? "");
  }, [visible, painel]);

  const horas = Math.floor(painel.minutosMes / 60);
  const sobra = painel.minutosMes % 60;
  const mesCurto = painel.nomeMes.split(" de ")[0];
  const pode = painel.regular || auxiliar;

  const mandar = () =>
    enviar.mutate(
      { mes: painel.mes, estudos, pioneiroAuxiliar: !painel.regular && auxiliar, observacao: observacao.trim() || null },
      {
        onSuccess: () => {
          onClose();
          celebrar(`Relatório de ${mesCurto} enviado`);
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para enviar", "error"),
      },
    );

  return (
    <Sheet visible={visible} onClose={onClose} scroll>
      <View style={styles.conteudo}>
        <View>
          <Text style={styles.titulo}>Relatório de {mesCurto}</Text>
          <Text style={styles.sub}>Vai direto para o relatório do seu grupo.</Text>
        </View>
        <View style={styles.horas}>
          <Text style={styles.horasValor}>{horas} h</Text>
          <Text style={styles.horasTexto}>
            {sobra ? `das horas lançadas (sobram ${sobra} min, que não entram no relatório)` : "das horas lançadas no mês"}
          </Text>
        </View>
        <View style={styles.linha}>
          <Text style={[styles.rotulo, styles.flex]}>Estudos bíblicos</Text>
          <Contador valor={estudos} onMudar={setEstudos} max={100} rotulo="estudos" />
        </View>
        {!painel.regular ? (
          <View style={styles.linha}>
            <View style={styles.flex}>
              <Text style={styles.rotulo}>Fui pioneiro auxiliar neste mês</Text>
              <Text style={styles.ajuda}>Sem isso o relatório não vai por aqui</Text>
            </View>
            <Switch value={auxiliar} onValueChange={setAuxiliar} trackColor={{ true: colors.primary, false: colors.border }} />
          </View>
        ) : null}
        <TextField label="Observação (opcional)" value={observacao} onChangeText={setObservacao} maxLength={300} />
        <Button
          label={painel.relatorio ? "Mandar de novo (corrige)" : "Enviar relatório"}
          icon="paper-plane-outline"
          onPress={mandar}
          loading={enviar.isPending}
          disabled={!pode}
          fullWidth
        />
      </View>
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    conteudo: { gap: 16, paddingBottom: 8 },
    titulo: { fontSize: 20, fontWeight: "800", color: colors.text },
    sub: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
    flex: { flex: 1 },
    linha: { flexDirection: "row", alignItems: "center", gap: 12 },
    rotulo: { fontSize: 15, fontWeight: "700", color: colors.text },
    ajuda: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
    horas: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: colors.successBg },
    horasValor: { fontSize: 30, fontWeight: "900", color: colors.greenDark },
    horasTexto: { flex: 1, fontSize: 13.5, color: colors.text, lineHeight: 19 },
  });
