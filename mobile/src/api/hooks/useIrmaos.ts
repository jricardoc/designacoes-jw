import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type { FuncaoId, Irmao, NivelAudioVideo, PrivilegioId, GeneroPessoa} from "@/api/types";

export function useIrmaos() {
  return useQuery({
    queryKey: qk.irmaos,
    queryFn: () => apiRequest<Irmao[]>("/irmaos"),
  });
}

export interface IrmaoInput {
  nome: string;
  funcoes: FuncaoId[];
  nivelAudioVideo: NivelAudioVideo;
  /** `null` limpa o privilégio; omitir mantém o valor atual (ver IrmaoController.update). */
  privilegio?: PrivilegioId | null;
  /** `null` ou "" limpam; omitir mantém. Mesma regra do privilégio. */
  genero?: GeneroPessoa | null;
  /** Formato livre: o backend guarda só os dígitos. `null`/"" limpam; omitir mantém. */
  telefone?: string | null;
  /** Grupo de campo. `null`/"" limpam; omitir mantém. */
  grupo?: string | null;
  ativo?: boolean;
}

export function useCriarIrmao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: IrmaoInput) =>
      apiRequest<Irmao>("/irmaos", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.irmaos }),
  });
}

export function useAtualizarIrmao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: IrmaoInput & { id: number }) =>
      apiRequest<Irmao>(`/irmaos/${id}`, { method: "PUT", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.irmaos }),
  });
}

export function useExcluirIrmao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/irmaos/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.irmaos }),
  });
}
