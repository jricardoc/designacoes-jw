import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { CasaTrabalhada, Quadra } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { Button, Sheet, TextField, useToast } from "@/components/ui";
import { motion, radius, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { CASA_TRABALHADA, diaISO } from "@/territorios/constantes";
import { enfileirar, novaChave } from "@/territorios/fila";
import { minhaLocalizacao, type Localizacao } from "@/territorios/gps";

interface SaidaSheetProps {
  territorio: { id: number; numero: string; quadras: Quadra[] } | null;
  visible: boolean;
  onClose: () => void;
}

type Etapa = "pergunta" | "concluiu" | "parou";

const DIAS = [
  { rotulo: "Hoje", atras: 0 },
  { rotulo: "Ontem", atras: 1 },
  { rotulo: "Anteontem", atras: 2 },
];

/**
 * Registrar a saída de campo: UMA pergunta primeiro ("concluíram o território?") e só depois,
 * se não, onde pararam. Substitui os dois botões do app antigo ("registrar trabalho" e
 * "registrar onde paramos"), que diziam coisas diferentes sobre a mesma saída.
 *
 * Vai pela fila, como as marcações: sem internet fica no celular e sobe sozinho.
 */
export function SaidaSheet({ territorio, visible, onClose }: SaidaSheetProps) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const { celebrar } = useCelebracao();
  const [etapa, setEtapa] = useState<Etapa>("pergunta");
  const [diasAtras, setDiasAtras] = useState(0);
  const [quadraId, setQuadraId] = useState<number | null>(null);
  const [ondeParou, setOndeParou] = useState("");
  const [gps, setGps] = useState<Localizacao | null>(null);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [casa, setCasa] = useState<CasaTrabalhada | null>(null);
  const [proximo, setProximo] = useState("");
  const [pendente, setPendente] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setEtapa("pergunta");
    setDiasAtras(0);
    setQuadraId(null);
    setOndeParou("");
    setGps(null);
    setCasa(null);
    setProximo("");
    setPendente("");
  }, [visible]);

  const usarGps = async () => {
    setBuscandoGps(true);
    try {
      setGps(await minhaLocalizacao());
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Não consegui achar sua localização", "error");
    } finally {
      setBuscandoGps(false);
    }
  };

  const concluiu = etapa === "concluiu";
  const podeSalvar =
    concluiu ||
    ((ondeParou.trim().length >= 3 || !!gps) && !!casa && (casa !== "outro_lugar" || proximo.trim().length >= 3));

  const salvar = async () => {
    if (!territorio || !podeSalvar) return;
    setSalvando(true);
    const clientKey = novaChave();
    const resultado = await enfileirar({
      clientKey,
      tipo: "saida",
      numero: territorio.numero,
      titulo: `${concluiu ? "Território concluído" : "Onde paramos"} · Território ${territorio.numero}`,
      corpo: {
        clientKey,
        territorioId: territorio.id,
        dia: diaISO(diasAtras),
        concluiu,
        ...(concluiu
          ? {}
          : {
              quadraId,
              ondeParou: ondeParou.trim() || null,
              casaTrabalhada: casa,
              proximoInicio: casa === "outro_lugar" ? proximo.trim() : null,
              pendente: pendente.trim() || null,
              lat: gps?.lat ?? null,
              lng: gps?.lng ?? null,
            }),
      },
    });
    setSalvando(false);
    if (resultado.erro) {
      toast.show(resultado.erro, "error");
      return;
    }
    // Concluir o território merece a mesma comemoração de cumprir uma tarefa. Espera a folha
    // sair: no iPhone um Modal não abre enquanto outro ainda está fechando.
    if (concluiu) setTimeout(() => celebrar(`Território ${territorio.numero} concluído`), motion.fundo + 150);
    if (!concluiu || !resultado.enviado) {
      toast.show(resultado.enviado ? "Saída registrada!" : "Sem internet: guardado no celular, envia sozinho");
    }
    onClose();
  };

  const chip = (ativo: boolean, rotulo: string, onPress: () => void, key?: string) => (
    <Pressable key={key ?? rotulo} onPress={onPress} style={[styles.chip, ativo && styles.chipAtivo]}>
      <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{rotulo}</Text>
    </Pressable>
  );

  return (
    <Sheet visible={visible} onClose={onClose} scroll>
      <View style={styles.corpo}>
        <Text style={styles.titulo}>Registrar saída</Text>

        {etapa === "pergunta" ? (
          <>
            <Text style={styles.pergunta}>Vocês concluíram o território inteiro?</Text>
            <Pressable style={[styles.grande, styles.grandeSim]} onPress={() => setEtapa("concluiu")}>
              <Ionicons name="checkmark-circle" size={30} color={colors.textOnPrimary} />
              <View style={styles.grandeTextos}>
                <Text style={styles.grandeTitulo}>Sim, concluímos</Text>
                <Text style={styles.grandeSub}>O território inteiro foi trabalhado</Text>
              </View>
            </Pressable>
            <Pressable style={[styles.grande, styles.grandeNao]} onPress={() => setEtapa("parou")}>
              <Ionicons name="flag" size={28} color={colors.primaryDark} />
              <View style={styles.grandeTextos}>
                <Text style={[styles.grandeTitulo, { color: colors.text }]}>Não, paramos no meio</Text>
                <Text style={[styles.grandeSub, { color: colors.textSecondary }]}>Vou dizer onde paramos</Text>
              </View>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable onPress={() => setEtapa("pergunta")} style={styles.voltar} hitSlop={8}>
              <Ionicons name="chevron-back" size={16} color={colors.primaryDark} />
              <Text style={styles.voltarTexto}>{concluiu ? "Concluímos o território" : "Paramos no meio"}</Text>
            </Pressable>

            {!concluiu ? (
              <>
                {territorio && territorio.quadras.length > 1 ? (
                  <View style={styles.bloco}>
                    <Text style={styles.rotulo}>Em que parte?</Text>
                    <View style={styles.chips}>
                      {chip(quadraId === null, "Território inteiro", () => setQuadraId(null))}
                      {territorio.quadras.map((q) => chip(quadraId === q.id, q.nome, () => setQuadraId(q.id), String(q.id)))}
                    </View>
                  </View>
                ) : null}

                <TextField
                  label="Onde vocês pararam?"
                  icon="flag-outline"
                  placeholder="Ex.: Casa 63, portão azul"
                  value={ondeParou}
                  onChangeText={setOndeParou}
                  maxLength={500}
                />
                <Pressable style={[styles.gps, gps && styles.gpsOk]} onPress={usarGps} disabled={buscandoGps}>
                  {buscandoGps ? (
                    <ActivityIndicator size="small" color={colors.primaryDark} />
                  ) : (
                    <Ionicons name={gps ? "checkmark-circle" : "navigate"} size={18} color={colors.primaryDark} />
                  )}
                  <Text style={styles.gpsTexto}>
                    {buscandoGps
                      ? "Buscando sua localização..."
                      : gps
                        ? `Localização marcada${gps.precisao ? ` (±${Math.round(gps.precisao)} m)` : ""}`
                        : "Marcar no mapa onde estou"}
                  </Text>
                </Pressable>

                <View style={styles.bloco}>
                  <Text style={styles.rotulo}>A última casa foi trabalhada?</Text>
                  <View style={styles.opcoes}>
                    {(Object.keys(CASA_TRABALHADA) as CasaTrabalhada[]).map((id) => {
                      const ativo = casa === id;
                      return (
                        <Pressable key={id} onPress={() => setCasa(id)} style={[styles.opcao, ativo && styles.opcaoAtiva]}>
                          <Ionicons
                            name={ativo ? "radio-button-on" : "radio-button-off"}
                            size={20}
                            color={ativo ? colors.primary : colors.textMuted}
                          />
                          <View style={styles.opcaoTextos}>
                            <Text style={styles.opcaoRotulo}>{CASA_TRABALHADA[id].rotulo}</Text>
                            <Text style={styles.opcaoExplicacao}>{CASA_TRABALHADA[id].explicacao}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {casa === "outro_lugar" ? (
                  <TextField
                    label="Onde a próxima saída deve começar?"
                    icon="play-outline"
                    placeholder="Ex.: Esquina com a Rua B"
                    value={proximo}
                    onChangeText={setProximo}
                    maxLength={500}
                  />
                ) : null}
                <TextField
                  label="Ficou algum trecho pendente? (opcional)"
                  icon="time-outline"
                  placeholder="Ex.: lado direito da Rua A"
                  value={pendente}
                  onChangeText={setPendente}
                  maxLength={1000}
                />
              </>
            ) : null}

            <View style={styles.bloco}>
              <Text style={styles.rotulo}>Quando foi a saída?</Text>
              <View style={styles.chips}>{DIAS.map((d) => chip(diasAtras === d.atras, d.rotulo, () => setDiasAtras(d.atras)))}</View>
            </View>

            <Text style={styles.dica}>Não escreva nomes nem dados dos moradores.</Text>
            <Button label="Salvar" icon="checkmark" onPress={salvar} loading={salvando} disabled={!podeSalvar} fullWidth />
          </>
        )}
      </View>
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    corpo: { gap: spacing.md, paddingBottom: spacing.sm },
    titulo: { fontSize: 21, fontWeight: "800", color: colors.text },
    pergunta: { fontSize: 17, fontWeight: "600", color: colors.text },
    grande: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: radius.lg, minHeight: 76 },
    grandeSim: { backgroundColor: colors.primary },
    grandeNao: { backgroundColor: colors.infoBg, borderWidth: 2, borderColor: colors.border },
    grandeTextos: { flex: 1, gap: 2 },
    grandeTitulo: { fontSize: 18, fontWeight: "800", color: colors.textOnPrimary },
    grandeSub: { fontSize: 13, color: colors.textOnPrimary, opacity: 0.85 },
    voltar: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
    voltarTexto: { fontSize: 14, fontWeight: "700", color: colors.primaryDark },
    bloco: { gap: 8 },
    rotulo: {
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      color: colors.textSecondary,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    chipAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipTexto: { fontSize: 14, fontWeight: "600", color: colors.text },
    chipTextoAtivo: { color: colors.textOnPrimary },
    gps: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 14,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.primary,
      backgroundColor: colors.infoBg,
    },
    gpsOk: { borderStyle: "solid" },
    gpsTexto: { fontSize: 14.5, fontWeight: "700", color: colors.primaryDark },
    opcoes: { gap: 6 },
    opcao: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    opcaoAtiva: { borderColor: colors.primary, backgroundColor: colors.surface },
    opcaoTextos: { flex: 1 },
    opcaoRotulo: { fontSize: 15, fontWeight: "700", color: colors.text },
    opcaoExplicacao: { fontSize: 12.5, color: colors.textSecondary },
    dica: { fontSize: 12, color: colors.textMuted },
  });
