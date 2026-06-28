import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type {
  Quadro,
  QuadroResumo,
  RegrasAutoPreenchimento,
  StatusQuadro,
} from "@/api/types";

export function useQuadros() {
  return useQuery({
    queryKey: qk.quadros,
    queryFn: () => apiRequest<QuadroResumo[]>("/quadros"),
  });
}

export function useQuadro(id: string | number) {
  return useQuery({
    queryKey: qk.quadro(id),
    queryFn: () => apiRequest<Quadro>(`/quadros/${id}`),
    enabled: id !== undefined && id !== null && String(id).length > 0,
  });
}

export function useCriarQuadro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      mes: number;
      ano: number;
      autoPreenchimento: boolean;
      regras: RegrasAutoPreenchimento | null;
    }) => apiRequest<QuadroResumo>("/quadros", { method: "POST", body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.quadros }),
  });
}

export function useAtualizarStatusQuadro(id: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: StatusQuadro) =>
      apiRequest(`/quadros/${id}`, { method: "PUT", body: { status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.quadro(id) });
      qc.invalidateQueries({ queryKey: qk.quadros });
      qc.invalidateQueries({ queryKey: qk.historico(id) });
    },
  });
}

export function useExcluirQuadro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) =>
      apiRequest(`/quadros/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.quadros }),
  });
}

export function useAtualizarDesignacao(quadroId: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      data: string;
      funcao: string;
      campo: "irmao1" | "irmao2";
      valor: string;
    }) =>
      apiRequest("/quadros/designacao", {
        method: "PUT",
        body: { quadroId: Number(quadroId), ...payload },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.historico(quadroId) });
    },
  });
}

export function useExcluirDia(quadroId: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { data: string; motivo: string }) =>
      apiRequest("/quadros/dias", {
        method: "DELETE",
        body: { quadroId: Number(quadroId), ...payload },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.quadro(quadroId) });
      qc.invalidateQueries({ queryKey: qk.historico(quadroId) });
    },
  });
}
