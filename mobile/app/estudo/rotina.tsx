import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { RotinaEstudo } from "@/api/types";
import { CarregandoOuErro, Cartao, LinkFonte, useLeitura } from "@/components/estudo/comum";
import { DICAS_ROTINA, FONTES, TIPOS_ROTINA } from "@/components/estudo/dicas";
import { PlanoBSheet, RotinaSheet } from "@/components/estudo/folhas";
import { CabecalhoAmbiente } from "@/components/layout/Ambientes";
import { TituloTela, useRecuo } from "@/components/ministerio/kit";
import { Button } from "@/components/ui";
import { getNotifEnabled } from "@/notifications/notifPref";
import { MESES, radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { usePuxar } from "@/utils/usePuxar";

const CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** [1,2,3,4,5] -> "Seg a Sex"; [2,4] -> "Ter e Qui"; os 7 -> "Todos os dias". */
function textoDosDias(dias: number[]) {
  if (dias.length === 7) return "Todos os dias";
  const seguidos = dias.length > 2 && dias.every((d, i) => i === 0 || d === dias[i - 1] + 1);
  if (seguidos) return `${CURTOS[dias[0]]} a ${CURTOS[dias[dias.length - 1]]}`;
  const nomes = dias.map((d) => CURTOS[d]);
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes[0];
}

const textoDoAviso = (r: RotinaEstudo) =>
  r.avisoMin === null ? "Sem aviso" : r.avisoMin === 0 ? "Aviso na hora" : r.avisoMin === 60 ? "Aviso 1 h antes" : `Aviso ${r.avisoMin} min antes`;

/**
 * A Rotina: a programação de leitura e de estudo (com o aviso no celular pouco antes, como
 * sugere A Sentinela), o plano B da leitura e o mês com os dias de leitura e de estudo.
 */
export default function RotinaEstudoTela() {
  const { colors, styles } = useTema(criarEstilos);
  const recuo = useRecuo();
  const { estado, isLoading, refetch } = useLeitura();
  const puxar = usePuxar(refetch);
  const [folha, setFolha] = useState<{ item?: RotinaEstudo } | null>(null);
  const [planoB, setPlanoB] = useState(false);
  const [avisosLigados, setAvisosLigados] = useState(true);
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() };
  });

  useEffect(() => {
    getNotifEnabled().then(setAvisosLigados).catch(() => {});
  }, []);

  const dias = useMemo(
    () => ({ leitura: new Set(estado?.leituras.map((l) => l.dia)), estudo: new Set(estado?.sessoes.map((s) => s.dia)) }),
    [estado],
  );

  if (!estado) {
    return (
      <View style={styles.tela}>
        <CabecalhoAmbiente atual="estudo" />
        <CarregandoOuErro carregando={isLoading} tentar={() => refetch()} />
      </View>
    );
  }

  // O mês em grade, de domingo a sábado.
  const primeiro = new Date(mes.ano, mes.mes, 1);
  const total = new Date(mes.ano, mes.mes + 1, 0).getDate();
  const celulas = [...Array(primeiro.getDay()).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const iso = (d: number) => `${mes.ano}-${String(mes.mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const andar = (n: number) => setMes((m) => ({ ano: m.mes + n < 0 ? m.ano - 1 : m.mes + n > 11 ? m.ano + 1 : m.ano, mes: (m.mes + n + 12) % 12 }));
  const leuNoMes = Array.from({ length: total }, (_, i) => iso(i + 1)).filter((d) => dias.leitura.has(d)).length;
  const estudouNoMes = Array.from({ length: total }, (_, i) => iso(i + 1)).filter((d) => dias.estudo.has(d)).length;

  return (
    <View style={styles.tela}>
      <CabecalhoAmbiente atual="estudo" />
      <ScrollView contentContainerStyle={[styles.scroll, recuo]} refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}>
        <TituloTela titulo="Rotina" subtitulo="Faça uma programação, e seja flexível" />

        {!avisosLigados ? (
          <Cartao style={[styles.linha, styles.aviso]}>
            <Ionicons name="notifications-off-outline" size={20} color={colors.amber} />
            <Text style={[styles.texto, styles.flex]}>Os avisos estão desligados neste celular. Ligue nos Ajustes do app para receber os lembretes.</Text>
          </Cartao>
        ) : null}

        <Cartao style={styles.gap}>
          <Text style={styles.titulo}>Minha programação</Text>
          {estado.rotina.length ? (
            estado.rotina.map((r) => (
              <Pressable key={r.id} onPress={() => setFolha({ item: r })} style={({ pressed }) => [styles.item, pressed && styles.pressionado]} accessibilityRole="button">
                <View style={styles.icone}>
                  <Ionicons name={TIPOS_ROTINA[r.tipo].icone} size={18} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.itemTitulo}>{TIPOS_ROTINA[r.tipo].rotulo}</Text>
                  <Text style={styles.itemDetalhe}>
                    {textoDosDias(r.dias)} · {r.hora} · {textoDoAviso(r)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))
          ) : (
            <Text style={styles.texto}>Nada na programação ainda. Marque os dias e a hora da leitura e do estudo, e o celular avisa pouco antes.</Text>
          )}
          <Button label="Adicionar à rotina" icon="add" variant="secondary" onPress={() => setFolha({})} fullWidth />
        </Cartao>

        <Cartao style={styles.gap}>
          <View style={styles.linha}>
            <Text style={[styles.titulo, styles.flex]}>Plano B da leitura</Text>
            <Text style={styles.acao} onPress={() => setPlanoB(true)} accessibilityRole="button">
              {estado.perfil.planoB ? `Às ${estado.perfil.planoB}` : "Definir"}
            </Text>
          </View>
          <Text style={styles.texto}>
            Se até essa hora não houver leitura no dia, o celular lembra. Assim nenhum dia passa sem a leitura da Bíblia.
          </Text>
          <LinkFonte fonte={FONTES.todoDia} />
        </Cartao>

        <Cartao style={styles.gap}>
          <View style={styles.linha}>
            <Pressable onPress={() => andar(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Mês anterior">
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Text style={[styles.titulo, styles.flex, styles.centro]}>
              {MESES[mes.mes + 1]} de {mes.ano}
            </Text>
            <Pressable onPress={() => andar(1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Próximo mês">
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.grade}>
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <Text key={`c${i}`} style={styles.semanaNome}>
                {d}
              </Text>
            ))}
            {celulas.map((d, i) =>
              d === null ? (
                <View key={`v${i}`} style={styles.celula} />
              ) : (
                <View key={d} style={[styles.celula, iso(d) === estado.hoje && styles.hoje]}>
                  <Text style={[styles.numero, iso(d) === estado.hoje && styles.hojeTexto]}>{d}</Text>
                  <View style={styles.pontos}>
                    {dias.leitura.has(iso(d)) ? <View style={[styles.ponto, { backgroundColor: colors.amber }]} /> : null}
                    {dias.estudo.has(iso(d)) ? <View style={[styles.ponto, { backgroundColor: colors.primary }]} /> : null}
                  </View>
                </View>
              ),
            )}
          </View>
          <View style={styles.linha}>
            <View style={[styles.ponto, { backgroundColor: colors.amber }]} />
            <Text style={styles.legenda}>Leitura em {leuNoMes} dias</Text>
            <View style={[styles.ponto, { backgroundColor: colors.primary }]} />
            <Text style={styles.legenda}>Estudo em {estudouNoMes} dias</Text>
          </View>
        </Cartao>

        <Text style={styles.secao}>Dicas</Text>
        {DICAS_ROTINA.map((d) => (
          <Cartao key={d.texto} style={styles.gap}>
            <Text style={styles.dica}>{d.texto}</Text>
            <LinkFonte fonte={d.fonte} />
          </Cartao>
        ))}
      </ScrollView>

      <RotinaSheet visible={!!folha} onClose={() => setFolha(null)} item={folha?.item} />
      <PlanoBSheet visible={planoB} onClose={() => setPlanoB(false)} perfil={estado.perfil} />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingHorizontal: 16, gap: 12 },
    flex: { flex: 1 },
    gap: { gap: 10 },
    pressionado: { opacity: 0.7 },
    linha: { flexDirection: "row", alignItems: "center", gap: 8 },
    aviso: { backgroundColor: colors.warningBg },
    titulo: { fontSize: 16.5, fontWeight: "800", color: colors.text },
    centro: { textAlign: "center" },
    texto: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
    acao: { fontSize: 14.5, fontWeight: "800", color: colors.primary },
    secao: { fontSize: 13, fontWeight: "800", letterSpacing: 0.6, color: colors.textMuted, marginTop: 6, textTransform: "uppercase" },
    dica: { fontSize: 14.5, lineHeight: 21, color: colors.text },
    item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
    icone: { width: 36, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.infoBg },
    itemTitulo: { fontSize: 15, fontWeight: "800", color: colors.text },
    itemDetalhe: { fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
    grade: { flexDirection: "row", flexWrap: "wrap" },
    semanaNome: { width: `${100 / 7}%`, textAlign: "center", fontSize: 12, fontWeight: "800", color: colors.textMuted, paddingBottom: 4 },
    celula: { width: `${100 / 7}%`, height: 46, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: radius.sm },
    hoje: { borderWidth: 2, borderColor: colors.primary },
    numero: { fontSize: 14.5, fontWeight: "700", color: colors.text },
    hojeTexto: { color: colors.primary, fontWeight: "900" },
    pontos: { flexDirection: "row", gap: 3, height: 6 },
    ponto: { width: 6, height: 6, borderRadius: 3 },
    legenda: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, marginRight: 8 },
  });
