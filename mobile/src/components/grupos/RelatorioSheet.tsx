import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useApagarRelatorio, useSalvarRelatorio } from "@/api/hooks/useGrupos";
import type { MembroGrupo } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { Button, Sheet, TextField, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

interface Props {
  membro: MembroGrupo | null;
  mes: string;
  nomeMes: string;
  /** "Grupo de Paulo": vai na comemoração quando este relatório fecha o grupo. */
  rotuloGrupo: string;
  /** Anotar este fecha o grupo (era o último que faltava). */
  fechaOGrupo: boolean;
  onClose: () => void;
}

/**
 * O relatório de um irmão no mês, anotado pelo dirigente. Publicador: participou ou não, e os
 * estudos. Pioneiro (regular pelo cadastro, ou auxiliar marcado aqui): horas e estudos.
 */
export function RelatorioSheet({ membro: aberto, mes, nomeMes, rotuloGrupo, fechaOGrupo, onClose }: Props) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const { celebrar, feito } = useCelebracao();
  const salvar = useSalvarRelatorio();
  const apagar = useApagarRelatorio();

  const [auxiliar, setAuxiliar] = useState(false);
  const [participou, setParticipou] = useState<boolean | null>(null);
  const [horas, setHoras] = useState("");
  const [estudos, setEstudos] = useState(0);
  const [observacao, setObservacao] = useState("");

  // Fecha mostrando quem estava aberto: sem isto a folha esvaziaria antes de descer.
  const [ultimo, setUltimo] = useState(aberto);
  useEffect(() => {
    if (aberto) setUltimo(aberto);
  }, [aberto]);
  const membro = aberto ?? ultimo;

  // Cada irmão aberto começa do que já foi anotado para ele (ou do zero).
  useEffect(() => {
    const r = membro?.relatorio;
    setAuxiliar(!!r?.pioneiroAuxiliar);
    setParticipou(r ? r.participou : null);
    setHoras(r?.horas != null ? String(r.horas) : "");
    setEstudos(r?.estudos ?? 0);
    setObservacao(r?.observacao ?? "");
  }, [membro?.id, membro?.relatorio]);

  if (!membro) return null;

  const regular = membro.pioneiro === "regular";
  const pioneiro = regular || auxiliar;
  const horasNum = Number(horas.replace(",", "."));
  const valido = pioneiro ? horas.trim() !== "" && horasNum >= 0 && horasNum <= 400 : participou !== null;
  const comEstudos = pioneiro || participou === true;
  const primeiro = membro.nome.split(/\s+/)[0];

  const anotar = () =>
    salvar.mutate(
      {
        irmaoId: membro.id,
        mes,
        participou: pioneiro ? horasNum > 0 : participou === true,
        estudos: comEstudos ? estudos : 0,
        horas: pioneiro ? Math.round(horasNum) : null,
        pioneiroAuxiliar: !regular && auxiliar,
        observacao: observacao.trim() || null,
      },
      {
        onSuccess: () => {
          onClose();
          if (fechaOGrupo && !membro.relatorio) celebrar(`${rotuloGrupo} concluiu o relatório`);
          else feito({ titulo: membro.relatorio ? "Relatório corrigido" : "Relatório anotado", detalhe: primeiro, icone: "document-text" });
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para salvar", "error"),
      },
    );

  const desfazer = () => {
    const id = membro.relatorio?.id;
    if (!id) return;
    Alert.alert("Apagar este relatório?", `O relatório de ${primeiro} volta a ficar pendente.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: () =>
          apagar.mutate(id, {
            onSuccess: () => {
              onClose();
              feito({ titulo: "Relatório apagado", detalhe: primeiro, icone: "trash-outline", cor: colors.textSecondary });
            },
            onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para apagar", "error"),
          }),
      },
    ]);
  };

  const pedir = async () => {
    if (!membro.whatsapp) return;
    try {
      await Linking.openURL(membro.whatsapp);
    } catch {
      toast.show("Não consegui abrir o WhatsApp", "error");
    }
  };

  return (
    <Sheet visible={!!aberto} onClose={onClose} scroll>
      <View style={styles.conteudo}>
        <View>
          <Text style={styles.nome}>{membro.nome}</Text>
          <Text style={styles.sub}>
            Relatório de {nomeMes}
            {regular ? " · Pioneiro regular" : ""}
          </Text>
        </View>

        {!regular ? (
          <View style={styles.linha}>
            <View style={styles.flex}>
              <Text style={styles.rotulo}>Pioneiro auxiliar neste mês</Text>
              <Text style={styles.ajuda}>Aí ele relata as horas</Text>
            </View>
            <Switch
              value={auxiliar}
              onValueChange={setAuxiliar}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel="Pioneiro auxiliar neste mês"
            />
          </View>
        ) : null}

        {pioneiro ? (
          <TextField
            label="Horas no mês"
            icon="time-outline"
            keyboardType="number-pad"
            value={horas}
            onChangeText={(t) => setHoras(t.replace(/[^\d]/g, "").slice(0, 3))}
            placeholder="0"
          />
        ) : (
          <View style={styles.bloco}>
            <Text style={styles.rotulo}>Participou no ministério?</Text>
            <View style={styles.opcoes}>
              {[
                { valor: true, rotulo: "Sim", icone: "checkmark" as const },
                { valor: false, rotulo: "Não", icone: "close" as const },
              ].map((o) => {
                const ativo = participou === o.valor;
                return (
                  <Pressable
                    key={o.rotulo}
                    style={[styles.opcao, ativo && styles.opcaoAtiva]}
                    onPress={() => setParticipou(o.valor)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: ativo }}
                  >
                    <Ionicons name={o.icone} size={16} color={ativo ? colors.textOnPrimary : colors.textSecondary} />
                    <Text style={[styles.opcaoTexto, ativo && styles.opcaoTextoAtivo]}>{o.rotulo}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {comEstudos ? (
          <View style={styles.linha}>
            <Text style={[styles.rotulo, styles.flex]}>Estudos bíblicos</Text>
            <Pressable
              style={[styles.passo, estudos === 0 && { opacity: 0.35 }]}
              onPress={() => setEstudos((n) => Math.max(0, n - 1))}
              disabled={estudos === 0}
              hitSlop={6}
              accessibilityLabel="Menos um estudo"
            >
              <Ionicons name="remove" size={18} color={colors.primaryDark} />
            </Pressable>
            <Text style={styles.contagem}>{estudos}</Text>
            <Pressable style={styles.passo} onPress={() => setEstudos((n) => Math.min(100, n + 1))} hitSlop={6} accessibilityLabel="Mais um estudo">
              <Ionicons name="add" size={18} color={colors.primaryDark} />
            </Pressable>
          </View>
        ) : null}

        <TextField
          label="Observação (opcional)"
          value={observacao}
          onChangeText={setObservacao}
          maxLength={300}
          placeholder="Ex.: relatório entregue pela esposa"
        />

        <Button
          label={membro.relatorio ? "Salvar alteração" : "Anotar relatório"}
          icon="checkmark"
          onPress={anotar}
          loading={salvar.isPending}
          disabled={!valido}
          fullWidth
        />
        {!membro.relatorio && membro.whatsapp ? (
          <Button label={`Pedir para ${primeiro} no WhatsApp`} icon="logo-whatsapp" variant="secondary" onPress={pedir} fullWidth />
        ) : null}
        {membro.relatorio ? (
          <Button label="Apagar este relatório" icon="trash-outline" variant="ghost" onPress={desfazer} loading={apagar.isPending} fullWidth />
        ) : null}
      </View>
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    conteudo: { gap: 16, paddingBottom: 8 },
    flex: { flex: 1 },
    nome: { fontSize: 20, fontWeight: "800", color: colors.text },
    sub: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
    linha: { flexDirection: "row", alignItems: "center", gap: 12 },
    bloco: { gap: 8 },
    rotulo: { fontSize: 15, fontWeight: "700", color: colors.text },
    ajuda: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
    opcoes: { flexDirection: "row", gap: 10 },
    opcao: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    opcaoAtiva: { backgroundColor: colors.primary, borderColor: colors.primary },
    opcaoTexto: { fontSize: 15, fontWeight: "700", color: colors.textSecondary },
    opcaoTextoAtivo: { color: colors.textOnPrimary },
    passo: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    contagem: { minWidth: 28, textAlign: "center", fontSize: 20, fontWeight: "900", color: colors.text },
  });
