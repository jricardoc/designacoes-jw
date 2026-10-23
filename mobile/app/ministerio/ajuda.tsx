import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Topo, Vidro, type Icone } from "@/components/ministerio/kit";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

const ARTIGOS: { icone: Icone; titulo: string; texto: string; palavras: string }[] = [
  {
    icone: "swap-horizontal",
    titulo: "Como entro e saio do Ministério?",
    texto:
      "No Servir Mais, abra o menu lateral e toque na marca no topo: aparece a troca de ambiente. Aqui no Ministério, toque na marca \"Ministério\" no alto da tela (ou no seu avatar > Ir para o Servir Mais). O app abre no último ambiente que você usou.",
    palavras: "ambiente trocar voltar servir mais menu",
  },
  {
    icone: "timer",
    titulo: "Como funciona o cronômetro?",
    texto:
      "No Início, toque em Iniciar quando sair para o ministério. Pode pausar e continuar quantas vezes precisar. Ao parar, o tempo vira horas de hoje. O tempo fica guardado no servidor: fechar o app ou trocar de celular não perde a contagem.",
    palavras: "tempo horas iniciar pausar parar contar",
  },
  {
    icone: "time",
    titulo: "Esqueci de usar o cronômetro. E agora?",
    texto: "Toque no + da barra de baixo e em Lançar horas: escolha o dia e quanto tempo. Para apagar um lançamento, abra Progresso, Horas do mês, e segure o dedo sobre ele.",
    palavras: "lançar horas manual apagar esqueci",
  },
  {
    icone: "chatbubbles",
    titulo: "O que são as Conversas de hoje?",
    texto:
      "São os contatos com visita marcada para hoje. Toque em Conversei (ou Estudo) para registrar como foi e já marcar a próxima; em Não em casa, o app anota a tentativa e sugere voltar em dois dias.",
    palavras: "conversei não em casa hoje visita registrar",
  },
  {
    icone: "people",
    titulo: "Contatos, mapa e cores",
    texto:
      "Cada contato tem uma situação: atrasada (vermelho), hoje (âmbar), em breve, até 3 dias (azul), marcada (verde) ou sem data (cinza). No mapa, o pino tem a mesma cor e o ícone diz se é estudo ou revisita. Use o botão do globo para o satélite. Segure o dedo sobre um contato da lista para as ações rápidas.",
    palavras: "contato revisita estudo mapa satélite pino cor situação",
  },
  {
    icone: "location",
    titulo: "Por que meu contato não aparece no mapa?",
    texto: "Só aparece quem tem a posição marcada. Edite o contato e toque em Usar minha localização quando estiver no endereço.",
    palavras: "mapa localização gps posição aparece",
  },
  {
    icone: "calendar",
    titulo: "Agenda e planos dos companheiros",
    texto:
      "Na Agenda ficam as suas visitas marcadas, os seus planos de saída, os planos dos outros pioneiros e as saídas de campo publicadas. Para planejar, toque em Planejar ou no +. Segure o dedo sobre um plano seu para apagar.",
    palavras: "agenda plano saída companheiro buddy pioneiros",
  },
  {
    icone: "lock-closed",
    titulo: "Quem vê os meus planos?",
    texto:
      "Só os outros pioneiros regulares, e só o seu primeiro nome com o horário e o local. Para esconder, desligue Mostrar meus planos de saída em Perfil e configurações. Contatos, notas e horas nunca são mostrados a ninguém.",
    palavras: "privacidade compartilhar esconder planos quem vê",
  },
  {
    icone: "phone-portrait",
    titulo: "Como ponho as visitas no calendário do celular?",
    texto:
      "Na Agenda (ou no Perfil), toque em Assinar no Calendário. No iPhone o calendário Ministério aparece no app Calendário e se atualiza sozinho. No Android, mande o link para você e adicione no Google Agenda pelo computador (Outras agendas > Do URL). Se o link vazar, toque em Trocar o link.",
    palavras: "calendário assinar google agenda iphone link",
  },
  {
    icone: "medal",
    titulo: "Como ganho os emblemas?",
    texto:
      "Os emblemas comemoram a constância: meses seguidos batendo a meta, revisitas e estudos dirigidos no mês e dias no ministério. Cada um tem bronze, prata e ouro. Toque num emblema para ver quanto falta e compartilhar.",
    palavras: "emblema medalha bronze prata ouro conquista",
  },
  {
    icone: "car",
    titulo: "Para que serve a Quilometragem?",
    texto: "Anote as viagens do ministério (km e, se quiser, o gasto com combustível). O app soma o mês para você.",
    palavras: "km quilometragem viagem combustível gasto carro",
  },
  {
    icone: "paper-plane",
    titulo: "Como mando o relatório?",
    texto:
      "No Início (ou no Progresso, escolhendo o mês), toque em Enviar relatório. As horas vão em horas cheias e o que sobra fica para o mês seguinte. O relatório cai direto no seu grupo, para o dirigente e o secretário.",
    palavras: "relatório enviar mês grupo secretário",
  },
];

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** O Centro de Ajuda: as perguntas do dia a dia, com busca. */
export default function AjudaMinisterio() {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(ARTIGOS[0].titulo);
  const lista = useMemo(() => {
    const q = normal(busca.trim());
    return q ? ARTIGOS.filter((a) => normal(`${a.titulo} ${a.texto} ${a.palavras}`).includes(q)) : ARTIGOS;
  }, [busca]);

  return (
    <View style={styles.tela}>
      <Topo titulo="Centro de Ajuda" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.busca}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Como posso ajudar?"
            placeholderTextColor={colors.textMuted}
            style={styles.buscaCampo}
            returnKeyType="search"
            accessibilityLabel="Buscar na ajuda"
          />
        </View>
        {lista.length ? (
          <Vidro style={styles.lista}>
            {lista.map((a, i) => {
              const expandido = aberto === a.titulo || !!busca.trim();
              return (
                <View key={a.titulo} style={i > 0 && styles.borda}>
                  <Pressable
                    onPress={() => setAberto(expandido && !busca.trim() ? null : a.titulo)}
                    style={styles.pergunta}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: expandido }}
                  >
                    <View style={styles.icone}>
                      <Ionicons name={a.icone} size={17} color={colors.primaryDark} />
                    </View>
                    <Text style={styles.perguntaTexto}>{a.titulo}</Text>
                    <Ionicons name={expandido ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
                  </Pressable>
                  {expandido ? (
                    <Animated.View entering={FadeIn.duration(220)}>
                      <Text style={styles.resposta}>{a.texto}</Text>
                    </Animated.View>
                  ) : null}
                </View>
              );
            })}
          </Vidro>
        ) : (
          <Text style={styles.vazio}>Nada encontrado para “{busca.trim()}”.</Text>
        )}
        <Text style={styles.rodape}>Não achou? Fale com o secretário ou com quem cuida do app na congregação.</Text>
      </ScrollView>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1 },
    scroll: { paddingHorizontal: 16, gap: 14 },
    busca: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    buscaCampo: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
    lista: { padding: 0 },
    borda: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    pergunta: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
    icone: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.sand },
    perguntaTexto: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.text },
    resposta: { fontSize: 14.5, color: colors.textSecondary, lineHeight: 21, paddingHorizontal: 14, paddingBottom: 16, paddingLeft: 58 },
    vazio: { fontSize: 14.5, color: colors.textSecondary, textAlign: "center", paddingVertical: 20 },
    rodape: { fontSize: 12.5, color: colors.textMuted, textAlign: "center", paddingHorizontal: 20 },
  });
