import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown, LinearTransition, ZoomIn } from "react-native-reanimated";
import {
  useMapaTerritorios,
  useRemoverLimite,
  useSalvarArea,
  useSalvarLimite,
  useTerritorios,
} from "@/api/hooks/useTerritorios";
import type { TerritorioResumo } from "@/api/types";
import { Button, Sheet, TextField, useToast } from "@/components/ui";
import { radius, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { PALETA_AREAS } from "@/territorios/constantes";

const porNumero = (a: TerritorioResumo, b: TerritorioResumo) =>
  a.numero.localeCompare(b.numero, "pt-BR", { numeric: true });

interface AreaEditada {
  /** Nome atual; null = área nova. */
  de: string | null;
  nome: string;
  cor: string;
  numeros: string[];
}

/**
 * As áreas que agrupam a lista e pintam o mapa geral ("Tokaia", "KM 17"...). Tocar numa área
 * abre o editor: nome, cor e quais territórios. Um território fica em UMA área só — o de outra
 * área aparece apagado no editor até sair de lá.
 */
export function AreasTerritorios() {
  const { colors, styles } = useTema(criarEstilos);
  const { data } = useTerritorios();
  const [editando, setEditando] = useState<AreaEditada | null>(null);

  const todos = useMemo(() => (data?.territorios ?? []).filter((t) => t.id !== null).sort(porNumero), [data]);
  const cores = useMemo(() => data?.cores ?? {}, [data]);
  const areas = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const t of todos) {
      const nome = t.area?.trim();
      if (nome) mapa.set(nome, [...(mapa.get(nome) ?? []), t.numero]);
    }
    return [...mapa].map(([nome, numeros]) => ({ nome, numeros }));
  }, [todos]);
  const semArea = todos.filter((t) => !t.area?.trim()).map((t) => t.numero);
  const proximaCor = PALETA_AREAS.find((c) => !Object.values(cores).includes(c)) ?? PALETA_AREAS[0];

  return (
    <View style={styles.cartao}>
      {areas.map((a, i) => (
        <Animated.View key={a.nome} entering={FadeInDown.delay(i * 50).duration(260)} layout={LinearTransition}>
          <Pressable
            style={({ pressed }) => [styles.linha, pressed && { opacity: 0.7 }]}
            onPress={() => setEditando({ de: a.nome, nome: a.nome, cor: cores[a.nome] ?? proximaCor, numeros: a.numeros })}
            accessibilityRole="button"
            accessibilityLabel={`Editar a área ${a.nome}`}
          >
            <View style={[styles.bolinha, { backgroundColor: cores[a.nome] ?? colors.textMuted }]} />
            <View style={styles.flex}>
              <Text style={styles.area}>{a.nome}</Text>
              <Text style={styles.numeros} numberOfLines={2}>
                {a.numeros.join(", ")}
              </Text>
            </View>
            <Ionicons name="create-outline" size={19} color={colors.primaryDark} />
          </Pressable>
        </Animated.View>
      ))}
      {semArea.length > 0 ? (
        <View style={styles.linha}>
          <View style={[styles.bolinha, styles.bolinhaVazia]} />
          <View style={styles.flex}>
            <Text style={styles.area}>Sem área</Text>
            <Text style={styles.numeros} numberOfLines={2}>
              {semArea.join(", ")}
            </Text>
          </View>
        </View>
      ) : null}
      <Button
        label="Nova área"
        icon="add"
        variant="secondary"
        onPress={() => setEditando({ de: null, nome: "", cor: proximaCor, numeros: [] })}
        fullWidth
      />
      <EditarAreaSheet area={editando} todos={todos} cores={cores} onClose={() => setEditando(null)} />
    </View>
  );
}

