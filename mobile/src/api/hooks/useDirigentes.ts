import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type {
  DiagnosticoEscala,
  DirigenteSaida,
  QuadroDirigente,
  QuadroDirigenteResumo,
  RegrasEscala,
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
      regras?: RegrasEscala | null;
    }) =>
      apiRequest<QuadroDirigenteResumo & { diagnostico?: DiagnosticoEscala | null }>(
        "/dirigentes/quadros",
        { method: "POST", body: payload },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.dirigentesQuadros }),
  });
}

export function useRegerarDirigenteQuadro(id: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (regras: RegrasEscala) =>
      apiRequest<{ success: boolean; diagnostico: DiagnosticoEscala }>(
        `/dirigentes/quadros/${id}/regerar`,
        { method: "POST", body: { regras } },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.dirigentesQuadro(id) });
      qc.invalidateQueries({ queryKey: qk.dirigentesQuadros });
    },
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
    // Só existe o dirigente do turno: o substituto foi extinto, então não há mais `campo`.
    mutationFn: (payload: { escalaId: number; valor: string }) =>
      apiRequest("/dirigentes/escala", { method: "PUT", body: payload }),
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

/**
 * Remove a semana inteira do quadro (mesmo mecanismo do dia: marca `removido`).
 *
 * Mandamos as datas, e não o número da semana, porque "semana" é um agrupamento visual da
 * tela (abre uma nova a cada Segunda-Feira) — assim o backend não precisa reproduzir a
 * numeração que a lista montou.
 */
export function useExcluirSemanaEscala(quadroId: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datas: string[]) =>
      apiRequest<{ success: boolean; count: number; datas: string[] }>(
        "/dirigentes/escala/semana",
        {
          method: "DELETE",
          body: { quadroId: Number(quadroId), datas },
        },
      ),
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
