import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import MapView, { Marker, Polygon, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import type { Ponto, TipoMarcacao } from "@/api/types";
import { type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { MARCACOES } from "@/territorios/constantes";

export interface AreaMapa {
  chave: string;
  nome: string;
  pontos: Ponto[];
  /** Cor do polígono; sem ela, a da marca. */
  cor?: string | null;
  /** Texto fixo no meio do polígono (o número, no mapa geral). */
  rotulo?: string;
}

export interface PinoMapa {
  chave: string;
  tipo: TipoMarcacao;
  lat: number;
  lng: number;
  /** Ainda na fila do celular, sem chegar ao servidor: pino tracejado. */
  pendente?: boolean;
}

/** Região pintada por baixo dos territórios (a área inteira, em volta das quadras dela). */
export interface FundoMapa {
  chave: string;
  cor: string;
  pontos: Ponto[];
}

export interface MapaTerritorioRef {
  /** Enquadra todos os polígonos de novo, ou só estes pontos. */
  enquadrar: (pontos?: Ponto[]) => void;
  focar: (lat: number, lng: number) => void;
}

interface MapaTerritorioProps {
  areas: AreaMapa[];
  fundos?: FundoMapa[];
  /** Linha do limite da congregação, por cima de tudo. Com ela, o enquadramento é o limite. */
  limite?: { pontos: Ponto[]; cor?: string | null } | null;
  /** Ao abrir, enquadra estes pontos em vez de tudo (a área que estava aberta na lista). */
  enquadrarEm?: Ponto[];
  pinos?: PinoMapa[];
  satelite?: boolean;
  /** Segurar o dedo no mapa marca um ponto escolhido ali (em vez do GPS). */
  onLongPress?: (ponto: { lat: number; lng: number }) => void;
  onAreaPress?: (chave: string) => void;
  /** Tocar no pino: a tela abre os detalhes (e o "remover"). Sem isto, vale o balão padrão. */
  onPinoPress?: (chave: string) => void;
  style?: StyleProp<ViewStyle>;
}

const extra = Constants.expoConfig?.extra as { mapaGoogle?: { android?: boolean; ios?: boolean } } | undefined;
const noExpoGo = Constants.executionEnvironment === "storeClient";

/**
 * Dá para mostrar o mapa neste aparelho? No Android o Google Maps exige a chave no build (sem
 * ela o app fecha ao abrir o mapa); no iPhone, sem a chave do Google, usamos o mapa da Apple.
 * O Expo Go traz chave própria.
 */
export const mapaDisponivel =
  Platform.OS === "ios" || noExpoGo || (Platform.OS === "android" && !!extra?.mapaGoogle?.android);

const provedor = Platform.OS === "android" || extra?.mapaGoogle?.ios ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

const centro = (pontos: Ponto[]) => {
  const n = pontos.length || 1;
  const [lat, lng] = pontos.reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0]);
  return { latitude: lat / n, longitude: lng / n };
};

