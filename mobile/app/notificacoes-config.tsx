import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useAtualizarConfig } from "@/api/hooks/useMisc";
import {
  usePreferenciasNotificacao,
  useSalvarPreferenciasNotificacao,
} from "@/api/hooks/usePreferenciasNotificacao";
import { GradientHeader, Loading, TextField, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useNotifPref } from "@/notifications/notifPref";
import { radius, shadow, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/**
 * O que o irmão recebe e quando.
 *
 * As listas de tipos e de antecedências vêm do backend (`opcoes`), não de constantes daqui:
 * quem executa as regras é o agendador, então uma opção que só existisse no app seria uma
 * promessa que ninguém cumpre.
 */

/** "19:30" menos 3 horas -> "16:30". Só para a prévia; a conta que vale é a do servidor. */
function menosHoras(hora: string, horas: number): string {
  const [h, m] = hora.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hora;
  const total = (h * 60 + m - horas * 60 + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function NotificacoesConfigScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const { usuario } = useAuth();
  const notif = useNotifPref();
  const { data, isLoading } = usePreferenciasNotificacao();
  const salvar = useSalvarPreferenciasNotificacao();
  const atualizarConfig = useAtualizarConfig();

  const [tipos, setTipos] = useState<string[]>([]);
  const [antecedencias, setAntecedencias] = useState<string[]>([]);
  const [meioSemana, setMeioSemana] = useState("");
  const [fimDeSemana, setFimDeSemana] = useState("");

  useEffect(() => {
    if (!data) return;
    setTipos(data.tipos);
    setAntecedencias(data.antecedencias);
    setMeioSemana(data.horarios.meioSemana);
    setFimDeSemana(data.horarios.fimDeSemana);
  }, [data]);

  const horaExemplo = data?.horarios.meioSemana ?? "19:30";

  // A prévia de "N horas antes" só faz sentido em cima de um horário de reunião; o backend
  // manda a descrição genérica e aqui ela vira hora de relógio.
  const descricaoRegra = useMemo(
    () => (id: string, descricao: string) => {
      const m = /^(\d+)h$/.exec(id);
      if (!m) return descricao;
      return `${descricao} — ${menosHoras(horaExemplo, Number(m[1]))} nos dias de semana`;
    },
    [horaExemplo],
  );

  const alternar = (lista: string[], id: string) =>
    lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id];

  const persistir = async (novosTipos: string[], novasAntecedencias: string[]) => {
    try {
      await salvar.mutateAsync({
        tipos: novosTipos,
        antecedencias: novasAntecedencias,
      });
    } catch (err) {
      toast.show(
        err instanceof Error ? err.message : "Erro ao salvar preferências",
        "error",
      );
      // Volta ao que o servidor tem: um switch que ficou ligado sem ter gravado mente.
      if (data) {
        setTipos(data.tipos);
        setAntecedencias(data.antecedencias);
      }
    }
  };

  const alternarTipo = (id: string) => {
    const novo = alternar(tipos, id);
    setTipos(novo);
    persistir(novo, antecedencias);
  };

  const alternarAntecedencia = (id: string) => {
    const novo = alternar(antecedencias, id);
    setAntecedencias(novo);
    persistir(tipos, novo);
  };

  const salvarHorarios = async () => {
    try {
      await atualizarConfig.mutateAsync({
        horaMeioSemana: meioSemana,
        horaFimDeSemana: fimDeSemana,
      });
      toast.show("Horários salvos!");
    } catch (err) {
      toast.show(
        err instanceof Error ? err.message : "Erro ao salvar horários",
        "error",
      );
    }
  };

  if (isLoading || !data) {
    return (
      <View style={styles.screen}>
        <GradientHeader
          title="Configurar notificações"
          description="O que você recebe e quando"
          icon="notifications"
          showBack
        />
        <Loading label="Carregando preferências..." />
      </View>
    );
  }

  const tudoDesligado = antecedencias.length === 0 || tipos.length === 0;

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Configurar notificações"
        description="O que você recebe e quando"
        icon="notifications"
        showBack
      />

      <ScrollView contentContainerStyle={styles.scroll} automaticallyAdjustKeyboardInsets>
        {/* Chave geral — é o registro do aparelho, e sem ele nada mais aqui importa. */}
        <View style={styles.card}>
          <View style={styles.linhaSwitch}>
            <View style={styles.textos}>
              <Text style={styles.titulo}>Notificações neste aparelho</Text>
              <Text style={styles.descricao}>
                Desligado, este celular para de receber qualquer aviso.
              </Text>
            </View>
            <Switch
              value={notif.enabled}
              onValueChange={notif.toggle}
              trackColor={{ true: colors.primary, false: colors.borderStrong }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {!notif.enabled ? (
          <View style={styles.aviso}>
            <Ionicons name="notifications-off-outline" size={16} color={colors.amber} />
            <Text style={styles.avisoTexto}>
              As opções abaixo ficam guardadas, mas só voltam a valer quando você religar as
              notificações neste aparelho.
            </Text>
          </View>
        ) : null}

        {/* Tipos */}
        <Text style={styles.secao}>O que eu quero receber</Text>
        <View style={styles.card}>
          {data.opcoes.tipos.map((opcao, i) => (
            <View
              key={opcao.id}
              style={[styles.linhaSwitch, i > 0 && styles.divisoria]}
            >
              <View style={styles.textos}>
                <Text style={styles.titulo}>{opcao.label}</Text>
                <Text style={styles.descricao}>{opcao.descricao}</Text>
              </View>
              <Switch
                value={tipos.includes(opcao.id)}
                onValueChange={() => alternarTipo(opcao.id)}
                trackColor={{ true: colors.primary, false: colors.borderStrong }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        {/* Antecedências */}
        <Text style={styles.secao}>Quando me avisar</Text>
        <Text style={styles.secaoAjuda}>
          Pode marcar mais de uma. Cada marcada é um aviso separado.
        </Text>
        <View style={styles.card}>
          {data.opcoes.regras.map((regra, i) => {
            const marcada = antecedencias.includes(regra.id);
            return (
              <Pressable
                key={regra.id}
                style={[styles.linhaOpcao, i > 0 && styles.divisoria]}
                onPress={() => alternarAntecedencia(regra.id)}
              >
                <View
                  style={[styles.caixa, marcada && styles.caixaMarcada]}
                >
                  {marcada ? (
                    <Ionicons name="checkmark" size={15} color={colors.textOnPrimary} />
                  ) : null}
                </View>
                <View style={styles.textos}>
                  <Text style={styles.titulo}>{regra.label}</Text>
                  <Text style={styles.descricao}>
                    {descricaoRegra(regra.id, regra.descricao)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {tudoDesligado ? (
          <View style={styles.aviso}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.amber} />
            <Text style={styles.avisoTexto}>
              Do jeito que está, você não vai receber lembrete nenhum.
            </Text>
          </View>
        ) : null}

        {/* Horário das reuniões */}
        <Text style={styles.secao}>Horário das reuniões</Text>
        <Text style={styles.secaoAjuda}>
          É daqui que sai a conta do &quot;N horas antes&quot;. Vale para a congregação toda.
        </Text>
        {usuario?.isAdmin ? (
          <View style={styles.card}>
            <TextField
              label="Meio de semana"
              value={meioSemana}
              onChangeText={setMeioSemana}
              placeholder="19:30"
              keyboardType="numbers-and-punctuation"
            />
            <View style={{ height: spacing.md }} />
            <TextField
              label="Fim de semana"
              value={fimDeSemana}
              onChangeText={setFimDeSemana}
              placeholder="09:00"
              keyboardType="numbers-and-punctuation"
            />
            <Pressable
              style={styles.botaoSalvar}
              disabled={atualizarConfig.isPending}
              onPress={salvarHorarios}
            >
              {atualizarConfig.isPending ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.botaoSalvarTexto}>Salvar horários</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.linhaInfo}>
              <Text style={styles.descricao}>Meio de semana</Text>
              <Text style={styles.valor}>{data.horarios.meioSemana}</Text>
            </View>
            <View style={[styles.linhaInfo, styles.divisoria]}>
              <Text style={styles.descricao}>Fim de semana</Text>
              <Text style={styles.valor}>{data.horarios.fimDeSemana}</Text>
            </View>
            <Text style={[styles.descricao, { marginTop: spacing.sm }]}>
              Só um administrador pode alterar.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 18, paddingBottom: 44, gap: spacing.md },
    secao: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: spacing.sm,
    },
    secaoAjuda: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: -spacing.sm + 2,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: spacing.lg,
      ...shadow.card,
    },
    linhaSwitch: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    linhaOpcao: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    linhaInfo: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.sm,
    },
    divisoria: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    textos: { flex: 1, gap: 2 },
    titulo: { fontSize: 15, fontWeight: "600", color: colors.text },
    descricao: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    valor: { fontSize: 15, fontWeight: "700", color: colors.text },
    caixa: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    caixaMarcada: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    aviso: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      backgroundColor: colors.warningBg,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    avisoTexto: { flex: 1, fontSize: 13, color: colors.orangeDark, lineHeight: 18 },
    botaoSalvar: {
      marginTop: spacing.lg,
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      paddingVertical: 13,
      alignItems: "center",
    },
    botaoSalvarTexto: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 15 },
  });
