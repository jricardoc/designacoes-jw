import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useEnviarMeuRelatorio, useMeuRelatorio } from "@/api/hooks/useGrupos";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { irParaAmbiente } from "@/components/layout/Ambientes";
import { Contador } from "@/components/ministerio/escolhas";
import { mesAtual } from "@/components/ministerio/kit";
import { Button, Loading, Sheet, TextField, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { MESES, radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { somarMeses } from "@/utils/assistenciaMensal";

/** Até o dia 15 o relatório é o do mês que passou; depois, o deste mês. */
const mesPadrao = () => (new Date().getDate() <= 15 ? somarMeses(mesAtual(), -1) : mesAtual());
const nomeDo = (mes: string) => MESES[Number(mes.slice(5))];

/**
 * "Registrar o campo", do "+" do Servir Mais: o publicador manda o próprio relatório do mês e
 * ele cai no relatório do grupo (o dirigente não precisa anotar). O pioneiro regular manda pelo
 * Ministério, com as horas lançadas: aqui ele ganha o atalho para lá.
 */
export function RegistrarCampoSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const { celebrar } = useCelebracao();
  const { usuario } = useAuth();
  const ligado = !!usuario?.irmaoId;
  const regular = usuario?.irmao?.pioneiro === "regular";
  const [mes, setMes] = useState(mesPadrao);
  const { data, isLoading } = useMeuRelatorio(mes, visible && ligado && !regular);
  const enviar = useEnviarMeuRelatorio();
  const [participou, setParticipou] = useState(true);
  const [estudos, setEstudos] = useState(0);
  const [auxiliar, setAuxiliar] = useState(false);
  const [horas, setHoras] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (visible) setMes(mesPadrao());
  }, [visible]);

  // Abre com o que ele já mandou no mês (ou em branco, contando que participou).
  useEffect(() => {
    if (!visible || !data) return;
    const r = data.relatorio;
    setParticipou(r ? r.participou : true);
    setEstudos(r?.estudos ?? 0);
    setAuxiliar(!!r?.pioneiroAuxiliar);
    setHoras(r?.horas != null ? String(r.horas) : "");
    setObservacao(r?.observacao ?? "");
  }, [visible, data]);

  const nome = nomeDo(mes);
  const comHoras = participou && auxiliar;

  const mandar = () =>
    enviar.mutate(
      {
        mes,
        participou,
        estudos: participou ? estudos : 0,
        pioneiroAuxiliar: comHoras,
        horas: comHoras ? Number(horas.replace(",", ".")) : null,
        observacao: observacao.trim() || null,
      },
      {
        onSuccess: () => {
          onClose();
          celebrar(`Relatório de ${nome.toLowerCase()} enviado`);
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para enviar", "error"),
      },
    );

  const abrirMinisterio = () => {
    onClose();
    // No iPhone, navegar com a folha ainda fechando atrapalha a animação.
    setTimeout(() => irParaAmbiente("ministerio"), Platform.OS === "ios" ? 400 : 0);
  };

  const corpo = () => {
    if (!ligado) return <Text style={styles.aviso}>Sua conta ainda não está ligada ao seu cadastro. Fale com o secretário.</Text>;
    if (regular) {
      return (
        <>
          <Text style={styles.aviso}>Pioneiro regular manda o relatório pelo Ministério, que já soma as horas lançadas.</Text>
          <Button label="Abrir o Ministério" icon="arrow-forward" onPress={abrirMinisterio} fullWidth />
        </>
      );
    }
    if (isLoading) return <Loading label="Carregando..." />;
    return (
      <>
        <View style={styles.linha}>
          <Text style={[styles.rotulo, styles.flex]}>Participei no ministério</Text>
          <Switch value={participou} onValueChange={setParticipou} trackColor={{ true: colors.primary, false: colors.border }} />
        </View>
        {participou ? (
          <>
            <View style={styles.linha}>
              <Text style={[styles.rotulo, styles.flex]}>Estudos bíblicos</Text>
              <Contador valor={estudos} onMudar={setEstudos} max={100} rotulo="estudos" />
            </View>
            <View style={styles.linha}>
              <Text style={[styles.rotulo, styles.flex]}>Fui pioneiro auxiliar</Text>
              <Switch value={auxiliar} onValueChange={setAuxiliar} trackColor={{ true: colors.primary, false: colors.border }} />
            </View>
            {auxiliar ? (
              <TextField label="Horas no mês" value={horas} onChangeText={setHoras} keyboardType="number-pad" maxLength={3} placeholder="30" />
            ) : null}
          </>
        ) : null}
        <TextField label="Observação (opcional)" value={observacao} onChangeText={setObservacao} maxLength={300} />
        <Button
          label={data?.relatorio ? "Mandar de novo (corrige)" : "Enviar relatório"}
          icon="paper-plane-outline"
          onPress={mandar}
          loading={enviar.isPending}
          disabled={comHoras && !horas.trim()}
          fullWidth
        />
      </>
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} scroll>
      <View style={styles.conteudo}>
        <View>
          <Text style={styles.titulo}>Registrar o campo</Text>
          <Text style={styles.sub}>Seu relatório vai direto para o relatório do seu grupo.</Text>
        </View>
        {ligado && !regular ? (
          <View style={styles.meses}>
            {[somarMeses(mesAtual(), -1), mesAtual()].map((m) => {
              const ativo = m === mes;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMes(m)}
                  style={[styles.mes, ativo && styles.mesAtivo]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ativo }}
                >
                  <Text style={[styles.mesTexto, ativo && styles.mesTextoAtivo]}>{nomeDo(m)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {corpo()}
      </View>
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    conteudo: { gap: 14, paddingBottom: 8 },
    titulo: { fontSize: 20, fontWeight: "800", color: colors.text },
    sub: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
    aviso: { fontSize: 15, color: colors.textSecondary, lineHeight: 21 },
    meses: { flexDirection: "row", gap: 8 },
    mes: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    mesAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    mesTexto: { fontSize: 15, fontWeight: "700", color: colors.textSecondary },
    mesTextoAtivo: { color: colors.textOnPrimary },
    linha: { flexDirection: "row", alignItems: "center", gap: 12 },
    rotulo: { fontSize: 15, fontWeight: "700", color: colors.text },
    flex: { flex: 1 },
  });
