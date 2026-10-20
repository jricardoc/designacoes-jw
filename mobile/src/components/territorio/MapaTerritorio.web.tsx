import { Ionicons } from "@expo/vector-icons";
import { forwardRef, useImperativeHandle } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { Ponto, TipoMarcacao } from "@/api/types";
import { type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

// O react-native-maps não roda no navegador. Na versão web do app o território mostra só o
// resto da tela (onde paramos, Não bater, Como chegar); a mesma interface do nativo mantém as
// telas iguais nos dois.

export interface AreaMapa {
  chave: string;
  nome: string;
  pontos: Ponto[];
  cor?: string | null;
  rotulo?: string;
}

export interface PinoMapa {
  chave: string;
  tipo: TipoMarcacao;
  lat: number;
  lng: number;
  pendente?: boolean;
}

export interface MapaTerritorioRef {
  enquadrar: () => void;
  focar: (lat: number, lng: number) => void;
}

export const mapaDisponivel = false;

export const MapaTerritorio = forwardRef<
  MapaTerritorioRef,
  {
    areas: AreaMapa[];
    pinos?: PinoMapa[];
    satelite?: boolean;
    onLongPress?: (ponto: { lat: number; lng: number }) => void;
    onAreaPress?: (chave: string) => void;
    onPinoPress?: (chave: string) => void;
    style?: StyleProp<ViewStyle>;
  }
>(function MapaTerritorio({ style }, ref) {
  const { colors, styles } = useTema(criarEstilos);
  useImperativeHandle(ref, () => ({ enquadrar: () => {}, focar: () => {} }));
  return (
    <View style={[styles.caixa, style]}>
      <Ionicons name="map-outline" size={28} color={colors.textMuted} />
      <Text style={styles.texto}>O mapa aparece no app do celular.</Text>
    </View>
  );
});

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    caixa: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.surfaceMuted },
    texto: { fontSize: 13, color: colors.textSecondary },
  });
