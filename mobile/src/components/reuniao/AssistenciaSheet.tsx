import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/api/client";
import {
  useAssistencias,
  useExcluirAssistencia,
  useSalvarAssistencia,
} from "@/api/hooks/useReunioes";
import type { SemanaReuniao, TipoAssistencia } from "@/api/types";
import { Button, Sheet, TextField, useToast } from "@/components/ui";
import { radius, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { datasDaSemana, faixaSemana, type DataDaSemana } from "@/utils/semanaReuniao";

/** "dd/MM/yyyy" — a chave que o backend usa no upsert por (data, tipo). */
const chaveData = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/** "15" digitado vira 15; vazio, "-" ou lixo viram 0 — campo em branco é zero. */
const numero = (texto: string) => {
  const n = parseInt(texto.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

interface AssistenciaSheetProps {
  semana: SemanaReuniao | null;
  onClose: () => void;
}

/**
 * Registro da assistência de uma reunião: escolhe meio de semana ou fim de
 * semana, anota presencial e Zoom, e o TOTAL é somado aqui — quem conta não
 * faz aritmética. Regrava por cima sem cerimônia: corrigir a contagem é o
 * fluxo normal.
 *
 * Só quem gerencia reuniões chega aqui (o botão no cartão da semana é
 * escondido dos demais); o backend nega a escrita de qualquer forma.
 */
export function AssistenciaSheet({ semana, onClose }: AssistenciaSheetProps) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const { data: assistencias } = useAssistencias();
  const salvar = useSalvarAssistencia();
  const excluir = useExcluirAssistencia();

  const datas = useMemo(
    () => (semana ? datasDaSemana(semana) : { inicio: null, meio: null, fds: null }),
    [semana],
  );

  const [tipo, setTipo] = useState<TipoAssistencia>("meio");
  const [presencial, setPresencial] = useState("");
  const [zoom, setZoom] = useState("");

  // Ao abrir, começa na reunião mais próxima de hoje: quem registra normalmente
  // acabou de sair dela.
  useEffect(() => {
    if (!semana) return;
    const { meio, fds } = datasDaSemana(semana);
    if (meio && fds) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dist = (d: DataDaSemana) => Math.abs(d.data.getTime() - hoje.getTime());
      setTipo(dist(fds) < dist(meio) ? "fds" : "meio");
    } else {
      setTipo("meio");
    }
  }, [semana]);

  const dataSelecionada = tipo === "meio" ? datas.meio : datas.fds;
  const registro = useMemo(() => {
    if (!dataSelecionada) return undefined;
    const chave = chaveData(dataSelecionada.data);
    return assistencias?.find((a) => a.data === chave && a.tipo === tipo);
  }, [assistencias, dataSelecionada, tipo]);

  // Pré-preenche com o que já foi registrado (ou limpa, ao trocar de reunião).
  // Depende de id/updatedAt, não do objeto: um refetch em segundo plano devolve
  // um objeto novo com o mesmo conteúdo, e não pode apagar o que está sendo
  // digitado.
  useEffect(() => {
    setPresencial(registro ? String(registro.presencial) : "");
    setZoom(registro ? String(registro.zoom) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registro?.id, registro?.updatedAt, semana?.id, tipo]);

  const total = numero(presencial) + numero(zoom);

  const handleSalvar = async () => {
    if (!dataSelecionada) return;
    try {
      await salvar.mutateAsync({
        data: chaveData(dataSelecionada.data),
        tipo,
        presencial: numero(presencial),
        zoom: numero(zoom),
      });
      toast.show("Assistência registrada!");
      onClose();
    } catch (err) {
      toast.show(
        err instanceof Error ? err.message : "Erro ao salvar a assistência",
        "error",
      );
    }
  };

  const handleExcluir = async () => {
    if (!registro) return;
    try {
      await excluir.mutateAsync(registro.id);
      toast.show("Registro removido");
    } catch (err) {
      // 404 = outro aparelho já removeu; para quem tocou, deu no mesmo (e o
      // onSettled do hook já ressincronizou o cache).
      if (err instanceof ApiError && err.status === 404) {
        toast.show("O registro já havia sido removido");
        return;
      }
      toast.show(
        err instanceof Error ? err.message : "Erro ao remover o registro",
        "error",
      );
    }
  };

  const opcaoTipo = (
    valor: TipoAssistencia,
    rotulo: string,
    data: DataDaSemana | null,
  ) => {
    const ativa = tipo === valor;
    return (
      <Pressable
        style={[styles.tipoOpcao, ativa && styles.tipoOpcaoAtiva]}
        onPress={() => setTipo(valor)}
      >
        <Text style={[styles.tipoRotulo, ativa && styles.tipoRotuloAtivo]}>
          {rotulo}
        </Text>
        {data ? (
          <Text style={[styles.tipoData, ativa && styles.tipoDataAtiva]}>
            {data.diaSemana} · {data.diaMes}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <Sheet visible={!!semana} onClose={onClose} scroll>
      {semana ? (
        <View style={styles.corpo}>
          <Text style={styles.titulo}>Assistência</Text>
          <Text style={styles.subtitulo}>Semana de {faixaSemana(semana)}</Text>

          <View style={styles.tipoRow}>
            {opcaoTipo("meio", "Meio de semana", datas.meio)}
            {opcaoTipo("fds", "Fim de semana", datas.fds)}
          </View>

          <View style={styles.campos}>
            <View style={styles.campo}>
              <TextField
                label="Presencial"
                icon="people-outline"
                value={presencial}
                onChangeText={(t) => setPresencial(t.replace(/\D/g, ""))}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="0"
              />
            </View>
            <View style={styles.campo}>
              <TextField
                label="Pelo Zoom"
                icon="videocam-outline"
                value={zoom}
                onChangeText={(t) => setZoom(t.replace(/\D/g, ""))}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="0"
              />
            </View>
          </View>

          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValor}>{total}</Text>
          </View>

          <Button
            label={registro ? "Atualizar assistência" : "Salvar assistência"}
            icon="checkmark"
            onPress={handleSalvar}
            loading={salvar.isPending}
            fullWidth
          />

          {registro ? (
            <Pressable
              style={styles.remover}
              onPress={handleExcluir}
              disabled={excluir.isPending}
              hitSlop={8}
            >
              {excluir.isPending ? (
                <ActivityIndicator size="small" color={colors.red} />
              ) : (
                <Ionicons name="trash-outline" size={15} color={colors.red} />
              )}
              <Text style={styles.removerTexto}>Remover este registro</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    corpo: { paddingBottom: spacing.sm, gap: spacing.lg },
    titulo: { fontSize: 20, fontWeight: "800", color: colors.text },
    subtitulo: {
      fontSize: 13.5,
      color: colors.textSecondary,
      marginTop: -spacing.md,
    },
    tipoRow: { flexDirection: "row", gap: spacing.sm },
    tipoOpcao: {
      flex: 1,
      alignItems: "center",
      gap: 2,
      paddingVertical: 12,
      borderRadius: radius.md,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    tipoOpcaoAtiva: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    tipoRotulo: { fontSize: 13.5, fontWeight: "700", color: colors.text },
    tipoRotuloAtivo: { color: colors.textOnPrimary },
    tipoData: { fontSize: 12, color: colors.textSecondary },
    tipoDataAtiva: { color: colors.textOnPrimary, opacity: 0.85 },
    campos: { flexDirection: "row", gap: spacing.md },
    campo: { flex: 1 },
    totalBox: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.infoBg,
      borderRadius: radius.md,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    totalLabel: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.primaryDark,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    totalValor: { fontSize: 26, fontWeight: "800", color: colors.primaryDark },
    remover: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 4,
    },
    removerTexto: { fontSize: 13.5, fontWeight: "700", color: colors.red },
  });
