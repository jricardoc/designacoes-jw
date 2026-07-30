import { Ionicons } from "@expo/vector-icons";
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
import { colors, radius, shadow, spacing } from "@/theme";

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
        description="O que chegou neste aparelho"
        showBack
        right={
          !carregando && itens.length > 0 ? (
            <Pressable style={styles.limpar} hitSlop={8} onPress={pedirLimpeza}>
              <Ionicons name="trash-outline" size={16} color={colors.red} />
              <Text style={styles.limparTexto}>Limpar tudo</Text>
            </Pressable>
          ) : null
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  lista: { padding: 18, paddingBottom: 44, gap: 11 },
  limpar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerBg,
  },
  limparTexto: { color: colors.red, fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.lg,
    ...shadow.card,
  },
  cardNaoLida: { borderColor: colors.green },
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
    backgroundColor: colors.green,
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
