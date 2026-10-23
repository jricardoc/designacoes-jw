import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/api/client";
import {
  useAssistencias,
  useExcluirAssistencia,
  useSalvarAssistencia,
} from "@/api/hooks/useReunioes";
import { useConfig } from "@/api/hooks/useMisc";
import type { SemanaReuniao, TipoAssistencia } from "@/api/types";
import { Button, Sheet, TextField, useToast } from "@/components/ui";
import { motion, radius, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { exportarImagem } from "@/utils/exportImagem";
import { datasDaSemana, faixaSemana, type DataDaSemana } from "@/utils/semanaReuniao";
import { AssistenciaShareCard } from "./AssistenciaShareCard";

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
 *
 * "Compartilhar imagem" gera o cartão da contagem para o WhatsApp. Grava antes se o que
 * está na tela difere do registro: a imagem não pode mostrar um número que o sistema não tem.
 */
export function AssistenciaSheet({ semana, onClose }: AssistenciaSheetProps) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const { data: assistencias } = useAssistencias();
  const salvar = useSalvarAssistencia();
  const excluir = useExcluirAssistencia();
  const { data: config } = useConfig();
  // Montar o cartão fora da tela é o que dispara a captura (mesma mecânica da semana).
  const [imagem, setImagem] = useState<{ presencial: number; zoom: number } | null>(null);
  const shotRef = useRef<View>(null);
  const capturando = useRef(false);

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

  const handleCompartilhar = async () => {
    if (!dataSelecionada) return;
    const valores = { presencial: numero(presencial), zoom: numero(zoom) };
    try {
      if (registro?.presencial !== valores.presencial || registro?.zoom !== valores.zoom) {
        await salvar.mutateAsync({ data: chaveData(dataSelecionada.data), tipo, ...valores });
      }
      setImagem(valores);
    } catch (err) {
      toast.show(
        err instanceof Error ? err.message : "Erro ao salvar a assistência",
        "error",
      );
    }
  };

  /** Chamado pelo onLayout do cartão escondido — antes disso a imagem sai em branco. */
  const capturar = async () => {
    if (!imagem || !dataSelecionada || capturando.current) return;
    capturando.current = true;
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const marca = chaveData(dataSelecionada.data).replace(/\//g, "-");
      await exportarImagem(shotRef, `assistencia-${tipo}-${marca}.png`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao gerar imagem", "error");
    } finally {
      setImagem(null);
      capturando.current = false;
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

          {/* A lista vive numa tela própria: tem busca no cadastro e pode ser longa. */}
          <Button
            label={
              registro?.zoomConexoes
                ? `Quem assistiu pelo Zoom (${registro.zoomConexoes})`
                : "Quem assistiu pelo Zoom"
            }
            icon="videocam-outline"
            variant="secondary"
            onPress={() => {
              if (!dataSelecionada) return;
              const data = chaveData(dataSelecionada.data).replace(/\//g, "-");
              onClose();
              // Espera a folha sair: navegar com o Modal ainda fechando deixa a tela por baixo.
              setTimeout(() => router.push({ pathname: "/reuniao/zoom", params: { data, tipo } }), motion.saida);
            }}
            disabled={!dataSelecionada}
            fullWidth
          />

          <Button
            label="Compartilhar imagem"
            icon="share-social-outline"
            variant="secondary"
            onPress={handleCompartilhar}
            loading={!!imagem}
            disabled={total === 0 || salvar.isPending}
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

          {/* Fora da tela de propósito: precisa de layout para o view-shot capturar. */}
          {imagem && dataSelecionada ? (
            <View style={styles.shotHost} pointerEvents="none" onLayout={capturar}>
              <AssistenciaShareCard
                ref={shotRef}
                tipo={tipo}
                data={`${dataSelecionada.diaSemana}, ${dataSelecionada.diaMes}/${dataSelecionada.data.getFullYear()}`}
                presencial={imagem.presencial}
                zoom={imagem.zoom}
                congregacao={config?.subtitulo}
              />
            </View>
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
    // Longe da área visível, sem opacity 0: view invisível por opacidade sai em branco no
    // print de alguns Android.
    shotHost: { position: "absolute", left: -10000, top: 0 },
  });
