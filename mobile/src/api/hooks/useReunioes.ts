import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type { ImportarReuniaoResponse } from "@/api/types";

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
