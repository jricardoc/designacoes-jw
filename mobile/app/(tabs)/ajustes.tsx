import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { GradientHeader, useToast } from "@/components/ui";
import { useAtualizarConfig, useConfig } from "@/api/hooks/useMisc";
import { useAuth } from "@/context/AuthContext";
import { GruposDeCampo } from "@/components/config/GruposDeCampo";
import { ehAdminGeral } from "@/utils/permissoes";
import { radius, shadow, spacing, type Cores } from "@/theme";
import { useTema, type TemaPreferido } from "@/theme/TemaContext";
import { useBarraFlutuante } from "@/components/layout/contextoRolagem";

/**
 * Ajustes do APP — aparência, atalhos e o nome da congregação.
 *
 * Quase tudo aqui só muda NESTE aparelho. A exceção é a Congregação, que vale para todos e
 * por isso só aparece para o admin geral: ela veio da aba "Sistema" da tela de cadastro,
 * que deixou de existir — aquela tela virou "Publicadores" e é só de pessoas.
 */

const OPCOES_TEMA: {
  id: TemaPreferido;
  rotulo: string;
  descricao: string;
  icone: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    id: "claro",
    rotulo: "Claro",
    descricao: "Creme e oliva, como sempre foi",
    icone: "sunny-outline",
  },
  {
    id: "escuro",
    rotulo: "Escuro",
    descricao: "Os mesmos tons terrosos, à noite",
    icone: "moon-outline",
  },
  {
    id: "sistema",
    rotulo: "Padrão do sistema",
    descricao: "Acompanha o claro/escuro do aparelho",
    icone: "phone-portrait-outline",
  },
];

