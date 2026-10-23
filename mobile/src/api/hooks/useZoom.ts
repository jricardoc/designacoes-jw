import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type { ArquivoSelecionado } from "@/api/hooks/useReunioes";
import type { EstadoZoom, PaginaReunioesZoom, ResultadoImportacaoZoom, ReuniaoZoomDetalhe } from "@/api/types";

/**
 * Os relatórios das reuniões do Zoom, que o servidor recebe sozinho (webhook + API do Zoom).
 *
 * Enquanto alguma parte ainda está sendo buscada no Zoom, a tela pergunta de novo a cada 15 s:
 * o resumo e a transcrição chegam minutos depois do fim da reunião, e a lista se completa
 * sem o irmão precisar puxar.
 */
const ENQUANTO_SINCRONIZA_MS = 15_000;

export function useEstadoZoom() {
  return useQuery({
    queryKey: qk.zoomEstado,
    queryFn: () => apiRequest<EstadoZoom>("/zoom/estado"),
  });
}

export function useReunioesZoom({ de, ate, busca }: { de: string; ate: string; busca: string }) {
  return useInfiniteQuery({
    queryKey: qk.zoomReunioes(de, ate, busca),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<PaginaReunioesZoom>(
        `/zoom/reunioes?de=${de}&ate=${ate}&busca=${encodeURIComponent(busca)}&pagina=${pageParam}`,
      ),
    getNextPageParam: (ultima) =>
      (ultima.pagina + 1) * ultima.porPagina < ultima.total ? ultima.pagina + 1 : undefined,
    refetchInterval: (query) =>
      query.state.data?.pages.some((p) => p.reunioes.some((r) => r.situacao === "sincronizando"))
        ? ENQUANTO_SINCRONIZA_MS
        : false,
  });
}

export function useReuniaoZoom(id: number) {
  return useQuery({
    queryKey: qk.zoomReuniao(id),
    queryFn: () => apiRequest<ReuniaoZoomDetalhe>(`/zoom/reunioes/${id}`),
    enabled: Number.isInteger(id) && id > 0,
    refetchInterval: (query) => (query.state.data?.situacao === "sincronizando" ? ENQUANTO_SINCRONIZA_MS : false),
  });
}

/** A transcrição vem à parte (pode ser grande) e só quando a aba é aberta. */
export function useTranscricaoZoom(id: number, ativo: boolean) {
  return useQuery({
    queryKey: qk.zoomTranscricao(id),
    queryFn: () => apiRequest<{ texto: string | null }>(`/zoom/reunioes/${id}/transcricao`),
    enabled: ativo && Number.isInteger(id) && id > 0,
  });
}

function useInvalidarZoom() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["zoom-reunioes"] });
    qc.invalidateQueries({ queryKey: ["zoom-reuniao"] });
    qc.invalidateQueries({ queryKey: ["zoom-transcricao"] });
    qc.invalidateQueries({ queryKey: qk.zoomEstado });
  };
}

/** Recupera as reuniões de um período (AAAA-MM-DD) que ainda não chegaram. */
export function useSincronizarPeriodoZoom() {
  const invalidar = useInvalidarZoom();
  return useMutation({
    mutationFn: (body: { de: string; ate: string; forcar?: boolean }) =>
      apiRequest<{ encontradas: number; novas: number; avisos: string[] }>("/zoom/sincronizar", {
        method: "POST",
        body,
        timeoutMs: 90_000,
      }),
    onSuccess: invalidar,
  });
}

/** Busca de novo o que falta de uma reunião (ou tudo, com `forcar`). */
export function useSincronizarReuniaoZoom() {
  const invalidar = useInvalidarZoom();
  return useMutation({
    mutationFn: ({ id, forcar }: { id: number; forcar?: boolean }) =>
      apiRequest<{ ok: boolean; partes: string[] }>(`/zoom/reunioes/${id}/sincronizar`, {
        method: "POST",
        body: { forcar: !!forcar },
      }),
    onSuccess: invalidar,
  });
}

/**
 * Importa os relatórios de uso exportados do zoom.us (CSV), vários de uma vez. É o caminho
 * enquanto a conta do Zoom não tem o app da API.
 */
export function useImportarRelatorioZoom() {
  const qc = useQueryClient();
  const invalidar = useInvalidarZoom();
  return useMutation({
    mutationFn: (arquivos: ArquivoSelecionado[]) => {
      const form = new FormData();
      for (const a of arquivos) {
        form.append("files", { uri: a.uri, name: a.name || "relatorio.csv", type: a.mimeType || "text/csv" } as unknown as Blob);
      }
      return apiRequest<ResultadoImportacaoZoom>("/zoom/importar", { method: "POST", body: form, timeoutMs: 180_000 });
    },
    onSuccess: () => {
      invalidar();
      qc.invalidateQueries({ queryKey: qk.assistencias });
    },
  });
}

/** Junta os participantes em "quem assistiu pelo Zoom" da assistência daquele dia. */
export function useLevarParaAssistencia() {
  const qc = useQueryClient();
  const invalidar = useInvalidarZoom();
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest<{ data: string; tipo: string; adicionados: number; total: number }>(
        `/zoom/reunioes/${id}/assistencia`,
        { method: "POST" },
      ),
    onSuccess: () => {
      invalidar();
      // A lista de quem assistiu pelo Zoom mora debaixo de ["assistencias"].
      qc.invalidateQueries({ queryKey: qk.assistencias });
    },
  });
}
