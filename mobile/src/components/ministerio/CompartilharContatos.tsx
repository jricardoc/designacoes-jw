import { LinearGradient } from "expo-linear-gradient";
import { forwardRef, useRef, useState } from "react";
import { Linking, Share, StyleSheet, Text, View } from "react-native";
import type { Revisita } from "@/api/types";
import { useToast } from "@/components/ui";
import { exportarImagem } from "@/utils/exportImagem";
import { doisDig, quando } from "./escolhas";
import { MenuAcoes } from "./kit";

/** O que vai de cada contato. No detalhe, a última visita é a primeira da linha do tempo. */
export type ContatoParaCompartilhar = Pick<
  Revisita,
  "id" | "nome" | "endereco" | "lat" | "lng" | "telefone" | "observacao" | "estudo" | "proximaVisita" | "ultimaVisita"
>;

const dataDe = (d: Date) => `${doisDig(d.getDate())}/${doisDig(d.getMonth() + 1)}/${d.getFullYear()}`;

/** As linhas de um contato, as mesmas na imagem e na mensagem. Só a mensagem leva o link do mapa. */
function linhasDe(c: ContatoParaCompartilhar, comMapa: boolean) {
  // Pelo Google Maps, que abre em qualquer celular (o "como chegar" do app abre o Mapas da Apple no iPhone).
  const mapa = comMapa && c.lat != null && c.lng != null ? `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}` : null;
  return [
    { rotulo: "Endereço", valor: c.endereco },
    { rotulo: "Localização", valor: mapa },
    { rotulo: "Telefone", valor: c.telefone },
    { rotulo: "Anotações", valor: c.observacao },
    { rotulo: "Última visita", valor: c.ultimaVisita && dataDe(new Date(c.ultimaVisita)) },
    { rotulo: "Próxima visita", valor: c.proximaVisita && quando(c.proximaVisita) },
  ].filter((l): l is { rotulo: string; valor: string } => !!l.valor);
}

/** A mensagem pronta para o WhatsApp: um bloco por contato, com o nome em *negrito*. */
export function mensagemDosContatos(contatos: ContatoParaCompartilhar[]) {
  const varios = contatos.length > 1;
  const blocos = contatos.map((c, i) =>
    [
      `*${varios ? `${i + 1}. ` : ""}${c.nome}*${c.estudo ? " (estudo bíblico)" : ""}`,
      ...linhasDe(c, true).map((l) => `${l.rotulo}: ${l.valor}`),
    ].join("\n"),
  );
  return (varios ? [`Contatos para revisitar (${contatos.length})`, ...blocos] : blocos).join("\n\n");
}

/**
 * Compartilhar contatos: uma imagem com todos ou a mensagem pronta para o WhatsApp. `compartilhar`
 * abre a escolha; `overlays` vai uma vez no fim da tela (a folha e o cartão escondido da captura).
 */
