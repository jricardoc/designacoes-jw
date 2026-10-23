import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type { CronometroPioneiro, NovaRevisita, PainelPioneiro, RegistroHoras, RelatorioCampo, Revisita, RevisitaDetalhe } from "@/api/types";

/**
 * A área de pioneiros: tudo é do próprio usuário (o servidor usa o irmão do login, nunca um id
 * vindo daqui). Qualquer mudança invalida a família ["pioneiro"] inteira: o painel mostra
 * horas, estudos e próximas visitas juntos.
 */
function useInvalidar() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["pioneiro"] });
}

export function usePainelPioneiro(mes: string) {
  return useQuery({
    queryKey: qk.pioneiroPainel(mes),
    queryFn: () => apiRequest<PainelPioneiro>(`/pioneiro/painel?mes=${mes}`),
    retry: false,
  });
}

export function useCronometro() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (acao: "iniciar" | "pausar" | "parar" | "descartar") =>
      apiRequest<{ cronometro: CronometroPioneiro; registro: RegistroHoras | null }>("/pioneiro/cronometro", { method: "POST", body: { acao } }),
    onSuccess: invalidar,
  });
}

export function useLancarHoras() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (body: { data: string; minutos: number; observacao?: string | null }) =>
      apiRequest<{ registro: RegistroHoras }>("/pioneiro/horas", { method: "POST", body }),
    onSuccess: invalidar,
  });
}

export function useApagarHoras() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: number) => apiRequest<{ ok: boolean }>(`/pioneiro/horas/${id}`, { method: "DELETE" }),
    onSuccess: invalidar,
  });
}

export function useDefinirMeta() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (metaMensal: number) => apiRequest<{ metaMensal: number }>("/pioneiro/meta", { method: "PUT", body: { metaMensal } }),
    onSuccess: invalidar,
  });
}

export function useRevisitas(arquivadas = false) {
  return useQuery({
    queryKey: qk.pioneiroRevisitas(arquivadas),
    queryFn: () => apiRequest<{ revisitas: Revisita[] }>(`/pioneiro/revisitas${arquivadas ? "?arquivadas=1" : ""}`),
    select: (r) => r.revisitas,
  });
}

export function useRevisita(id: number) {
  return useQuery({
    queryKey: qk.pioneiroRevisita(id),
    queryFn: () => apiRequest<{ revisita: RevisitaDetalhe }>(`/pioneiro/revisitas/${id}`),
    select: (r) => r.revisita,
    enabled: id > 0,
  });
}

export function useSalvarRevisita() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, ...body }: NovaRevisita & { id?: number }) =>
      id
        ? apiRequest<{ revisita: RevisitaDetalhe }>(`/pioneiro/revisitas/${id}`, { method: "PUT", body })
        : apiRequest<{ revisita: RevisitaDetalhe }>("/pioneiro/revisitas", { method: "POST", body }),
    onSuccess: invalidar,
  });
}

export function useApagarRevisita() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: number) => apiRequest<{ ok: boolean }>(`/pioneiro/revisitas/${id}`, { method: "DELETE" }),
    onSuccess: invalidar,
  });
}

export function useRegistrarVisita() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; data?: string; observacao?: string | null; proximaVisita?: string | null }) =>
      apiRequest<{ revisita: RevisitaDetalhe }>(`/pioneiro/revisitas/${id}/visitas`, { method: "POST", body }),
    onSuccess: invalidar,
  });
}

/** O relatório do mês, mandado pelo próprio pioneiro: cai no relatório do grupo. */
export function useEnviarRelatorioPioneiro() {
  const qc = useQueryClient();
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (body: { mes: string; estudos: number; pioneiroAuxiliar?: boolean; observacao?: string | null }) =>
      apiRequest<{ relatorio: RelatorioCampo; minutosQueSobram: number }>("/pioneiro/relatorio", { method: "POST", body }),
    onSuccess: () => {
      invalidar();
      // O grupo dele mudou: o dirigente vê o relatório já anotado.
      qc.invalidateQueries({ queryKey: ["grupo-detalhe"] });
      qc.invalidateQueries({ queryKey: ["grupos-painel"] });
      qc.invalidateQueries({ queryKey: qk.tarefas });
    },
  });
}