/** "#0288D1" -> "#0288D155" (o mesmo tom, transparente, para o preenchimento). */
const transparente = (cor: string, alfa = "55") => (/^#[0-9a-f]{6}$/i.test(cor) ? `${cor}${alfa}` : cor);

/**
 * O mapa do território: as quadras do My Maps, os pontos marcados e a posição do irmão.
 *
 * Os pinos são views próprias (letra dentro de um círculo da cor do tipo), e não o pino padrão:
 * no sol, na rua, a letra é o que se lê de relance — a cor sozinha não basta para daltônico.
 */
export const MapaTerritorio = forwardRef<MapaTerritorioRef, MapaTerritorioProps>(function MapaTerritorio(
  { areas, fundos = [], limite, enquadrarEm, pinos = [], satelite = false, onLongPress, onAreaPress, onPinoPress, style },
  ref,
) {
  const { colors, styles } = useTema(criarEstilos);
  const mapa = useRef<MapView>(null);
  // Pinos com view própria precisam desenhar uma vez com rastreio ligado (senão saem em branco
  // no Android); depois desliga, que é o que mantém o mapa leve ao arrastar.
  const [rastrear, setRastrear] = useState(true);
  const assinatura = pinos.map((p) => `${p.chave}:${p.pendente ? 1 : 0}`).join("|");
  useEffect(() => {
    setRastrear(true);
    const t = setTimeout(() => setRastrear(false), 1000);
    return () => clearTimeout(t);
  }, [assinatura, areas.length]);

  // Pino que SAI do mapa às vezes fica desenhado no mapa nativo (react-native-maps na nova
  // arquitetura): sobrava o fantasma desbotado do pino que estava na fila, ou o do pino
  // removido. Quando algum pino some, o mapa é montado de novo, na mesma região.
  const vistos = useRef<Set<string>>(new Set());
  const [geracao, setGeracao] = useState(0);
  const regiao = useRef<Region | null>(null);
  // O mapa recém-montado anuncia a região padrão dele (o mundo, a Europa) antes de ficar
  // pronto. Guardar essa região fazia a remontagem seguinte abrir longe do território.
  const pronto = useRef(false);
  useEffect(() => {
    const atuais = new Set(pinos.map((p) => p.chave));
    const sumiu = [...vistos.current].some((c) => !atuais.has(c));
    vistos.current = atuais;
    if (sumiu) {
      pronto.current = false;
      setGeracao((g) => g + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);

  const emCoordenadas = (pontos: Ponto[]) => pontos.map(([latitude, longitude]) => ({ latitude, longitude }));
  const todos = useMemo(
    () => emCoordenadas(limite?.pontos.length ? limite.pontos : areas.flatMap((a) => a.pontos)),
    [areas, limite],
  );

  const enquadrar = (pontos?: Ponto[]) => {
    const alvo = pontos?.length ? emCoordenadas(pontos) : todos;
    if (alvo.length === 0) return;
    mapa.current?.fitToCoordinates(alvo, {
      edgePadding: { top: 48, right: 36, bottom: 48, left: 36 },
      animated: true,
    });
  };

  useImperativeHandle(ref, () => ({
    enquadrar,
    focar: (latitude, longitude) =>
      mapa.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.002, longitudeDelta: 0.002 }, 500),
  }));

  if (!mapaDisponivel) {
    return (
      <View style={[styles.indisponivel, style]}>
        <Ionicons name="map-outline" size={28} color={colors.textMuted} />
        <Text style={styles.indisponivelTitulo}>Mapa indisponível neste aparelho</Text>
        <Text style={styles.indisponivelTexto}>
          Falta a chave do Google Maps neste app. Use “Como chegar” para abrir o Google Maps.
        </Text>
      </View>
    );
  }

  const inicial = todos.length > 0 ? centro(areas.flatMap((a) => a.pontos)) : null;

  return (
    <MapView
      key={geracao}
      ref={mapa}
      provider={provedor}
      style={[styles.mapa, style]}
      mapType={satelite ? "hybrid" : "standard"}
      showsUserLocation
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      initialRegion={
        regiao.current ?? (inicial ? { ...inicial, latitudeDelta: 0.01, longitudeDelta: 0.01 } : undefined)
      }
      onMapReady={() => {
        pronto.current = true;
        // Remontado por causa de um pino que saiu: volta para onde estava, sem reenquadrar.
        if (geracao > 0 && regiao.current) mapa.current?.animateToRegion(regiao.current, 0);
        else enquadrar(enquadrarEm);
      }}
      onRegionChangeComplete={(r) => {
        if (pronto.current) regiao.current = r;
      }}
      onLongPress={
        onLongPress
          ? (e) => onLongPress({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })
          : undefined
      }
    >
      {/* A ordem é a do desenho: fundo das áreas, territórios, e o limite por cima de tudo. */}
      {fundos.map((f) => (
        <Polygon
          key={`fundo-${f.chave}`}
          coordinates={emCoordenadas(f.pontos)}
          fillColor={transparente(f.cor, "30")}
          strokeColor={transparente(f.cor, "AA")}
          strokeWidth={1.5}
          zIndex={0}
        />
      ))}

      {areas.map((a) => {
        const cor = a.cor || colors.primary;
        return (
          <Polygon
            key={a.chave}
            zIndex={1}
            coordinates={a.pontos.map(([latitude, longitude]) => ({ latitude, longitude }))}
            fillColor={transparente(cor)}
            strokeColor={cor}
            strokeWidth={2}
            tappable={!!onAreaPress}
            onPress={onAreaPress ? () => onAreaPress(a.chave) : undefined}
          />
        );
      })}

      {limite?.pontos.length ? (
        <Polyline
          coordinates={emCoordenadas([...limite.pontos, limite.pontos[0]])}
          strokeColor={limite.cor || colors.primaryDark}
          strokeWidth={3.5}
          zIndex={3}
        />
      ) : null}

      {areas
        .filter((a) => a.rotulo)
        .map((a) => (
          <Marker
            key={`rotulo-${a.chave}`}
            coordinate={centro(a.pontos)}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={rastrear}
            onPress={onAreaPress ? () => onAreaPress(a.chave) : undefined}
          >
            <View style={[styles.rotulo, { borderColor: a.cor || colors.primary }]}>
              <Text style={styles.rotuloTexto}>{a.rotulo}</Text>
            </View>
          </Marker>
        ))}

      {pinos.map((p) => {
        const tipo = MARCACOES[p.tipo];
        const cor = tipo.cor(colors);
        return (
          <Marker
            key={p.chave}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={rastrear}
            title={onPinoPress ? undefined : tipo.rotulo}
            description={onPinoPress ? undefined : p.pendente ? "Aguardando internet para enviar" : undefined}
            onPress={onPinoPress ? () => onPinoPress(p.chave) : undefined}
          >
            <View
              style={[
                styles.pino,
                { backgroundColor: p.pendente ? colors.surface : cor, borderColor: cor },
                p.pendente && styles.pinoPendente,
              ]}
            >
              <Text style={[styles.pinoLetra, { color: p.pendente ? cor : "#fff" }]}>{tipo.letra}</Text>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
});

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    mapa: { flex: 1 },
    indisponivel: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      padding: 20,
      backgroundColor: colors.surfaceMuted,
    },
    indisponivelTitulo: { fontSize: 15, fontWeight: "700", color: colors.text, textAlign: "center" },
    indisponivelTexto: { fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 18 },
    pino: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2.5,
      alignItems: "center",
      justifyContent: "center",
    },
    pinoPendente: { borderStyle: "dashed" },
    pinoLetra: { fontSize: 15, fontWeight: "900" },
    rotulo: {
      minWidth: 30,
      paddingHorizontal: 6,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      backgroundColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
    },
    rotuloTexto: { fontSize: 12, fontWeight: "800", color: "#2B2620" },
  });
