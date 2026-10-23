import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Sheet } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { guardarAmbiente, HREF_AMBIENTE, type Ambiente } from "@/utils/ambiente";
import { MarcaServirMais } from "./MarcaServirMais";

/** A marca do Ministério: a folha num círculo esmeralda. Fixa, igual nos dois ambientes. */
export function MarcaMinisterio({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <LinearGradient
      colors={["#2FD3A4", "#0A7F61"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: tamanho, height: tamanho, borderRadius: tamanho * 0.32, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name="leaf" size={tamanho * 0.56} color="#FFFFFF" />
    </LinearGradient>
  );
}

const AMBIENTES: { chave: Ambiente; nome: string; tag: string }[] = [
  { chave: "servir", nome: "Servir Mais", tag: "Designações da congregação" },
  { chave: "ministerio", nome: "Ministério", tag: "Horas, contatos e agenda do pioneiro" },
];

/** Troca o app de ambiente e lembra a escolha para a próxima abertura. */
export function irParaAmbiente(a: Ambiente) {
  guardarAmbiente(a);
  // `replace`: o ambiente novo toma o lugar do antigo, e o voltar do Android sai do app em vez
  // de passear de um para o outro.
  router.replace(HREF_AMBIENTE[a]);
}

export function ListaAmbientes({ atual, onEscolher }: { atual: Ambiente; onEscolher: (a: Ambiente) => void }) {
  const { colors, styles } = useTema(criarEstilos);
  return (
    <View style={styles.lista}>
      {AMBIENTES.map((a) => {
        const ativo = a.chave === atual;
        return (
          <Pressable
            key={a.chave}
            onPress={() => onEscolher(a.chave)}
            style={({ pressed }) => [styles.linha, ativo && styles.linhaAtiva, pressed && styles.pressionado]}
            accessibilityRole="radio"
            accessibilityState={{ selected: ativo }}
          >
            {a.chave === "servir" ? <MarcaServirMais tamanho={36} /> : <MarcaMinisterio tamanho={36} />}
            <View style={styles.texto}>
              <Text style={styles.nome}>{a.nome}</Text>
              <Text style={styles.tag}>{a.tag}</Text>
            </View>
            {ativo ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : <Ionicons name="swap-horizontal" size={18} color={colors.textMuted} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A troca de ambiente dentro do Ministério (no Servir Mais ela abre no topo do menu lateral). */
export function TrocarAmbienteSheet({ visible, onClose, atual }: { visible: boolean; onClose: () => void; atual: Ambiente }) {
  const { styles } = useTema(criarEstilos);
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.folha}>
        <Text style={styles.titulo}>Trocar de ambiente</Text>
        <ListaAmbientes
          atual={atual}
          onEscolher={(a) => {
            onClose();
            if (a !== atual) irParaAmbiente(a);
          }}
        />
      </View>
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    lista: { gap: 8 },
    linha: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    linhaAtiva: { borderColor: colors.primary },
    pressionado: { opacity: 0.75 },
    texto: { flex: 1 },
    nome: { fontSize: 15.5, fontWeight: "800", color: colors.text },
    tag: { fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
    folha: { gap: 14, paddingBottom: 8 },
    titulo: { fontSize: 20, fontWeight: "800", color: colors.text },
  });
