import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type {
  DirigenteSaida,
  QuadroDirigente,
  QuadroDirigenteResumo,
  SaidaCampo,
  StatusQuadro,
} from "@/api/types";

export function useDirigentesQuadros() {
  return useQuery({
    queryKey: qk.dirigentesQuadros,
    queryFn: () =>
      apiRequest<QuadroDirigenteResumo[]>("/dirigentes/quadros"),
  });
}

export function useDirigentesQuadro(id: string | number) {
  return useQuery({
    queryKey: qk.dirigentesQuadro(id),
    queryFn: () => apiRequest<QuadroDirigente>(`/dirigentes/quadros/${id}`),
    enabled: String(id).length > 0,
  });
}

export function useCriarDirigenteQuadro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      mes: number;
      ano: number;
      autoPreenchimento: boolean;
    }) =>
      apiRequest<QuadroDirigenteResumo>("/dirigentes/quadros", {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.dirigentesQuadros }),
  });
}

export function useAtualizarStatusDirigente(id: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: StatusQuadro) =>
      apiRequest(`/dirigentes/quadros/${id}/status`, {
        method: "PUT",
        body: { status },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.dirigentesQuadro(id) });
      qc.invalidateQueries({ queryKey: qk.dirigentesQuadros });
    },
  });
}

export function useExcluirDirigenteQuadro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) =>
      apiRequest(`/dirigentes/quadros/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.dirigentesQuadros }),
  });
}

export function useAtualizarEscala(quadroId: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      escalaId: number;
      campo: "principal" | "substituto";
      valor: string;
    }) => apiRequest("/dirigentes/escala", { method: "PUT", body: payload }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.dirigentesQuadro(quadroId) }),
  });
}

export function useExcluirDiaEscala(quadroId: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: string) =>
      apiRequest("/dirigentes/escala/dia", {
        method: "DELETE",
        body: { quadroId: Number(quadroId), data },
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.dirigentesQuadro(quadroId) }),
  });
}

// Saídas de campo & disponibilidade de dirigentes
export function useSaidasCampo() {
  return useQuery({
    queryKey: qk.saidasCampo,
    queryFn: () => apiRequest<SaidaCampo[]>("/saidas-campo"),
  });
}

export type SaidaCampoInput = {
  diaSemana: string;
  turno: number;
  local: string;
  horario: string;
};

export function useCriarSaida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaidaCampoInput) =>
      apiRequest<SaidaCampo>("/saidas-campo", { method: "POST", body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.saidasCampo }),
  });
}

export function useAtualizarSaida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: number } & Partial<SaidaCampoInput>) => {
      const { id, ...rest } = payload;
      return apiRequest<SaidaCampo>(`/saidas-campo/${id}`, { method: "PUT", body: rest });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.saidasCampo }),
  });
}

export function useExcluirSaida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/saidas-campo/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.saidasCampo }),
  });
}

export function useDirigenteDisponibilidade(irmaoId: number | undefined) {
  return useQuery({
    queryKey: qk.dirigenteDisponibilidade(irmaoId ?? 0),
    queryFn: () =>
      apiRequest<DirigenteSaida[]>(`/dirigentes/disponibilidade/${irmaoId}`),
    enabled: !!irmaoId,
  });
}

export function useAtualizarDirigenteDisponibilidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { irmaoId: number; saidasCampoIds: number[] }) =>
      apiRequest("/dirigentes/disponibilidade", {
        method: "PUT",
        body: payload,
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: qk.dirigenteDisponibilidade(vars.irmaoId),
      });
    },
  });
}
