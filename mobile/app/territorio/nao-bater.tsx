import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReconfirmarMarcacao, useRetirarMarcacao, useTerritorio } from "@/api/hooks/useTerritorios";
import type { MarcacaoTerritorio } from "@/api/types";
import { FilaBanner } from "@/components/territorio/FilaBanner";
import { MarcarSheet, type PontoEscolhido } from "@/components/territorio/MarcarSheet";
import { Button, EmptyState, GradientHeader, Loading, TextField, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { enfileirar, novaChave, useFilaTerritorios } from "@/territorios/fila";
import { minhaLocalizacao } from "@/territorios/gps";

/**
 * Casas que pediram para não receber visitas. Cada uma precisa ser reconfirmada a cada 3 meses:
 * passou disso, o cartão fica amarelo e entra no aviso diário de quem cuida dos territórios.
 *
 * Registrar tem dois jeitos: com o GPS, parado na frente da casa (fica no mapa), ou só pelo
 * endereço, quando o GPS não ajuda. Os dois vão pela fila offline.
 */
export default function NaoBaterScreen() {
  const { numero } = useLocalSearchParams<{ numero: string }>();
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { usuario } = useAuth();
  const { data: t, isLoading, refetch, isRefetching } = useTerritorio(numero);
  const { pendentes } = useFilaTerritorios();
  const reconfirmar = useReconfirmarMarcacao();
  const retirar = useRetirarMarcacao();
  const [rua, setRua] = useState("");
  const [casa, setCasa] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [ponto, setPonto] = useState<PontoEscolhido | null>(null);

  if (isLoading) return <Loading label="Carregando..." />;
  if (!t) {
    return (
      <View style={styles.flex}>
        <GradientHeader title="Não bater" showBack />
        <EmptyState icon="cloud-offline" title="Não foi possível carregar" message="Tente de novo com internet." />
      </View>
    );
  }

  const casas = t.marcacoes
    .filter((m) => m.tipo === "nao_bater")
    .sort((a, b) => Number(b.precisaReconfirmar) - Number(a.precisaReconfirmar));
  const naFila = pendentes.filter((i) => i.numero === t.numero && i.corpo.tipo === "nao_bater");
  const texto = `${rua.trim()}${casa.trim() ? `, ${casa.trim()}` : ""}`;

  const registrarPeloEndereco = async () => {
    setSalvando(true);
    const clientKey = novaChave();
    const r = await enfileirar({
      clientKey,
      tipo: "marcacao",
      numero: t.numero,
      titulo: `Não bater · ${texto}`,
      corpo: { clientKey, territorioId: t.id, tipo: "nao_bater", texto, marcadaEm: new Date().toISOString() },
    });
    setSalvando(false);
    if (r.erro) return toast.show(r.erro, "error");
    setRua("");
    setCasa("");
    toast.show(r.enviado ? "Casa registrada" : "Sem internet: guardado no celular, envia sozinho");
  };

  const registrarComGps = async () => {
    setBuscandoGps(true);
    try {
      setPonto({ ...(await minhaLocalizacao()), origem: "gps" });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Não consegui achar sua localização", "error");
    } finally {
      setBuscandoGps(false);
    }
  };

  const podeRetirar = (m: MarcacaoTerritorio) => t.permissoes.gerenciar || m.autor?.id === usuario?.id;

  return (
    <View style={styles.flex}>
      <GradientHeader title="Não bater" description={`Território ${t.numero} · ${t.nome}`} showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.explica}>Cada casa precisa ser reconfirmada a cada 3 meses.</Text>
        <FilaBanner numero={t.numero} />

        {casas.length === 0 && naFila.length === 0 ? (
          <View style={styles.vazio}>
            <Ionicons name="hand-left-outline" size={26} color={colors.textMuted} />
            <Text style={styles.vazioTexto}>Nenhuma casa registrada neste território.</Text>
          </View>
        ) : null}

        {casas.map((m) => (
          <View key={m.id} style={[styles.cartao, m.precisaReconfirmar && styles.cartaoVencido]}>
            <View style={styles.linha}>
              <Ionicons name="hand-left" size={20} color={colors.redDark} />
              <Text style={styles.endereco}>{m.texto}</Text>
              {m.lat !== null ? <Ionicons name="location" size={16} color={colors.textSecondary} /> : null}
            </View>
            <Text style={styles.meta}>
              Registrada em {new Date(m.marcadaEm).toLocaleDateString("pt-BR")}
              {m.autor ? ` por ${m.autor.nome}` : ""}
              {m.reconfirmadaEm ? `\nReconfirmada em ${new Date(m.reconfirmadaEm).toLocaleDateString("pt-BR")}` : ""}
            </Text>
            {m.precisaReconfirmar ? <Text style={styles.vencido}>Passou de 3 meses: precisa reconfirmar</Text> : null}
            {t.permissoes.marcar ? (
              <View style={styles.acoes}>
                <Pressable
                  style={styles.acao}
                  disabled={reconfirmar.isPending}
                  onPress={() =>
                    reconfirmar.mutate(m.id, {
                      onSuccess: () => toast.show("Reconfirmada"),
                      onError: (e) => toast.show(e.message, "error"),
                    })
                  }
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.primaryDark} />
                  <Text style={styles.acaoTexto}>Continua não bater</Text>
                </Pressable>
                {podeRetirar(m) ? (
                  <Pressable
                    style={styles.acao}
                    onPress={() =>
                      Alert.alert("Retirar da lista?", m.texto ?? "", [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Retirar",
                          style: "destructive",
                          onPress: () =>
                            retirar.mutate(m.id, {
                              onSuccess: () => toast.show("Retirada da lista"),
                              onError: (e) => toast.show(e.message, "error"),
                            }),
                        },
                      ])
                    }
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.red} />
                    <Text style={[styles.acaoTexto, { color: colors.red }]}>Retirar</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ))}

        {t.permissoes.marcar ? (
          <View style={styles.form}>
            <Text style={styles.formTitulo}>Registrar nova casa</Text>
            <Pressable style={styles.gps} onPress={registrarComGps} disabled={buscandoGps}>
              {buscandoGps ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Ionicons name="location" size={22} color={colors.textOnPrimary} />
              )}
              <Text style={styles.gpsTexto}>Estou na frente da casa</Text>
            </Pressable>
            <Text style={styles.ou}>ou só pelo endereço</Text>
            <TextField label="Rua" placeholder="Ex.: Rua das Flores" value={rua} onChangeText={setRua} maxLength={120} />
            <TextField label="Casa" placeholder="Número" value={casa} onChangeText={setCasa} keyboardType="numbers-and-punctuation" maxLength={20} />
            {rua.trim().length >= 3 ? <Text style={styles.previa}>Vai ficar registrado: {texto}</Text> : null}
            <Text style={styles.dica}>Não escreva nomes nem dados dos moradores.</Text>
            <Button
              label="Registrar casa"
              icon="hand-left"
              variant="danger"
              onPress={registrarPeloEndereco}
              loading={salvando}
              disabled={rua.trim().length < 3}
              fullWidth
            />
          </View>
        ) : null}
      </ScrollView>

      <MarcarSheet
        territorio={{ id: t.id, numero: t.numero, quadras: t.quadras }}
        ponto={ponto}
        tipoInicial="nao_bater"
        onClose={() => setPonto(null)}
      />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, gap: 12 },
    explica: { fontSize: 14, color: colors.textSecondary },
    vazio: { alignItems: "center", gap: 8, padding: 24 },
    vazioTexto: { fontSize: 14, color: colors.textSecondary },
    cartao: {
      gap: 6,
      padding: 14,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.card,
    },
    cartaoVencido: { borderColor: colors.amber, backgroundColor: colors.warningBg },
    linha: { flexDirection: "row", alignItems: "center", gap: 10 },
    endereco: { flex: 1, fontSize: 17, fontWeight: "800", color: colors.text },
    meta: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    vencido: { fontSize: 13.5, fontWeight: "800", color: colors.amber },
    acoes: { flexDirection: "row", gap: 18, marginTop: 4 },
    acao: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
    acaoTexto: { fontSize: 14, fontWeight: "800", color: colors.primaryDark },
    form: { gap: 10, marginTop: 8, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    formTitulo: { fontSize: 17, fontWeight: "800", color: colors.text },
    gps: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      minHeight: 58,
      borderRadius: radius.md,
      backgroundColor: colors.redDark,
    },
    gpsTexto: { fontSize: 16.5, fontWeight: "800", color: colors.textOnPrimary },
    ou: { textAlign: "center", fontSize: 13, color: colors.textMuted },
    previa: { fontSize: 14, fontWeight: "700", color: colors.text },
    dica: { fontSize: 12, color: colors.textMuted },
  });
