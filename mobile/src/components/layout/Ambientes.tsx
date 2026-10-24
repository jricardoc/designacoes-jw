import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import type { ComponentType } from "react";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sheet } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { alvoTour, iniciarTour } from "@/tour/estado";
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

/** A marca do Estudo pessoal: o livro num quadrado vinho. Fixa, igual em todos os ambientes. */
export function MarcaEstudo({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <LinearGradient
      colors={["#B5506E", "#6E2239"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: tamanho, height: tamanho, borderRadius: tamanho * 0.32, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name="book" size={tamanho * 0.52} color="#FFFFFF" />
    </LinearGradient>
  );
}

export const AMBIENTES: { chave: Ambiente; nome: string; tag: string; Marca: ComponentType<{ tamanho?: number }> }[] = [
  { chave: "servir", nome: "Servir Mais", tag: "Designações da congregação", Marca: MarcaServirMais },
  { chave: "ministerio", nome: "Ministério", tag: "Horas, contatos e agenda do pioneiro", Marca: MarcaMinisterio },
  { chave: "territorio", nome: "Território", tag: "Mapas, saídas e onde paramos", Marca: MarcaTerritorio },
  { chave: "estudo", nome: "Estudo pessoal", tag: "Leitura da Bíblia e estudo", Marca: MarcaEstudo },
];

/** Troca o app de ambiente e lembra a escolha para a próxima abertura. */
export function irParaAmbiente(a: Ambiente) {
  guardarAmbiente(a);
  // `dismissTo`: o ambiente novo toma o lugar do antigo, e o voltar do Android sai do app em
  // vez de passear de um para o outro. Se ele já está embaixo, volta para ele em vez de
  // montar um segundo.
  router.dismissTo(HREF_AMBIENTE[a]);
}

export function ListaAmbientes({ atual, onEscolher }: { atual: Ambiente; onEscolher: (a: Ambiente) => void }) {
  const { colors, styles } = useTema(criarEstilos);
  const { usuario } = useAuth();
  // O Território e o Estudo pessoal são de todos; o Ministério, só de quem é pioneiro.
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

/**
 * O topo das abas do Território e do Estudo pessoal: a marca, que troca de ambiente (é por ela
 * que se volta ao Servir Mais). Em cima do mapa vira uma pílula, para não sumir nas ruas.
 */
export function CabecalhoAmbiente({ atual, sobreOMapa }: { atual: "territorio" | "estudo"; sobreOMapa?: boolean }) {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const [trocar, setTrocar] = useState(false);
  const a = AMBIENTES.find((x) => x.chave === atual)!;

  return (
    <View style={[styles.cabecalho, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
      <Pressable
        ref={alvoTour(`${atual}.marca`)}
        collapsable={false}
        onPress={() => setTrocar(true)}
        style={({ pressed }) => [styles.marca, sobreOMapa && styles.pilula, pressed && styles.pressionado]}
        accessibilityRole="button"
        accessibilityLabel={`${a.nome}. Trocar de ambiente`}
      >
        <a.Marca tamanho={28} />
        <Text style={styles.marcaNome}>{a.nome}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
      </Pressable>
      <TrocarAmbienteSheet visible={trocar} onClose={() => setTrocar(false)} atual={atual} />
    </View>
  );
}

/** A troca de ambiente, pela marca no topo de cada um (no Servir Mais, a da barra de cima). */
export function TrocarAmbienteSheet({ visible, onClose, atual }: { visible: boolean; onClose: () => void; atual: Ambiente }) {
  const { colors, styles } = useTema(criarEstilos);
  const { usuario } = useAuth();
  const nome = AMBIENTES.find((a) => a.chave === atual)?.nome ?? "";
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
        {/* O tutorial deste ambiente, de novo (começa depois de a folha fechar). */}
        <Pressable
          onPress={() => {
            onClose();
            setTimeout(() => iniciarTour(atual, usuario), 450);
          }}
          style={({ pressed }) => [styles.tutorial, pressed && styles.pressionado]}
          accessibilityRole="button"
        >
          <Ionicons name="school-outline" size={18} color={colors.primary} />
          <Text style={styles.tutorialTexto}>Ver o tutorial do {nome}</Text>
        </Pressable>
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
    tutorial: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10 },
    tutorialTexto: { fontSize: 15, fontWeight: "700", color: colors.primary },
    titulo: { fontSize: 20, fontWeight: "800", color: colors.text },
    cabecalho: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 6 },
    marca: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, paddingRight: 6 },
    pilula: { paddingLeft: 6, paddingRight: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface, ...shadow.card },
    marcaNome: { fontSize: 17, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  });
