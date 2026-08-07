import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  ConfirmDialog,
  EmptyState,
  GradientHeader,
  useConfirm,
} from "@/components/ui";
import {
  marcarTodasComoLidas,
  useNotificacoes,
  type NotificacaoRegistrada,
} from "@/notifications/historicoNotificacoes";
import { radius, shadow, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/** "Agora", "há 12 min", "há 3 h", "ontem" ou a data cheia. */
function quando(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  const diff = Date.now() - data.getTime();
  if (diff < MINUTO) return "Agora";
  if (diff < HORA) return `há ${Math.floor(diff / MINUTO)} min`;
  if (diff < DIA) return `há ${Math.floor(diff / HORA)} h`;
  if (diff < 2 * DIA) return "ontem";
  return `${data.toLocaleDateString("pt-BR")} ${data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function NotificacoesScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const { itens, carregando, limpar } = useNotificacoes();
  const { config, confirm, close } = useConfirm();
  // Quais estavam por ler quando chegaram à tela. A leitura é marcada na hora,
  // mas sem esta lembrança o destaque sumiria antes de ser visto.
  const [novas, setNovas] = useState<Set<string>>(new Set());

  useEffect(() => {
    const porLer = itens.filter((n) => !n.lida).map((n) => n.id);
    if (porLer.length === 0) return;
    // Vale também para o que chega com a central aberta: sem reagir a `itens` o
    // item novo nasceria sem destaque e continuaria não lido, deixando o sino
    // avisando de algo que o usuário acabou de ver. Acumula porque quem já
    // estava por ler na abertura não pode perder o destaque.
    setNovas((antes) => new Set([...antes, ...porLer]));
    // Sem laço: marcar avisa os ouvintes, `itens` volta tudo lido e o efeito
    // sai no `return` acima.
    marcarTodasComoLidas().catch(() => {});
  }, [itens]);

  const pedirLimpeza = () =>
    confirm({
      title: "Limpar notificações",
      message: "Apaga o histórico guardado neste aparelho. Não dá para desfazer.",
      type: "danger",
      confirmText: "Limpar tudo",
      onConfirm: async () => {
        await limpar();
        // O que ainda estiver na bandeja do sistema sai junto: senão a varredura
        // do retorno ao app tentaria trazer de volta o que acabou de ser limpo.
        Notifications.dismissAllNotificationsAsync().catch(() => {});
        setNovas(new Set());
        close();
      },
    });

  const renderItem = ({
    item,
    index,
  }: {
    item: NotificacaoRegistrada;
    index: number;
  }) => {
    const naoLida = novas.has(item.id);
    return (
      <Animated.View entering={FadeInDown.delay(index * 30).duration(260)}>
        <View style={[styles.card, naoLida && styles.cardNaoLida]}>
          <View style={styles.linhaTopo}>
            <Text style={styles.titulo} numberOfLines={2}>
              {item.titulo}
            </Text>
            {naoLida ? <View style={styles.ponto} /> : null}
          </View>
          {item.corpo ? <Text style={styles.corpo}>{item.corpo}</Text> : null}
          <Text style={styles.quando}>{quando(item.recebidaEm)}</Text>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Notificações"
        description="Os avisos enviados para você"
        showBack
        right={
          // A engrenagem fica sempre; "Limpar tudo" só quando há o que limpar. Sem histórico
          // ainda é quando o irmão mais precisa chegar às configurações.
          <View style={styles.acoes}>
            {!carregando && itens.length > 0 ? (
              <Pressable style={styles.limpar} hitSlop={8} onPress={pedirLimpeza}>
                <Ionicons name="trash-outline" size={16} color={colors.red} />
              </Pressable>
            ) : null}
            <Pressable
              style={styles.configurar}
              hitSlop={8}
              accessibilityLabel="Configurar notificações"
              onPress={() => router.push("/notificacoes-config")}
            >
              <Ionicons name="settings-outline" size={18} color={colors.primaryDark} />
            </Pressable>
          </View>
        }
      />

      <FlatList
        data={itens}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          carregando ? null : (
            <EmptyState
              icon="notifications-off-outline"
              title="Nenhuma notificação"
              message="Quando chegar um aviso de designação ele fica guardado aqui."
            />
          )
        }
      />

      <ConfirmDialog config={config} onClose={close} />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    lista: { padding: 18, paddingBottom: 44, gap: 11 },
    acoes: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    limpar: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
      backgroundColor: colors.dangerBg,
    },
    configurar: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
      backgroundColor: colors.infoBg,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: spacing.lg,
      ...shadow.card,
    },
    // Vermelho, não verde: o destaque de "tem coisa nova" precisa gritar
    // diferente do resto da marca (e o vermelho vira laranja no modo daltônico).
    cardNaoLida: { borderColor: colors.red },
    linhaTopo: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    titulo: { flex: 1, fontSize: 15.5, fontWeight: "700", color: colors.text },
    ponto: {
      width: 9,
      height: 9,
      borderRadius: radius.pill,
      backgroundColor: colors.red,
      marginTop: 5,
    },
    corpo: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      marginTop: spacing.xs + 2,
    },
    quando: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
  });