function EditarAreaSheet({
  area,
  todos,
  cores,
  onClose,
}: {
  area: AreaEditada | null;
  todos: TerritorioResumo[];
  cores: Record<string, string>;
  onClose: () => void;
}) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const salvar = useSalvarArea();
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(PALETA_AREAS[0]);
  const [numeros, setNumeros] = useState<string[]>([]);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  useEffect(() => {
    if (!area) return;
    setNome(area.nome);
    setCor(area.cor);
    setNumeros(area.numeros);
    setDe("");
    setAte("");
  }, [area]);

  const deOutra = (t: TerritorioResumo) => !!t.area?.trim() && t.area.trim() !== area?.de;
  const alternar = (numero: string) =>
    setNumeros((atual) => (atual.includes(numero) ? atual.filter((n) => n !== numero) : [...atual, numero]));
  const faixa = todos.filter(
    (t) => !deOutra(t) && !numeros.includes(t.numero) && +t.numero >= Number(de) && +t.numero <= Number(ate),
  );

  const enviar = (dados: { nome: string; numeros: string[] }, aviso: string) =>
    salvar.mutate(
      { de: area?.de ?? null, cor, ...dados },
      {
        onSuccess: () => {
          toast.show(aviso);
          onClose();
        },
        onError: (e) => toast.show(e.message, "error"),
      },
    );

  const apagar = () =>
    Alert.alert(`Apagar a área "${area?.de}"?`, "Os territórios dela ficam sem área. O histórico não muda.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: () => enviar({ nome: area?.de ?? "", numeros: [] }, "Área apagada") },
    ]);

  return (
    <Sheet visible={!!area} onClose={onClose} scroll>
      {area ? (
        <View style={styles.corpo}>
          <Text style={styles.titulo}>{area.de ? "Editar área" : "Nova área"}</Text>
          <TextField label="Nome" placeholder="Ex.: Tokaia" value={nome} onChangeText={setNome} maxLength={60} />

          <Text style={styles.rotulo}>Cor no mapa</Text>
          <View style={styles.cores}>
            {PALETA_AREAS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCor(c)}
                style={[styles.cor, { backgroundColor: c }, cor === c && styles.corAtiva]}
                accessibilityRole="radio"
                accessibilityState={{ selected: cor === c }}
                accessibilityLabel={`Cor ${c}`}
              >
                {cor === c ? (
                  <Animated.View entering={ZoomIn.springify().damping(14)}>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  </Animated.View>
                ) : null}
              </Pressable>
            ))}
          </View>

          <Text style={styles.rotulo}>Territórios · {numeros.length}</Text>
          <Text style={styles.ajuda}>Toque para pôr ou tirar. Os apagados são de outra área: tire de lá primeiro.</Text>
          <View style={styles.chips}>
            {todos.map((t) => {
              const nesta = numeros.includes(t.numero);
              const outra = deOutra(t);
              return (
                <Pressable
                  key={t.numero}
                  disabled={outra}
                  onPress={() => alternar(t.numero)}
                  style={[styles.chip, nesta && { backgroundColor: cor, borderColor: cor }, outra && styles.chipOutra]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: nesta, disabled: outra }}
                  accessibilityLabel={outra ? `${t.numero}, já na área ${t.area}` : `Território ${t.numero}`}
                >
                  <Text style={[styles.chipTexto, nesta && styles.chipTextoNesta]}>{t.numero}</Text>
                  {outra ? (
                    <View style={[styles.chipPonto, { backgroundColor: cores[t.area!.trim()] ?? colors.textMuted }]} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.faixa}>
            <TextInput
              value={de}
              onChangeText={(v) => setDe(v.replace(/\D/g, ""))}
              placeholder="Do nº"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={[styles.campo, styles.flex]}
            />
            <TextInput
              value={ate}
              onChangeText={(v) => setAte(v.replace(/\D/g, ""))}
              placeholder="Ao nº"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={[styles.campo, styles.flex]}
            />
            <Pressable
              style={[styles.marcar, faixa.length === 0 && { opacity: 0.4 }]}
              disabled={faixa.length === 0}
              onPress={() => setNumeros((atual) => [...atual, ...faixa.map((t) => t.numero)])}
            >
              <Text style={styles.marcarTexto}>Marcar{faixa.length ? ` ${faixa.length}` : ""}</Text>
            </Pressable>
          </View>

          <Button
            label="Salvar área"
            icon="checkmark"
            onPress={() => enviar({ nome: nome.trim(), numeros }, `Área "${nome.trim()}" salva`)}
            loading={salvar.isPending}
            disabled={!nome.trim() || numeros.length === 0}
            fullWidth
          />
          {area.de ? <Button label="Apagar área" icon="trash-outline" variant="danger" onPress={apagar} fullWidth /> : null}
        </View>
      ) : null}
    </Sheet>
  );
}

