import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useRegistrarVisita } from "@/api/hooks/usePioneiro";
import type { TipoVisita } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { Button, Sheet, TextField, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { dataHoraISO, doisDig, isoDoDia, SeletorDia, SeletorHora } from "./escolhas";
import { TIPO_VISITA } from "./kit";

const TIPOS: TipoVisita[] = ["conversa", "estudo", "nao_em_casa"];

/**
 * A próxima tentativa, por padrão: "não em casa" volta em 2 dias; conversa e estudo, em uma
 * semana. Na mesma hora de agora (arredondada), dentro do horário dos chips.
 */
function proximaPadrao(tipo: TipoVisita) {
  const daqui = new Date(Date.now() + (tipo === "nao_em_casa" ? 2 : 7) * 86400000);
  return { dia: isoDoDia(daqui), hora: `${doisDig(Math.min(21, Math.max(6, daqui.getHours())))}:00` };
}

/** A visita de agora (conversa, estudo ou "não em casa", com uma nota) e a próxima já marcada. */
export function VisitaSheet({
  revisitaId,
  nome,
  tipo: tipoInicial = "conversa",
  onClose,
}: {
  revisitaId: number | null;
  nome: string;
  tipo?: TipoVisita;
  onClose: () => void;
}) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const { feito } = useCelebracao();
  const registrar = useRegistrarVisita();
  const [tipo, setTipo] = useState<TipoVisita>(tipoInicial);
  const [observacao, setObservacao] = useState("");
  const [marcar, setMarcar] = useState(true);
  const [dia, setDia] = useState(() => isoDoDia(new Date(Date.now() + 7 * 86400000)));
  const [hora, setHora] = useState("15:00");

  const proximaPara = (t: TipoVisita) => {
    const p = proximaPadrao(t);
    setDia(p.dia);
    setHora(p.hora);
  };

  useEffect(() => {
    if (!revisitaId) return;
    setTipo(tipoInicial);
    setObservacao("");
    setMarcar(true);
    const p = proximaPadrao(tipoInicial);
    setDia(p.dia);
    setHora(p.hora);
  }, [revisitaId, tipoInicial]);

  const escolherTipo = (t: TipoVisita) => {
    setTipo(t);
    proximaPara(t);
  };

  const salvar = () => {
    if (!revisitaId) return;
    registrar.mutate(
      { id: revisitaId, tipo, observacao: observacao.trim() || null, proximaVisita: marcar ? dataHoraISO(dia, hora) : null },
      {
        onSuccess: () => {
          onClose();
          feito({
            titulo: tipo === "nao_em_casa" ? "Anotado: não estava" : "Visita registrada",
            detalhe: nome,
            icone: tipo === "nao_em_casa" ? "home" : "checkmark-done",
          });
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para registrar", "error"),
      },
    );
  };

  return (
    <Sheet visible={!!revisitaId} onClose={onClose} scroll>
      <View style={styles.conteudo}>
        <View>
          <Text style={styles.titulo}>Registrar a visita</Text>
          <Text style={styles.sub}>{nome}</Text>
        </View>
        <View style={styles.tipos} accessibilityRole="radiogroup">
          {TIPOS.map((t) => {
            const ativo = t === tipo;
            const cor = TIPO_VISITA[t].cor(colors);
            return (
              <Pressable
                key={t}
                onPress={() => escolherTipo(t)}
                style={[styles.tipo, ativo && { borderColor: cor, backgroundColor: `${cor}1A` }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: ativo }}
              >
                <Ionicons name={TIPO_VISITA[t].icone} size={20} color={ativo ? cor : colors.textSecondary} />
                <Text style={[styles.tipoTexto, ativo && { color: cor }]}>{TIPO_VISITA[t].rotulo}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextField
          label={tipo === "nao_em_casa" ? "Nota (opcional)" : "Como foi (opcional)"}
          value={observacao}
          onChangeText={setObservacao}
          maxLength={1000}
          multiline
          placeholder={tipo === "nao_em_casa" ? "Deixei um folheto, voltar à tarde..." : "O que conversaram, o que ficou para a próxima..."}
        />
        <View style={styles.linha}>
          <Text style={[styles.rotulo, styles.flex]}>{tipo === "nao_em_casa" ? "Tentar de novo" : "Marcar a próxima visita"}</Text>
          <Switch value={marcar} onValueChange={setMarcar} trackColor={{ true: colors.primary, false: colors.border }} />
        </View>
        {marcar ? (
          <View style={styles.bloco}>
            <SeletorDia valor={dia} onMudar={setDia} sentido="futuro" quantos={30} />
            <SeletorHora valor={hora} onMudar={setHora} />
          </View>
        ) : null}
        <Button label="Registrar" icon="checkmark" onPress={salvar} loading={registrar.isPending} fullWidth />
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
    tipos: { flexDirection: "row", gap: 8 },
    tipo: {
      flex: 1,
      alignItems: "center",
      gap: 4,
      paddingVertical: 12,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tipoTexto: { fontSize: 13, fontWeight: "800", color: colors.textSecondary },
  });
