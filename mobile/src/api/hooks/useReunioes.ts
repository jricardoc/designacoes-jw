import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type {
  AssistenciaReuniao,
  ImportarReuniaoResponse,
  OpcaoCompartilhamento,
  TipoAssistencia,
} from "@/api/types";

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
 * A mensagem pronta para confirmar a designação com quem tem parte na semana.
 *
 * Função solta, e não hook: é pedida no TOQUE do botão, não na abertura da tela. A saudação
 * depende da hora, então buscar antes mandaria "Bom dia" numa mensagem enviada às 15h.
 *
 * O texto vem montado do backend pelo mesmo motivo dos convites de Zoom — ver
 * ConviteReuniaoService.
 */
export function buscarTextoConfirmacao(nome: string) {
  return apiRequest<{ texto: string }>(
    `/reunioes/confirmacao?nome=${encodeURIComponent(nome)}`,
  );
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

/**
 * Todos os registros de assistência, do mais recente para o mais antigo. É a
 * fonte tanto do pré-preenchimento da folha de registro quanto das
 * estatísticas da tela de Reunião — o cálculo é do app (são poucas linhas).
 */
export function useAssistencias() {
  return useQuery({
    queryKey: qk.assistencias,
    queryFn: () => apiRequest<AssistenciaReuniao[]>("/reunioes/assistencias"),
  });
}

/** Grava (ou corrige) a assistência de uma reunião — upsert por (data, tipo). */
export function useSalvarAssistencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      data: string;
      tipo: TipoAssistencia;
      presencial: number;
      zoom: number;
    }) =>
      apiRequest<{ success: boolean; assistencia: AssistenciaReuniao }>(
        "/reunioes/assistencias",
        { method: "PUT", body: payload },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.assistencias }),
  });
}

/** Remove um registro de assistência (lançado na reunião errada, por exemplo). */
export function useExcluirAssistencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest<{ success: boolean }>(`/reunioes/assistencias/${id}`, {
        method: "DELETE",
      }),
    // onSettled, não onSuccess: um 404 significa que OUTRO aparelho já removeu
    // o registro — o cache local é que está atrasado, e sem a invalidação a
    // folha continuaria pré-preenchida com um registro fantasma.
    onSettled: () => qc.invalidateQueries({ queryKey: qk.assistencias }),
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
