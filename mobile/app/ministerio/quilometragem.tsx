import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApagarViagem, useViagens } from "@/api/hooks/usePioneiro";
import type { Viagem } from "@/api/types";
import { diaCurto } from "@/components/ministerio/escolhas";
import { BotaoIcone, entrada, maiuscula, MenuAcoes, mesAtual, Topo, Vidro } from "@/components/ministerio/kit";
import { ViagemSheet } from "@/components/ministerio/ViagemSheet";
import { Button, useToast } from "@/components/ui";
import { type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { nomeMes, somarMeses } from "@/utils/assistenciaMensal";
import { usePuxar } from "@/utils/usePuxar";

const km = (n: number) => String(n).replace(".", ",");
const reais = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

/** As viagens do ministério no mês: quilômetros, quantas e o gasto com combustível. */
export default function QuilometragemMinisterio() {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const atual = mesAtual();
  const [mes, setMes] = useState(atual);
  const { data: v, refetch } = useViagens(mes);
  const apagar = useApagarViagem();
  const puxar = usePuxar(refetch);
  const [nova, setNova] = useState(false);
  const [menu, setMenu] = useState<Viagem | null>(null);
  const nome = nomeMes(mes);

  return (
    <View style={styles.tela}>
      <Topo titulo="Quilometragem" direita={<BotaoIcone icone="add" rotulo="Registrar viagem" onPress={() => setNova(true)} />} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]} refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}>
        <View style={styles.meses}>
          <Pressable style={styles.seta} onPress={() => setMes(somarMeses(mes, -1))} hitSlop={6} accessibilityLabel="Mês anterior">
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.mesNome}>{maiuscula(nome)}</Text>
          <Pressable
            style={[styles.seta, mes >= atual && { opacity: 0.3 }]}
            onPress={() => setMes(somarMeses(mes, 1))}
            disabled={mes >= atual}
            hitSlop={6}
            accessibilityLabel="Próximo mês"
          >
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </Pressable>
        </View>

        <Animated.View entering={entrada(0)} style={styles.numeros}>
          <Vidro style={styles.numero}>
            <Ionicons name="speedometer" size={20} color={colors.teal} />
            <Text style={styles.numeroValor}>{km(v?.km ?? 0)}</Text>
            <Text style={styles.numeroRotulo}>km</Text>
          </Vidro>
          <Vidro style={styles.numero}>
            <Ionicons name="car" size={20} color={colors.primary} />
            <Text style={styles.numeroValor}>{v?.quantidade ?? 0}</Text>
            <Text style={styles.numeroRotulo}>{v?.quantidade === 1 ? "viagem" : "viagens"}</Text>
          </Vidro>
          <Vidro style={styles.numero}>
            <Ionicons name="water" size={20} color={colors.amber} />
            <Text style={[styles.numeroValor, styles.numeroMenor]}>{reais(v?.custo ?? 0)}</Text>
            <Text style={styles.numeroRotulo}>combustível</Text>
          </Vidro>
        </Animated.View>

        <Vidro style={styles.lista}>
          {v?.viagens.length ? (
            v.viagens.map((viagem, i) => (
              <Animated.View key={viagem.id} entering={entrada(i)}>
                <Pressable
                  onLongPress={() => setMenu(viagem)}
                  delayLongPress={350}
                  style={({ pressed }) => [styles.item, i > 0 && styles.itemBorda, pressed && { opacity: 0.7 }]}
                  accessibilityHint="Toque longo para apagar"
                >
                  <View style={styles.itemIcone}>
                    <Ionicons name="car-outline" size={18} color={colors.teal} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.itemTitulo}>
                      {km(viagem.km)} km{viagem.custo != null ? ` · ${reais(viagem.custo)}` : ""}
                    </Text>
                    <Text style={styles.itemDetalhe}>{[diaCurto(viagem.data), viagem.nota].filter(Boolean).join(" · ")}</Text>
                  </View>
                </Pressable>
              </Animated.View>
            ))
          ) : (
            <Text style={styles.vazio}>Nenhuma viagem neste mês.</Text>
          )}
        </Vidro>
        <Button label="Registrar viagem" icon="add" onPress={() => setNova(true)} fullWidth />
      </ScrollView>

      <ViagemSheet visible={nova} onClose={() => setNova(false)} />
      <MenuAcoes
        visible={!!menu}
        onClose={() => setMenu(null)}
        titulo={menu ? `${km(menu.km)} km` : null}
        subtitulo={menu ? diaCurto(menu.data) : null}
        acoes={[
          {
            rotulo: "Apagar viagem",
            icone: "trash-outline",
            perigo: true,
            onPress: () => {
              if (!menu) return;
              apagar.mutate(menu.id, {
                onSuccess: () => toast.show("Viagem apagada"),
                onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu", "error"),
              });
            },
          },
        ]}
      />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1 },
    scroll: { paddingHorizontal: 16, gap: 14 },
    flex: { flex: 1 },
    meses: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    seta: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mesNome: { fontSize: 19, fontWeight: "900", color: colors.text },
    numeros: { flexDirection: "row", gap: 10 },
    numero: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 14, paddingHorizontal: 8 },
    numeroValor: { fontSize: 24, fontWeight: "900", color: colors.text, marginTop: 4 },
    numeroMenor: { fontSize: 17 },
    numeroRotulo: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
    lista: { padding: 0 },
    item: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
    itemBorda: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    itemIcone: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.tealBg },
    itemTitulo: { fontSize: 15.5, fontWeight: "800", color: colors.text },
    itemDetalhe: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
    vazio: { fontSize: 14, color: colors.textSecondary, textAlign: "center", padding: 18 },
  });
