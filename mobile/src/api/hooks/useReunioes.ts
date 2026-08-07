import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type { ImportarReuniaoResponse, OpcaoCompartilhamento } from "@/api/types";

/** Arquivo escolhido pelo DocumentPicker. */
export interface ArquivoSelecionado {
  uri: string;
  name: string;
  mimeType?: string | null;
}

export interface RegistroIndisponibilidade {
  irmaoId: number;
  data: string;
  motivo?: string;
}

/**
 * Faz o upload da programação (PDF/Excel) via multipart. O backend detecta o
 * tipo, salva as semanas e devolve o preview de indisponibilidades para revisão.
 */
export function useImportarReuniao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: ArquivoSelecionado) => {
      const form = new FormData();
      // No React Native, o "arquivo" do multipart é { uri, name, type }.
      form.append("file", {
        uri: file.uri,
        name: file.name || "programacao.pdf",
        type: file.mimeType || "application/pdf",
      } as unknown as Blob);
      return apiRequest<ImportarReuniaoResponse>("/reunioes/import", {
        method: "POST",
        body: form,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.reunioes }),
  });
}

/**
 * Os textos prontos de compartilhamento da semana (os convites de Zoom).
 *
 * O app NÃO monta esses textos: eles vêm montados de
 * backend/src/services/ConviteReuniaoService.js. É o que permite mudar o texto,
 * o negrito ou os dados do Zoom com um deploy do backend, sem build novo — o
 * app não tem EAS Update, então tudo que ele monta sozinho fica preso ao build.
 */
export function useCompartilhamentosSemana(semanaId: number | null) {
  return useQuery({
    queryKey: qk.compartilhamentosSemana(semanaId ?? 0),
    queryFn: () =>
      apiRequest<{ opcoes: OpcaoCompartilhamento[] }>(
        `/reunioes/semanas/${semanaId}/compartilhamentos`,
      ),
    enabled: semanaId !== null,
    // O texto muda quando a programação é reimportada ou editada; enquanto a
    // folha está aberta não precisa reconsultar.
    staleTime: 5 * 60_000,
  });
}

/** Aplica em massa as indisponibilidades confirmadas. */
export function useAplicarIndisponibilidades() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (registros: RegistroIndisponibilidade[]) =>
      apiRequest<{ success: boolean; criados: number }>(
        "/reunioes/indisponibilidades",
        { method: "POST", body: { registros } },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.irmaos });
    },
  });
}