export function useCompartilharContatos() {
  const toast = useToast();
  const [contatos, setContatos] = useState<ContatoParaCompartilhar[]>([]);
  const [aberto, setAberto] = useState(false);
  // Montar o cartão fora da tela é o que dispara a captura, como no quadro e na reunião.
  const [naImagem, setNaImagem] = useState(false);
  const cartao = useRef<View>(null);
  const capturando = useRef(false);

  /** Chamado pelo onLayout do cartão escondido: antes disso a imagem sai em branco. */
  const capturar = async () => {
    if (capturando.current) return;
    capturando.current = true;
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await exportarImagem(cartao, contatos.length > 1 ? "contatos.png" : "contato.png");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Não deu para gerar a imagem", "error");
    } finally {
      setNaImagem(false);
      capturando.current = false;
    }
  };

  const mandarMensagem = () => {
    const texto = mensagemDosContatos(contatos);
    // Direto no WhatsApp; sem ele no celular, o compartilhar do sistema.
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(texto)}`).catch(() => Share.share({ message: texto }).catch(() => {}));
  };

  const overlays = (
    <>
      {naImagem ? (
        <View style={estilos.fora} pointerEvents="none" onLayout={capturar}>
          <CartaoContatos ref={cartao} contatos={contatos} />
        </View>
      ) : null}
      {/* A folha fecha sozinha e só depois segue (no iPhone, 400 ms): o share do sistema não abre sobre um modal saindo. */}
      <MenuAcoes
        visible={aberto}
        onClose={() => setAberto(false)}
        titulo={contatos.length > 1 ? `Compartilhar ${contatos.length} contatos` : `Compartilhar ${contatos[0]?.nome ?? "contato"}`}
        acoes={[
          { rotulo: contatos.length > 1 ? "Imagem com os contatos" : "Imagem com o contato", icone: "image-outline", onPress: () => setNaImagem(true) },
          { rotulo: "Mensagem pronta no WhatsApp", icone: "logo-whatsapp", onPress: mandarMensagem },
        ]}
      />
    </>
  );

  return {
    compartilhar: (c: ContatoParaCompartilhar[]) => {
      setContatos(c);
      setAberto(true);
    },
    overlays,
  };
}

/** A imagem: o cabeçalho verde do Ministério e uma ficha por contato. Cores fixas, para sair igual no modo escuro. */
const CartaoContatos = forwardRef<View, { contatos: ContatoParaCompartilhar[] }>(function CartaoContatos({ contatos }, ref) {
  const um = contatos.length === 1 ? contatos[0] : null;
  return (
    <View ref={ref} collapsable={false} style={estilos.cartao}>
      <LinearGradient colors={["#17B288", "#0A7F61"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={estilos.cabeca}>
        <Text style={estilos.rotulo}>{um ? "CONTATO PARA REVISITAR" : "CONTATOS PARA REVISITAR"}</Text>
        <Text style={estilos.titulo}>{um ? um.nome : `${contatos.length} contatos`}</Text>
        {um?.estudo ? <Text style={estilos.seloCabeca}>ESTUDO BÍBLICO</Text> : null}
        <Text style={estilos.data}>{dataDe(new Date())}</Text>
      </LinearGradient>
      {contatos.map((c, i) => (
        <View key={c.id} style={[estilos.ficha, i > 0 && estilos.borda]}>
          {um ? null : (
            <View style={estilos.nomeLinha}>
              <Text style={estilos.nome}>
                {i + 1}. {c.nome}
              </Text>
              {c.estudo ? <Text style={estilos.selo}>ESTUDO BÍBLICO</Text> : null}
            </View>
          )}
          {linhasDe(c, false).map((l) => (
            <Text key={l.rotulo} style={estilos.linha}>
              <Text style={estilos.linhaRotulo}>{l.rotulo}: </Text>
              {l.valor}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
});

const estilos = StyleSheet.create({
  // Longe da área visível, sem opacity 0: view invisível por opacidade sai em branco no print de alguns Android.
  fora: { position: "absolute", left: -10000, top: 0 },
  cartao: { width: 600, backgroundColor: "#FFFFFF" },
  cabeca: { paddingHorizontal: 32, paddingVertical: 28, gap: 4 },
  rotulo: { fontSize: 13, fontWeight: "800", letterSpacing: 1.5, color: "#D9F2E8" },
  titulo: { fontSize: 30, fontWeight: "900", color: "#FFFFFF" },
  seloCabeca: { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: "hidden", fontSize: 12, fontWeight: "800", letterSpacing: 1, color: "#0A7F61", backgroundColor: "#FFFFFF" },
  data: { marginTop: 6, fontSize: 15, fontWeight: "600", color: "#D9F2E8" },
  ficha: { paddingHorizontal: 32, paddingVertical: 20, gap: 6 },
  borda: { borderTopWidth: 1, borderTopColor: "#D5E8DF" },
  nomeLinha: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 2 },
  nome: { fontSize: 22, fontWeight: "900", color: "#0E2A21" },
  selo: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: "hidden", fontSize: 12, fontWeight: "800", letterSpacing: 1, color: "#433BB3", backgroundColor: "#ECEBFB" },
  linha: { fontSize: 17, lineHeight: 24, color: "#4F6B61" },
  linhaRotulo: { fontWeight: "800", color: "#0E2A21" },
});
