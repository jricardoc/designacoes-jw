import { Redirect } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { SaidasDeCampo } from "@/components/config/SaidasDeCampo";
import { TituloTela, useRecuo } from "@/components/ministerio/kit";
import { CabecalhoTerritorio } from "@/components/territorio/CabecalhoTerritorio";
import { useAuth } from "@/context/AuthContext";
import { type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { podeGerenciar } from "@/utils/permissoes";

/** Os locais e horários das saídas de campo: de quem cuida dos dirigentes (o escopo que o servidor exige). */
export default function SaidasScreen() {
  const { styles } = useTema(criarEstilos);
  const { usuario } = useAuth();
  const recuo = useRecuo();
  if (!podeGerenciar(usuario, "dirigentes")) return <Redirect href="/territorio" />;

  return (
    <View style={styles.tela}>
      <CabecalhoTerritorio />
      <ScrollView contentContainerStyle={[styles.scroll, recuo]}>
        <TituloTela titulo="Saídas" subtitulo="Onde e quando cada grupo sai para o campo" />
        <SaidasDeCampo />
      </ScrollView>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, gap: 16 },
  });
