import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import type { ComponentType } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Sheet } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { guardarAmbiente, HREF_AMBIENTE, type Ambiente } from "@/utils/ambiente";
import { podeUsarPioneiro } from "@/utils/permissoes";
import { MarcaServirMais } from "./MarcaServirMais";

/** A marca do Ministério: a folha num círculo esmeralda. Fixa, igual em todos os ambientes. */
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

/** A marca do Território: o mapa num quadrado azul. Fixa, igual em todos os ambientes. */
export function MarcaTerritorio({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <LinearGradient
      colors={["#3381E6", "#164A96"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: tamanho, height: tamanho, borderRadius: tamanho * 0.32, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name="map" size={tamanho * 0.54} color="#FFFFFF" />
    </LinearGradient>
  );
}

const AMBIENTES: { chave: Ambiente; nome: string; tag: string; Marca: ComponentType<{ tamanho?: number }> }[] = [
  { chave: "servir", nome: "Servir Mais", tag: "Designações da congregação", Marca: MarcaServirMais },
  { chave: "ministerio", nome: "Ministério", tag: "Horas, contatos e agenda do pioneiro", Marca: MarcaMinisterio },
  { chave: "territorio", nome: "Território", tag: "Mapas, saídas e onde paramos", Marca: MarcaTerritorio },
];

/** Troca o app de ambiente e lembra a escolha para a próxima abertura. */
export function irParaAmbiente(a: Ambiente) {
  // O Território se guarda sozinho, e só para quem trabalha nele (app/territorio/_layout).
  if (a !== "territorio") guardarAmbiente(a);
  // `dismissTo`: o ambiente novo toma o lugar do antigo, e o voltar do Android sai do app em
  // vez de passear de um para o outro. Se ele já está embaixo (o Servir Mais, quando o
  // Território foi aberto pelo menu), volta para ele em vez de montar um segundo.
  router.dismissTo(HREF_AMBIENTE[a]);
}

export function ListaAmbientes({ atual, onEscolher }: { atual: Ambiente; onEscolher: (a: Ambiente) => void }) {
  const { colors, styles } = useTema(criarEstilos);
  const { usuario } = useAuth();
  // O Território é de todos; o Ministério, só de quem é pioneiro.
  const disponiveis = AMBIENTES.filter((a) => a.chave !== "ministerio" || podeUsarPioneiro(usuario));
  return (
    <View style={styles.lista}>
      {disponiveis.map((a) => {
        const ativo = a.chave === atual;
        return (
          <Pressable
            key={a.chave}
            onPress={() => onEscolher(a.chave)}
            style={({ pressed }) => [styles.linha, ativo && styles.linhaAtiva, pressed && styles.pressionado]}
            accessibilityRole="radio"
            accessibilityState={{ selected: ativo }}
          >
            <a.Marca tamanho={36} />
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

/** A troca de ambiente no Ministério e no Território (no Servir Mais ela abre no topo do menu lateral). */
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
