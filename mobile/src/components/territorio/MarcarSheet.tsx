import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Quadra, TipoMarcacao } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { Button, Sheet, TextField, useToast } from "@/components/ui";
import { radius, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { dentro, juntarEnderecoEDescricao, MARCACOES, TIPOS_MARCACAO } from "@/territorios/constantes";
import { enfileirar, novaChave } from "@/territorios/fila";

export interface PontoEscolhido {
  lat: number;
  lng: number;
  precisao: number | null;
  /** "gps" = onde o irmão está; "mapa" = segurou o dedo no mapa. */
  origem: "gps" | "mapa";
}

interface MarcarSheetProps {
  territorio: { id: number; numero: string; quadras: Quadra[] } | null;
  ponto: PontoEscolhido | null;
  /** Tipo já escolhido (ex.: "Não bater" a partir da tela de Não bater). */
  tipoInicial?: TipoMarcacao;
  onClose: () => void;
}

/** Acima disto o GPS está "chutando": avisa, mas deixa salvar. */
const PRECISAO_BOA = 30;

/**
 * O que é este ponto? Cinco tipos grandes, um toque, e salvar.
 *
 * Salva pela fila: com internet sobe na hora; sem, fica no celular e sobe sozinho depois.
 * A quadra é descoberta aqui mesmo (o polígono já está no celular) só para mostrar ao irmão
 * onde o ponto caiu; quem grava a quadra de verdade é o servidor.
 */
export function MarcarSheet({ territorio, ponto, tipoInicial = "parada", onClose }: MarcarSheetProps) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const { feito } = useCelebracao();
  const [tipo, setTipo] = useState<TipoMarcacao>(tipoInicial);
  const [texto, setTexto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (ponto) {
      setTipo(tipoInicial);
      setTexto("");
      setDescricao("");
    }
  }, [ponto, tipoInicial]);

  const quadra = useMemo(
    () => (ponto && territorio ? territorio.quadras.find((q) => dentro([ponto.lat, ponto.lng], q.pontos)) : undefined),
    [ponto, territorio],
  );

  const exigeTexto = tipo === "nao_bater";
  const podeSalvar = !!ponto && !!territorio && (!exigeTexto || texto.trim().length >= 3);

  const salvar = async () => {
    if (!ponto || !territorio || !podeSalvar) return;
    setSalvando(true);
    const clientKey = novaChave();
    const resultado = await enfileirar({
      clientKey,
      tipo: "marcacao",
      numero: territorio.numero,
      titulo: `${MARCACOES[tipo].rotulo} · Território ${territorio.numero}`,
      corpo: {
        clientKey,
        territorioId: territorio.id,
        tipo,
        lat: ponto.lat,
        lng: ponto.lng,
        precisao: ponto.precisao,
        texto: (exigeTexto ? juntarEnderecoEDescricao(texto, descricao) : texto.trim()) || null,
        marcadaEm: new Date().toISOString(),
      },
    });
    setSalvando(false);
    if (resultado.erro) {
      toast.show(resultado.erro, "error");
      return;
    }
    feito(
      resultado.enviado
        ? {
            titulo: "Marcado no mapa",
            detalhe: `${MARCACOES[tipo].rotulo} · Território ${territorio.numero}`,
            icone: MARCACOES[tipo].icone,
            cor: MARCACOES[tipo].cor(colors),
          }
        : { titulo: "Guardado no celular", detalhe: "Envia sozinho quando tiver internet", icone: "cloud-upload-outline" },
    );
    onClose();
  };

  return (
    <Sheet visible={!!ponto} onClose={onClose} scroll>
      {ponto ? (
        <View style={styles.corpo}>
          <Text style={styles.titulo}>O que é este ponto?</Text>

          <View style={styles.local}>
            <Ionicons
              name={ponto.origem === "gps" ? "navigate" : "hand-right"}
              size={16}
              color={colors.primaryDark}
            />
            <Text style={styles.localTexto}>
              {ponto.origem === "gps"
                ? `Sua localização${ponto.precisao ? ` · precisão de ${Math.round(ponto.precisao)} m` : ""}`
                : "Ponto escolhido no mapa"}
              {quadra ? `\nQuadra: ${quadra.nome}` : "\nFora das quadras deste território"}
            </Text>
          </View>
          {ponto.precisao && ponto.precisao > PRECISAO_BOA ? (
            <Text style={styles.aviso}>
              O GPS está impreciso agora. Se puder, espere alguns segundos ao ar livre e marque de novo.
            </Text>
          ) : null}

          <View style={styles.tipos}>
            {TIPOS_MARCACAO.map((id) => {
              const t = MARCACOES[id];
              const ativo = tipo === id;
              const cor = t.cor(colors);
              return (
                <Pressable
                  key={id}
                  onPress={() => setTipo(id)}
                  style={[styles.tipo, ativo && { borderColor: cor, backgroundColor: colors.surface }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ativo }}
                >
                  <View style={[styles.tipoBolinha, { backgroundColor: cor }]}>
                    <Text style={styles.tipoLetra}>{t.letra}</Text>
                  </View>
                  <View style={styles.tipoTextos}>
                    <Text style={styles.tipoRotulo}>{t.rotulo}</Text>
                    <Text style={styles.tipoDescricao}>{t.descricao}</Text>
                  </View>
                  {ativo ? <Ionicons name="checkmark-circle" size={22} color={cor} /> : null}
                </Pressable>
              );
            })}
          </View>

          <TextField
            label={exigeTexto ? "Rua e número da casa" : "Detalhe (opcional)"}
            icon={exigeTexto ? "home-outline" : "create-outline"}
            placeholder={exigeTexto ? "Ex.: Rua das Flores, 120" : "Ex.: portão azul, cachorro bravo"}
            value={texto}
            onChangeText={setTexto}
            maxLength={exigeTexto ? 140 : 300}
          />
          {exigeTexto ? (
            <TextField
              label="Descrição (opcional)"
              icon="create-outline"
              placeholder="Ex.: casa de muro azul, portão de ferro"
              value={descricao}
              onChangeText={setDescricao}
              maxLength={150}
            />
          ) : null}
          <Text style={styles.dica}>Não escreva nomes nem dados dos moradores.</Text>

          <Button
            label="Salvar marcação"
            icon="location"
            onPress={salvar}
            loading={salvando}
            disabled={!podeSalvar}
            fullWidth
          />
        </View>
      ) : null}
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    corpo: { gap: spacing.md, paddingBottom: spacing.sm },
    titulo: { fontSize: 21, fontWeight: "800", color: colors.text },
    local: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
      backgroundColor: colors.infoBg,
      borderRadius: radius.md,
      padding: 12,
    },
    localTexto: { flex: 1, fontSize: 14, color: colors.primaryDark, fontWeight: "600", lineHeight: 20 },
    aviso: { fontSize: 13, color: colors.amber, lineHeight: 18 },
    tipos: { gap: 8 },
    tipo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      minHeight: 60,
      borderRadius: radius.md,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    tipoBolinha: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
    tipoLetra: { color: "#fff", fontSize: 17, fontWeight: "900" },
    tipoTextos: { flex: 1, gap: 1 },
    tipoRotulo: { fontSize: 16, fontWeight: "700", color: colors.text },
    tipoDescricao: { fontSize: 12.5, color: colors.textSecondary },
    dica: { fontSize: 12, color: colors.textMuted, marginTop: -6 },
  });