/**
 * O contorno do território da congregação, desenhado por cima de tudo no mapa geral. Vem de um
 * arquivo KML (o do Hub da congregação, ou exportado do My Maps) e fica no banco: é dado de
 * cada congregação, não vai para o repositório.
 */
export function LimiteCongregacao() {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const { data } = useMapaTerritorios();
  const salvar = useSalvarLimite();
  const remover = useRemoverLimite();
  const limite = data?.limite;

  const importar = async () => {
    // Qualquer tipo: o arquivo às vezes chega como ".kml.txt" pelo WhatsApp.
    const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    let kml: string;
    try {
      kml = await FileSystem.readAsStringAsync(res.assets[0].uri);
    } catch {
      toast.show("Não consegui ler o arquivo", "error");
      return;
    }
    salvar.mutate(kml, {
      onSuccess: (l) => toast.show(`"${l.nome}" agora aparece no mapa`),
      onError: (e) => toast.show(e.message, "error"),
    });
  };

  const tirar = () =>
    Alert.alert("Tirar o limite do mapa?", "Dá para importar de novo quando quiser.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Tirar",
        style: "destructive",
        onPress: () => remover.mutate(undefined, { onError: (e) => toast.show(e.message, "error") }),
      },
    ]);

  return (
    <View style={styles.cartao}>
      <View style={styles.linhaSolta}>
        <View style={[styles.limite, { borderColor: limite?.cor ?? colors.textMuted }]} />
        <View style={styles.flex}>
          <Text style={styles.area}>{limite ? limite.nome : "Nenhum limite importado"}</Text>
          <Text style={styles.numeros}>
            {limite
              ? "Aparece por cima de tudo no mapa geral."
              : "Importe o arquivo .kml do território da congregação: a linha dele aparece no mapa geral."}
          </Text>
        </View>
      </View>
      <Button
        label={limite ? "Trocar o arquivo KML" : "Importar arquivo KML"}
        icon="document-outline"
        variant="secondary"
        onPress={importar}
        loading={salvar.isPending}
        fullWidth
      />
      {limite ? (
        <Button label="Tirar do mapa" icon="trash-outline" variant="danger" onPress={tirar} loading={remover.isPending} fullWidth />
      ) : null}
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    cartao: { gap: 8, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    linha: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    linhaSolta: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 4 },
    bolinha: { width: 18, height: 18, borderRadius: 9 },
    bolinhaVazia: { borderWidth: 2, borderColor: colors.borderStrong, borderStyle: "dashed" },
    limite: { width: 22, height: 18, borderRadius: 4, borderWidth: 3 },
    area: { fontSize: 15.5, fontWeight: "800", color: colors.text },
    numeros: { fontSize: 12.5, color: colors.textSecondary },
    flex: { flex: 1 },
    corpo: { gap: spacing.md, paddingBottom: spacing.sm },
    titulo: { fontSize: 21, fontWeight: "800", color: colors.text },
    rotulo: { fontSize: 14, fontWeight: "800", color: colors.text, marginBottom: -6 },
    ajuda: { fontSize: 12.5, color: colors.textSecondary },
    cores: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    cor: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    corAtiva: { borderWidth: 3, borderColor: colors.surface, outlineWidth: 2, outlineColor: colors.text, transform: [{ scale: 1.08 }] },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      minWidth: 48,
      height: 40,
      paddingHorizontal: 10,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    chipOutra: { opacity: 0.35, backgroundColor: colors.surfaceMuted },
    chipTexto: { fontSize: 15, fontWeight: "800", color: colors.text },
    chipTextoNesta: { color: "#fff" },
    chipPonto: { position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: 4 },
    faixa: { flexDirection: "row", gap: 8, alignItems: "center" },
    campo: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
    },
    marcar: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.sm, backgroundColor: colors.primary },
    marcarTexto: { fontSize: 14, fontWeight: "800", color: colors.textOnPrimary },
  });
