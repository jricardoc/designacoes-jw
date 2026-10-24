import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useMapaTerritorios, useTerritorios } from "@/api/hooks/useTerritorios";
import type { Usuario } from "@/api/types";
import { BarraAmbiente, type AbaAmbiente } from "@/components/layout/BarraAmbiente";
import type { Icone } from "@/components/ministerio/kit";
import { Sheet, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { podeGerenciar, podeMarcarTerritorio } from "@/utils/permissoes";
import { useOndeEstou } from "./OndeEstou";
import { vidroTerritorio } from "./tema";

/** As abas: Mapa e Territórios são de todos; Saídas e Gerenciar, de quem tem a função. */
const ABAS: (AbaAmbiente & { pode?: (u: Usuario | null | undefined) => boolean })[] = [
  { chave: "index", rotulo: "Mapa", icone: "map-outline", iconeAtivo: "map", href: "/territorio" },
  { chave: "lista", rotulo: "Territórios", icone: "albums-outline", iconeAtivo: "albums", href: "/territorio/lista" },
  { chave: "saidas", rotulo: "Saídas", icone: "send-outline", iconeAtivo: "send", href: "/territorio/saidas", pode: (u) => podeGerenciar(u, "dirigentes") },
  { chave: "painel", rotulo: "Gerenciar", icone: "stats-chart-outline", iconeAtivo: "stats-chart", href: "/territorio/painel", pode: (u) => podeGerenciar(u, "territorios") },
];

type Acao = "marcar" | "saida" | "nao_bater";

const ATALHOS: { acao: Acao; rotulo: string; icone: Icone }[] = [
  { acao: "marcar", rotulo: "Marcar onde estou", icone: "location" },
  { acao: "saida", rotulo: "Registrar saída", icone: "checkmark-done" },
  { acao: "nao_bater", rotulo: "Anotar Não bater", icone: "hand-left" },
];

/** A barra do ambiente Território. O "+" (marcar, saída, Não bater) é de quem trabalha no campo. */
export function BarraTerritorio() {
  const { esquema } = useTema();
  const { usuario } = useAuth();
  const [acao, setAcao] = useState<Acao | null>(null);
  const campo = podeMarcarTerritorio(usuario);

  return (
    <>
      <BarraAmbiente
        tour="territorio"
        abas={ABAS.filter((a) => !a.pode || a.pode(usuario))}
        atalhos={campo ? ATALHOS.map((a) => ({ chave: a.acao, rotulo: a.rotulo, icone: a.icone, onPress: () => setAcao(a.acao) })) : []}
        vidro={vidroTerritorio(esquema)}
        rotuloMais="Adicionar: marcar onde estou, registrar saída ou Não bater"
      />
      {campo ? <EscolherTerritorioSheet acao={acao} onClose={() => setAcao(null)} /> : null}
    </>
  );
}

const TITULOS: Record<Acao, string> = {
  marcar: "Marcar em qual território?",
  saida: "Saída de qual território?",
  nao_bater: "Não bater em qual território?",
};

/** Sem acento e sem zero à esquerda: "joao" acha "João", e "7" acha o "07". */
const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^0+(?=\d)/, "");

/**
 * Qual território, antes do atalho: o de onde o irmão está (pelo GPS) em primeiro, e embaixo a
 * lista com busca. Escolhido, abre o território já na ação pedida (ou o Não bater dele).
 */
function EscolherTerritorioSheet({ acao, onClose }: { acao: Acao | null; onClose: () => void }) {
  const { colors, styles } = useTema(criarEstilos);
  const { data } = useTerritorios();
  const doBanco = data?.fonte === "banco";
  const { data: mapa } = useMapaTerritorios(doBanco);
  const aqui = useOndeEstou(mapa?.territorios, !!acao);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (acao) setBusca("");
  }, [acao]);

  const lista = useMemo(() => {
    const termo = normalizar(busca.trim());
    return (data?.territorios ?? []).filter(
      (t) => !termo || normalizar(t.numero).includes(termo) || normalizar(`${t.nome} ${t.apelidos ?? ""} ${t.area ?? ""}`).includes(termo),
    );
  }, [data, busca]);

  const escolher = (numero: string) => {
    const a = acao;
    onClose();
    // No iPhone a tela nova não consegue abrir a folha dela enquanto esta ainda está fechando.
    setTimeout(() => {
      if (a === "nao_bater") router.push({ pathname: "/territorio/nao-bater", params: { numero } });
      else if (a) router.push({ pathname: "/territorio/[numero]", params: { numero, acao: a } });
    }, Platform.OS === "ios" ? 400 : 0);
  };

  return (
    <Sheet visible={!!acao} onClose={onClose} scroll>
      <View style={styles.conteudo}>
        <Text style={styles.titulo}>{acao ? TITULOS[acao] : ""}</Text>
        {!doBanco ? (
          <Text style={styles.aviso}>Os territórios ainda não têm mapa. Isto funciona depois de importar os mapas do My Maps.</Text>
        ) : (
          <>
            {aqui ? (
              <Pressable
                onPress={() => escolher(aqui.numero)}
                style={({ pressed }) => [styles.aqui, pressed && styles.pressionado]}
                accessibilityRole="button"
                accessibilityLabel={`Você está no território ${aqui.numero}, ${aqui.nome}`}
              >
                <View style={styles.selo}>
                  <Ionicons name="navigate" size={10} color={colors.textOnPrimary} />
                  <Text style={styles.seloTexto}>Você está aqui</Text>
                </View>
                <View style={styles.linhaAqui}>
                  <Text style={styles.numero}>{aqui.numero}</Text>
                  <Text style={[styles.nome, styles.flex]} numberOfLines={1}>
                    {aqui.nome || `Território ${aqui.numero}`}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.orangeDark} />
                </View>
              </Pressable>
            ) : null}
            <TextField icon="search" placeholder="Número, nome ou rua..." value={busca} onChangeText={setBusca} autoCorrect={false} />
            {lista.map((t) => (
              <Pressable
                key={t.numero}
                onPress={() => escolher(t.numero)}
                style={({ pressed }) => [styles.linha, pressed && styles.pressionado]}
                accessibilityRole="button"
                accessibilityLabel={`Território ${t.numero}, ${t.nome}`}
              >
                <Text style={styles.numero}>{t.numero}</Text>
                <View style={styles.flex}>
                  <Text style={styles.nome} numberOfLines={1}>
                    {t.nome || `Território ${t.numero}`}
                  </Text>
                  {t.area ? (
                    <Text style={styles.area} numberOfLines={1}>
                      {t.area}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
            {lista.length === 0 ? <Text style={styles.aviso}>Nenhum território encontrado.</Text> : null}
          </>
        )}
      </View>
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    conteudo: { gap: 10, paddingBottom: 8 },
    titulo: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: 2 },
    aviso: { fontSize: 15, lineHeight: 21, color: colors.textSecondary },
    flex: { flex: 1 },
    pressionado: { opacity: 0.75 },
    aqui: { gap: 6, padding: 14, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.orange, backgroundColor: colors.surface },
    selo: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.orange,
    },
    seloTexto: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", color: colors.textOnPrimary },
    linhaAqui: { flexDirection: "row", alignItems: "baseline", gap: 10 },
    linha: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    numero: { minWidth: 34, fontSize: 18, fontWeight: "900", color: colors.text, fontVariant: ["tabular-nums"] },
    nome: { fontSize: 15.5, fontWeight: "700", color: colors.text },
    area: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  });
