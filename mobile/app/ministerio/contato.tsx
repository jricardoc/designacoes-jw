import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRevisita } from "@/api/hooks/usePioneiro";
import type { TipoVisita } from "@/api/types";
import { useAcoesContato } from "@/components/ministerio/acoesContato";
import { diaCurto, isoDoDia } from "@/components/ministerio/escolhas";
import {
  BotaoIcone,
  dataLonga,
  digitosDe,
  horaDe,
  linkComoChegar,
  MenuAcoes,
  quandoRelativo,
  SITUACAO,
  situacaoDe,
  TIPO_VISITA,
  Topo,
  Vidro,
  whatsappDe,
} from "@/components/ministerio/kit";
import { RevisitaSheet } from "@/components/ministerio/RevisitaSheet";
import { VisitaSheet } from "@/components/ministerio/VisitaSheet";
import { Button, EmptyState, iniciais, Loading, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { usePuxar } from "@/utils/usePuxar";

/** Um contato: a próxima visita em destaque, como chegar, as notas e a linha do tempo das visitas. */
export default function ContatoMinisterio() {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data: r, isLoading, refetch } = useRevisita(id);
  const puxar = usePuxar(refetch);
  const acoesDe = useAcoesContato();
  const [menu, setMenu] = useState(false);
  const [editando, setEditando] = useState(false);
  const [tipoVisita, setTipoVisita] = useState<TipoVisita | null>(null);

  if (isLoading && !r) {
    return (
      <View style={styles.tela}>
        <Topo />
        <Loading label="Carregando..." />
      </View>
    );
  }
  if (!r) {
    return (
      <View style={styles.tela}>
        <Topo titulo="Contato" />
        <EmptyState icon="cloud-offline-outline" title="Não deu para carregar" message="Volte e tente de novo." />
      </View>
    );
  }

  const s = situacaoDe(r.proximaVisita);
  const cor = SITUACAO[s].cor(colors);
  const abrir = (url: string) => Linking.openURL(url).catch(() => toast.show("Não consegui abrir", "error"));
  const rota = linkComoChegar(r);
  const zap = whatsappDe(r.telefone);
  const tel = digitosDe(r.telefone);
  const registrar = (t?: TipoVisita) => setTipoVisita(t ?? (r.estudo ? "estudo" : "conversa"));

  return (
    <View style={styles.tela}>
      <Topo direita={<BotaoIcone icone="ellipsis-horizontal" rotulo="Mais ações" onPress={() => setMenu(true)} />} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]} refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}>
        <Animated.View entering={FadeInDown.duration(380)} style={styles.cabeca}>
          <LinearGradient colors={[cor, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Text style={styles.avatarTexto}>{iniciais(r.nome)}</Text>
          </LinearGradient>
          <Text style={styles.nome}>{r.nome}</Text>
          <View style={styles.etiquetas}>
            <View style={[styles.etiqueta, { backgroundColor: r.estudo ? colors.infoBg : colors.sand }]}>
              <Ionicons name={r.estudo ? "book" : "person"} size={13} color={r.estudo ? colors.purple : colors.primaryDark} />
              <Text style={[styles.etiquetaTexto, { color: r.estudo ? colors.purple : colors.primaryDark }]}>{r.estudo ? "Estudo bíblico" : "Revisita"}</Text>
            </View>
            {!r.ativa ? (
              <View style={[styles.etiqueta, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="archive" size={13} color={colors.textSecondary} />
                <Text style={[styles.etiquetaTexto, { color: colors.textSecondary }]}>Arquivado</Text>
              </View>
            ) : null}
          </View>
          {r.endereco ? <Text style={styles.endereco}>{r.endereco}</Text> : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(70).duration(380)}>
          <Vidro style={styles.seguir}>
            <Text style={[styles.seguirRotulo, { color: cor }]}>
              {r.proximaVisita ? `A seguir · ${quandoRelativo(r.proximaVisita)}` : "Nenhuma visita marcada"}
            </Text>
            {r.proximaVisita ? (
              <Text style={styles.seguirData}>
                {dataLonga(new Date(r.proximaVisita))}
                <Text style={styles.seguirHora}> às {horaDe(r.proximaVisita)}</Text>
              </Text>
            ) : (
              <Text style={styles.texto}>Marque a próxima ao registrar a visita.</Text>
            )}
            {r.ativa ? <Button label="Registrar a visita" icon="checkmark-done" onPress={() => registrar()} fullWidth /> : null}
            <View style={styles.atalhos}>
              {rota ? <Atalho icone="navigate" rotulo="Navegar" onPress={() => abrir(rota)} /> : null}
              {zap ? <Atalho icone="logo-whatsapp" rotulo="WhatsApp" onPress={() => abrir(zap)} /> : null}
              {tel ? <Atalho icone="call" rotulo="Ligar" onPress={() => abrir(`tel:${tel}`)} /> : null}
              {r.ativa ? <Atalho icone="home-outline" rotulo="Não em casa" onPress={() => registrar("nao_em_casa")} /> : null}
            </View>
          </Vidro>
        </Animated.View>

        {r.observacao ? (
          <Animated.View entering={FadeInDown.delay(120).duration(380)}>
            <Vidro style={styles.cartao}>
              <Text style={styles.rotulo}>Notas</Text>
              <Text style={styles.texto}>{r.observacao}</Text>
            </Vidro>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(170).duration(380)}>
          <Text style={styles.secao}>Linha do tempo</Text>
          {r.visitas.length ? (
            <View style={styles.linhaTempo}>
              {r.visitas.map((v, i) => {
                const t = TIPO_VISITA[v.tipo] ?? TIPO_VISITA.conversa;
                const corT = t.cor(colors);
                const ultimo = i === r.visitas.length - 1;
                return (
                  <View key={v.id} style={styles.marco}>
                    <View style={styles.trilhaCol}>
                      <View style={[styles.bolinha, { backgroundColor: corT }]}>
                        <Ionicons name={t.icone} size={13} color="#FFFFFF" />
                      </View>
                      {!ultimo ? <View style={styles.trilha} /> : null}
                    </View>
                    <View style={[styles.marcoCorpo, !ultimo && { paddingBottom: 18 }]}>
                      <Text style={styles.marcoTitulo}>
                        {t.rotulo === "Conversei" ? "Conversa" : t.rotulo}
                        <Text style={styles.marcoData}>
                          {"  "}
                          {diaCurto(isoDoDia(new Date(v.data)))} · {horaDe(v.data)}
                        </Text>
                      </Text>
                      {v.observacao ? <Text style={styles.texto}>{v.observacao}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.texto}>Nenhuma visita registrada ainda.</Text>
          )}
        </Animated.View>
      </ScrollView>

      <MenuAcoes
        visible={menu}
        onClose={() => setMenu(false)}
        titulo={r.nome}
        acoes={acoesDe(r, { registrar: () => registrar(), editar: () => setEditando(true), aposApagar: () => router.back() })}
      />
      <VisitaSheet revisitaId={tipoVisita ? r.id : null} nome={r.nome} tipo={tipoVisita ?? undefined} onClose={() => setTipoVisita(null)} />
      <RevisitaSheet visible={editando} revisita={r} onClose={() => setEditando(false)} />
    </View>
  );
}

function Atalho({ icone, rotulo, onPress }: { icone: keyof typeof Ionicons.glyphMap; rotulo: string; onPress: () => void }) {
  const { colors, styles } = useTema(criarEstilos);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.atalho, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={rotulo}>
      <View style={styles.atalhoIcone}>
        <Ionicons name={icone} size={19} color={colors.primaryDark} />
      </View>
      <Text style={styles.atalhoTexto}>{rotulo}</Text>
    </Pressable>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1 },
    scroll: { paddingHorizontal: 16, gap: 16 },
    cabeca: { alignItems: "center", gap: 8, paddingTop: 4 },
    avatar: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.surface },
    avatarTexto: { fontSize: 30, fontWeight: "900", color: "#FFFFFF" },
    nome: { fontSize: 26, fontWeight: "900", color: colors.text, textAlign: "center", letterSpacing: -0.6 },
    etiquetas: { flexDirection: "row", gap: 6 },
    etiqueta: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
    etiquetaTexto: { fontSize: 12.5, fontWeight: "800" },
    endereco: { fontSize: 14, color: colors.textSecondary, textAlign: "center" },
    seguir: { gap: 12 },
    seguirRotulo: { fontSize: 12.5, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
    seguirData: { fontSize: 20, fontWeight: "900", color: colors.text, marginTop: -4 },
    seguirHora: { fontSize: 17, fontWeight: "700", color: colors.textSecondary },
    atalhos: { flexDirection: "row", justifyContent: "space-around" },
    atalho: { alignItems: "center", gap: 4, minWidth: 64 },
    atalhoIcone: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: colors.sand },
    atalhoTexto: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
    cartao: { gap: 6 },
    rotulo: { fontSize: 13, fontWeight: "800", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 },
    texto: { fontSize: 14.5, color: colors.textSecondary, lineHeight: 21 },
    secao: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 12 },
    linhaTempo: { paddingLeft: 2 },
    marco: { flexDirection: "row", gap: 12 },
    trilhaCol: { alignItems: "center", width: 28 },
    bolinha: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
    trilha: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
    marcoCorpo: { flex: 1, gap: 4, paddingTop: 4 },
    marcoTitulo: { fontSize: 15, fontWeight: "800", color: colors.text },
    marcoData: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  });
