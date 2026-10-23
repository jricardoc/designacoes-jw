import { Alert, Linking } from "react-native";
import { useApagarRevisita, useSalvarRevisita } from "@/api/hooks/usePioneiro";
import type { Revisita } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { useToast } from "@/components/ui";
import { digitosDe, linkComoChegar, whatsappDe, type Acao } from "./kit";

type Contato = Pick<Revisita, "id" | "nome" | "endereco" | "lat" | "lng" | "telefone" | "ativa">;

/** As ações de um contato (o toque longo na lista e o "⋯" do detalhe): visita, rota, contato, editar, arquivar, apagar. */
export function useAcoesContato() {
  const toast = useToast();
  const { feito } = useCelebracao();
  const salvar = useSalvarRevisita();
  const apagar = useApagarRevisita();
  const abrir = (url: string) => Linking.openURL(url).catch(() => toast.show("Não consegui abrir", "error"));
  const erro = (e: unknown) => toast.show(e instanceof Error ? e.message : "Não deu", "error");

  return (r: Contato, f: { registrar: () => void; editar: () => void; aposApagar?: () => void }): Acao[] => {
    const rota = linkComoChegar(r);
    const zap = whatsappDe(r.telefone);
    const tel = digitosDe(r.telefone);
    const acoes: Acao[] = [];
    if (r.ativa) acoes.push({ rotulo: "Registrar a visita", icone: "checkmark-done", onPress: f.registrar });
    if (rota) acoes.push({ rotulo: "Navegar", icone: "navigate", onPress: () => abrir(rota) });
    if (zap) acoes.push({ rotulo: "WhatsApp", icone: "logo-whatsapp", onPress: () => abrir(zap) });
    if (tel) acoes.push({ rotulo: "Ligar", icone: "call", onPress: () => abrir(`tel:${tel}`) });
    acoes.push(
      { rotulo: "Editar", icone: "create-outline", onPress: f.editar },
      {
        rotulo: r.ativa ? "Arquivar" : "Trazer de volta",
        icone: r.ativa ? "archive-outline" : "refresh",
        onPress: () =>
          salvar.mutate(
            { id: r.id, ativa: !r.ativa },
            { onSuccess: () => feito({ titulo: r.ativa ? "Contato arquivado" : "Contato de volta", detalhe: r.nome, icone: r.ativa ? "archive" : "refresh" }), onError: erro },
          ),
      },
      {
        rotulo: "Apagar",
        icone: "trash-outline",
        perigo: true,
        onPress: () =>
          Alert.alert("Apagar este contato?", "Some também o histórico de visitas. Para só tirar da lista, use Arquivar.", [
            { text: "Cancelar", style: "cancel" },
            { text: "Apagar", style: "destructive", onPress: () => apagar.mutate(r.id, { onSuccess: f.aposApagar, onError: erro }) },
          ]),
      },
    );
    return acoes;
  };
}