export default function AjustesScreen() {
  // Chamado UMA vez, no topo: o ScrollView abaixo mora dentro de um condicional
  // (carregando / vazio / lista), e espalhar o hook lá dentro o tornaria uma
  // chamada condicional — proibido, e quebra na primeira troca de estado.
  const { rolagem, recuo } = useBarraFlutuante();
  const { usuario } = useAuth();
  const { data: config } = useConfig();
  const atualizarConfig = useAtualizarConfig();
  const toast = useToast();
  const [congName, setCongName] = useState("");

  useEffect(() => {
    if (config) setCongName(config.subtitulo ?? "");
  }, [config]);

  const salvarCongregacao = () => {
    const valor = congName.trim();
    // Nada a fazer se está vazio ou igual ao que já está gravado — o onBlur dispara a cada
    // saída do campo, inclusive quando ninguém digitou nada.
    if (!valor || valor === config?.subtitulo) return;
    atualizarConfig.mutate(
      { subtitulo: valor },
      {
        onSuccess: () => toast.show("Congregação atualizada!"),
        onError: () => toast.show("Erro ao salvar", "error"),
      },
    );
  };

  const { colors, styles, tema, daltonico, setTema, setDaltonico } =
    useTema(criarEstilos);
  const versao = Constants.expoConfig?.version ?? "—";

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Ajustes"
        description="Aparência e preferências deste aparelho"
        icon="settings"
      />

      <ScrollView {...rolagem} contentContainerStyle={[styles.scroll, recuo]} automaticallyAdjustKeyboardInsets>
        {/* Congregação — do admin geral, não do aparelho. */}
        {ehAdminGeral(usuario) ? (
          <>
            <Text style={styles.secao}>Congregação</Text>
            <View style={[styles.card, styles.cardCampo]}>
              <Text style={styles.campoRotulo}>Nome</Text>
              <TextInput
                value={congName}
                onChangeText={setCongName}
                // Salva ao sair do campo, como era na tela antiga: sem botão para esquecer
                // de apertar, e sem gravar a cada letra digitada.
                onBlur={salvarCongregacao}
                placeholder="Congregação..."
                placeholderTextColor={colors.textMuted}
                style={styles.campo}
              />
            </View>
          </>
        ) : null}

        {/* Grupos de campo — do admin geral, como a congregação. */}
        {ehAdminGeral(usuario) ? (
          <>
            <Text style={styles.secao}>Grupos de campo</Text>
            <GruposDeCampo />
          </>
        ) : null}

        {/* Tema */}
        <Text style={styles.secao}>Aparência</Text>
        <View style={styles.card}>
          {OPCOES_TEMA.map((opcao, i) => {
            const ativa = tema === opcao.id;
            return (
              <Pressable
                key={opcao.id}
                style={[styles.linha, i > 0 && styles.divisoria]}
                onPress={() => setTema(opcao.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: ativa }}
              >
                <View style={[styles.icone, ativa && styles.iconeAtivo]}>
                  <Ionicons
                    name={opcao.icone}
                    size={18}
                    color={ativa ? colors.textOnPrimary : colors.textSecondary}
                  />
                </View>
                <View style={styles.textos}>
                  <Text style={styles.titulo}>{opcao.rotulo}</Text>
                  <Text style={styles.descricao}>{opcao.descricao}</Text>
                </View>
                <Ionicons
                  name={ativa ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={ativa ? colors.primary : colors.borderStrong}
                />
              </Pressable>
            );
          })}
        </View>

        {/* Daltonismo */}
        <View style={styles.card}>
          <View style={styles.linha}>
            <View style={styles.icone}>
              <Ionicons
                name="color-filter-outline"
                size={18}
                color={colors.textSecondary}
              />
            </View>
            <View style={styles.textos}>
              <Text style={styles.titulo}>Modo daltônico</Text>
              <Text style={styles.descricao}>
                O tema muda do eixo verde-oliva/terracota para azul/laranja, que
                continua distinguível em protanopia e deuteranopia.
              </Text>
            </View>
            <Switch
              value={daltonico}
              onValueChange={setDaltonico}
              trackColor={{ true: colors.primary, false: colors.borderStrong }}
              thumbColor="#fff"
            />
          </View>

          {/* Amostra ao vivo: sem ela o irmão liga a chave e fica na dúvida se
              mudou alguma coisa — foi exatamente o que aconteceu no teste. */}
          <View style={[styles.amostras, styles.divisoria]}>
            {[
              { nome: "Marca", cor: colors.primary },
              { nome: "Publicado", cor: colors.greenDark },
              { nome: "Atenção", cor: colors.amber },
              { nome: "Excluir", cor: colors.red },
              { nome: "Destaque", cor: colors.terracotta },
            ].map((a) => (
              <View key={a.nome} style={styles.amostra}>
                <View style={[styles.amostraCor, { backgroundColor: a.cor }]} />
                <Text style={styles.amostraNome}>{a.nome}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Notificações */}
        <Text style={styles.secao}>Notificações</Text>
        <View style={styles.card}>
          <Pressable
            style={styles.linha}
            onPress={() => router.push("/notificacoes-config")}
          >
            <View style={styles.icone}>
              <Ionicons
                name="notifications-outline"
                size={18}
                color={colors.textSecondary}
              />
            </View>
            <View style={styles.textos}>
              <Text style={styles.titulo}>Configurar notificações</Text>
              <Text style={styles.descricao}>O que você recebe e quando</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[styles.linha, styles.divisoria]}
            onPress={() => router.push("/notificacoes")}
          >
            <View style={styles.icone}>
              <Ionicons name="mail-open-outline" size={18} color={colors.textSecondary} />
            </View>
            <View style={styles.textos}>
              <Text style={styles.titulo}>Central de notificações</Text>
              <Text style={styles.descricao}>Os avisos que já chegaram</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Sobre */}
        <Text style={styles.secao}>Sobre</Text>
        <View style={styles.card}>
          <View style={styles.linha}>
            <View style={styles.textos}>
              <Text style={styles.titulo}>Servir Mais</Text>
              <Text style={styles.descricao}>
                Designações da Congregação Norte de Itapuã
              </Text>
            </View>
          </View>
          <View style={[styles.linhaInfo, styles.divisoria]}>
            <Text style={styles.descricao}>Versão</Text>
            <Text style={styles.valor}>{versao}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 18, gap: spacing.md },
    secao: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: spacing.sm,
    },
    cardCampo: { padding: 14, gap: 6 },
    campoRotulo: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: colors.textMuted,
    },
    campo: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: spacing.lg,
      ...shadow.card,
    },
    linha: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.sm,
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
      marginTop: spacing.sm,
      paddingTop: spacing.md,
    },
    icone: {
      width: 34,
      height: 34,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    iconeAtivo: { backgroundColor: colors.primary },
    amostras: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    amostra: { flex: 1, alignItems: "center", gap: 5 },
    amostraCor: {
      width: "100%",
      height: 26,
      borderRadius: radius.sm,
    },
    amostraNome: {
      fontSize: 10.5,
      fontWeight: "600",
      color: colors.textMuted,
      textAlign: "center",
    },
    textos: { flex: 1, gap: 2 },
    titulo: { fontSize: 15, fontWeight: "600", color: colors.text },
    descricao: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    valor: { fontSize: 15, fontWeight: "700", color: colors.text },
  });
