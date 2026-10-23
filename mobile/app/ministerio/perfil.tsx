import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAtualizarPerfilPioneiro, usePainelPioneiro } from "@/api/hooks/usePioneiro";
import { irParaAmbiente } from "@/components/layout/Ambientes";
import { CartaoCalendario } from "@/components/ministerio/Calendario";
import { Contador } from "@/components/ministerio/escolhas";
import { mesAtual, Topo, Vidro, type Icone } from "@/components/ministerio/kit";
import { Avatar, Button, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { radius, type Cores } from "@/theme";
import { useTema, type TemaPreferido } from "@/theme/TemaContext";

const TEMAS: { valor: TemaPreferido; rotulo: string; icone: Icone }[] = [
  { valor: "claro", rotulo: "Claro", icone: "sunny-outline" },
  { valor: "escuro", rotulo: "Escuro", icone: "moon-outline" },
  { valor: "sistema", rotulo: "Sistema", icone: "phone-portrait-outline" },
];

/** Perfil e configurações do Ministério: meta, privacidade dos planos, calendário e aparência. */
export default function PerfilMinisterio() {
  const { colors, styles, tema, setTema } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { usuario } = useAuth();
  const { data: p } = usePainelPioneiro(mesAtual());
  const atualizar = useAtualizarPerfilPioneiro();
  const [meta, setMeta] = useState(50);
  const [compartilhar, setCompartilhar] = useState(true);

  useEffect(() => {
    if (!p) return;
    setMeta(p.meta);
    setCompartilhar(p.compartilharPlanos);
  }, [p]);

  const salvar = (body: { metaMensal?: number; compartilharPlanos?: boolean }, aviso: string) =>
    atualizar.mutate(body, {
      onSuccess: () => toast.show(aviso),
      onError: (e) => {
        toast.show(e instanceof Error ? e.message : "Não deu para salvar", "error");
        if (p) setCompartilhar(p.compartilharPlanos);
      },
    });

  return (
    <View style={styles.tela}>
      <Topo titulo="Perfil" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
        {usuario ? (
          <View style={styles.cabeca}>
            <View style={styles.avatar}>
              <Avatar usuario={usuario} tamanho={84} fundo={colors.sand} corTexto={colors.primaryDark} />
            </View>
            <Text style={styles.nome}>{usuario.nome}</Text>
            <Text style={styles.sub}>{p?.regular === false ? "Usando como pioneiro auxiliar" : "Pioneiro regular"}</Text>
          </View>
        ) : null}

        <Vidro style={styles.cartao}>
          <Text style={styles.titulo}>Meta de horas por mês</Text>
          <Text style={styles.texto}>O ano de serviço usa 12 vezes esta meta.</Text>
          <View style={styles.centro}>
            <Contador valor={meta} onMudar={setMeta} min={5} max={200} passo={5} rotulo="horas por mês" />
          </View>
          {p && meta !== p.meta ? (
            <Button label={`Salvar ${meta} h por mês`} onPress={() => salvar({ metaMensal: meta }, "Meta atualizada")} loading={atualizar.isPending} fullWidth />
          ) : null}
        </Vidro>

        <Vidro style={styles.cartao}>
          <View style={styles.linhaSwitch}>
            <View style={styles.flex}>
              <Text style={styles.titulo}>Mostrar meus planos de saída</Text>
              <Text style={styles.texto}>Os outros pioneiros veem na agenda deles quando você vai sair (só o primeiro nome).</Text>
            </View>
            <Switch
              value={compartilhar}
              onValueChange={(v) => {
                setCompartilhar(v);
                salvar({ compartilharPlanos: v }, v ? "Seus planos aparecem para os pioneiros" : "Seus planos ficam só com você");
              }}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </Vidro>

        <CartaoCalendario />

        <Vidro style={styles.cartao}>
          <Text style={styles.titulo}>Aparência</Text>
          <View style={styles.temas}>
            {TEMAS.map((t) => {
              const ativo = t.valor === tema;
              return (
                <Pressable
                  key={t.valor}
                  onPress={() => setTema(t.valor)}
                  style={[styles.temaOpcao, ativo && styles.temaAtivo]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ativo }}
                >
                  <Ionicons name={t.icone} size={18} color={ativo ? colors.textOnPrimary : colors.textSecondary} />
                  <Text style={[styles.temaTexto, ativo && { color: colors.textOnPrimary }]}>{t.rotulo}</Text>
                </Pressable>
              );
            })}
          </View>
        </Vidro>

        <Vidro style={styles.lista}>
          <Linha icone="help-buoy-outline" rotulo="Centro de Ajuda" onPress={() => router.push("/ministerio/ajuda")} />
          <Linha icone="sparkles-outline" rotulo="Novidades" onPress={() => router.push("/ministerio/novidades")} />
          <Linha icone="swap-horizontal" rotulo="Ir para o Servir Mais" onPress={() => irParaAmbiente("servir")} />
        </Vidro>
      </ScrollView>
    </View>
  );
}

function Linha({ icone, rotulo, onPress }: { icone: Icone; rotulo: string; onPress: () => void }) {
  const { colors, styles } = useTema(criarEstilos);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.linha, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <View style={styles.linhaIcone}>
        <Ionicons name={icone} size={18} color={colors.primaryDark} />
      </View>
      <Text style={styles.linhaTexto}>{rotulo}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1 },
    scroll: { paddingHorizontal: 16, gap: 14 },
    flex: { flex: 1 },
    centro: { alignItems: "center" },
    cabeca: { alignItems: "center", gap: 4, paddingVertical: 6 },
    avatar: { borderRadius: 46, borderWidth: 3, borderColor: colors.primary, padding: 2, marginBottom: 6 },
    nome: { fontSize: 22, fontWeight: "900", color: colors.text },
    sub: { fontSize: 14, color: colors.textSecondary },
    cartao: { gap: 10 },
    titulo: { fontSize: 16, fontWeight: "800", color: colors.text },
    texto: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 19 },
    linhaSwitch: { flexDirection: "row", alignItems: "center", gap: 12 },
    temas: { flexDirection: "row", gap: 8 },
    temaOpcao: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    temaAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    temaTexto: { fontSize: 13.5, fontWeight: "800", color: colors.textSecondary },
    lista: { paddingVertical: 4, paddingHorizontal: 14 },
    linha: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
    linhaIcone: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: colors.sand },
    linhaTexto: { flex: 1, fontSize: 15.5, fontWeight: "700", color: colors.text },
  });
