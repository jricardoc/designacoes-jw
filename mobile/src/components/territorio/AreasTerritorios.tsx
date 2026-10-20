import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { apiRequest } from "@/api/client";
import { useTerritorios } from "@/api/hooks/useTerritorios";
import { qk } from "@/api/queryKeys";
import { Button, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

const numeroDe = (numero: string) => parseInt(numero, 10);

/**
 * As áreas que agrupam a lista de territórios ("Tokaia", "KM 17"...), aplicadas por FAIXA de
 * números: "Tokaia, do 01 ao 13" em vez de abrir território por território. Nome vazio tira a
 * área da faixa. A área de um território sozinho também se edita em ⚙️ › Dados.
 */
export function AreasTerritorios() {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const qc = useQueryClient();
  const { data } = useTerritorios();
  const [nome, setNome] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [aplicando, setAplicando] = useState(false);

  const todos = useMemo(() => (data?.territorios ?? []).filter((t) => t.id !== null), [data]);
  const resumo = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const t of todos) {
      const area = t.area?.trim() || "Sem área";
      mapa.set(area, [...(mapa.get(area) ?? []), t.numero]);
    }
    return [...mapa];
  }, [todos]);

  const faixa = todos.filter((t) => numeroDe(t.numero) >= Number(de) && numeroDe(t.numero) <= Number(ate));

  const aplicar = async () => {
    setAplicando(true);
    try {
      // Um por um, e não em paralelo: são poucos, e o servidor não precisa de rajada.
      for (const t of faixa) {
        await apiRequest(`/territorios/${t.id}`, { method: "PUT", body: { area: nome.trim() } });
      }
      toast.show(
        nome.trim()
          ? `${faixa.length} territórios agora em "${nome.trim()}"`
          : `${faixa.length} territórios ficaram sem área`,
      );
      setNome("");
      setDe("");
      setAte("");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao aplicar a área", "error");
    } finally {
      setAplicando(false);
      qc.invalidateQueries({ queryKey: qk.territorios });
    }
  };

  return (
    <View style={styles.cartao}>
      {resumo.map(([area, numeros]) => (
        <View key={area} style={styles.linha}>
          <Text style={styles.area}>{area}</Text>
          <Text style={styles.numeros} numberOfLines={2}>
            {numeros.join(", ")}
          </Text>
        </View>
      ))}
      <Text style={styles.ajuda}>Aplicar uma área a uma faixa de números:</Text>
      <TextInput
        value={nome}
        onChangeText={setNome}
        placeholder="Nome da área (ex.: Tokaia)"
        placeholderTextColor={colors.textMuted}
        style={styles.campo}
      />
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
      </View>
      <Button
        label={
          faixa.length === 0
            ? "Escolha a faixa de números"
            : nome.trim()
              ? `Pôr ${faixa.length} territórios em "${nome.trim()}"`
              : `Tirar a área de ${faixa.length} territórios`
        }
        icon="albums-outline"
        onPress={aplicar}
        loading={aplicando}
        disabled={faixa.length === 0}
        fullWidth
      />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    cartao: { gap: 8, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    linha: { gap: 1, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
    area: { fontSize: 15, fontWeight: "800", color: colors.text },
    numeros: { fontSize: 12.5, color: colors.textSecondary },
    ajuda: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
    faixa: { flexDirection: "row", gap: 8 },
    flex: { flex: 1 },
    campo: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
    },
  });
