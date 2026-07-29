import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type {
  CarrinhoPonto,
  CarrinhoPublicador,
  CarrinhoResposta,
  CarrinhoTurno,
} from "@/api/types";

// GET /carrinho já devolve pontos, turnos e pessoas de uma vez, então a tela toda
// vive de uma única query e qualquer mutation só precisa invalidar `qk.carrinho`.

export function useCarrinho() {
  return useQuery({
    queryKey: qk.carrinho,
    queryFn: () => apiRequest<CarrinhoResposta>("/carrinho"),
  });
}

export type PontoInput = {
  nome: string;
  cor?: string;
  ordem?: number;
};

export function useCriarPonto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PontoInput) =>
      apiRequest<CarrinhoPonto>("/carrinho/pontos", {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.carrinho }),
  });
}

export function useAtualizarPonto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      payload: { id: number; ativo?: boolean } & Partial<PontoInput>,
    ) => {
      const { id, ...rest } = payload;
      return apiRequest<CarrinhoPonto>(`/carrinho/pontos/${id}`, {
        method: "PUT",
        body: rest,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.carrinho }),
  });
}

export function useExcluirPonto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/carrinho/pontos/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.carrinho }),
  });
}

export type TurnoInput = {
  pontoId: number;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  publicadorIds?: number[];
};

export function useCriarTurno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TurnoInput) =>
      apiRequest<CarrinhoTurno>("/carrinho/turnos", {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.carrinho }),
  });
}

/** O turno não troca de ponto depois de criado, por isso `pontoId` fica de fora. */
export function useAtualizarTurno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      payload: { id: number } & Partial<Omit<TurnoInput, "pontoId">>,
    ) => {
      const { id, ...rest } = payload;
      return apiRequest<CarrinhoTurno>(`/carrinho/turnos/${id}`, {
        method: "PUT",
        body: rest,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.carrinho }),
  });
}

export function useExcluirTurno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/carrinho/turnos/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.carrinho }),
  });
}

export type PublicadorInput = {
  nome: string;
  /** String vazia limpa o telefone; campo ausente mantém o que já está salvo. */
  telefone?: string;
  turnoIds?: number[];
};

export function useCriarPublicador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PublicadorInput) =>
      apiRequest<CarrinhoPublicador>("/carrinho/publicadores", {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.carrinho }),
  });
}

export function useAtualizarPublicador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      payload: { id: number; ativo?: boolean } & Partial<PublicadorInput>,
    ) => {
      const { id, ...rest } = payload;
      return apiRequest<CarrinhoPublicador>(`/carrinho/publicadores/${id}`, {
        method: "PUT",
        body: rest,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.carrinho }),
  });
}

export function useExcluirPublicador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/carrinho/publicadores/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.carrinho }),
  });
}
