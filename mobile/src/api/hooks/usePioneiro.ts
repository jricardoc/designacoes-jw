import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type {
  AgendaPioneiro,
  CronometroPioneiro,
  NovaRevisita,
  PainelPioneiro,
  PlanoSaida,
  ProgressoPioneiro,
  RegistroHoras,
  RelatorioCampo,
  Revisita,
  RevisitaDetalhe,
  TipoVisita,
  Viagem,
  ViagensMes,
} from "@/api/types";

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
    mutationFn: ({ id, ...body }: { id: number; tipo?: TipoVisita; data?: string; observacao?: string | null; proximaVisita?: string | null }) =>
      apiRequest<{ revisita: RevisitaDetalhe }>(`/pioneiro/revisitas/${id}/visitas`, { method: "POST", body }),
    onSuccess: invalidar,
  });
}

/** Visitas marcadas, planos de saída (meus e dos companheiros) e saídas de campo do período. */
export function useAgendaPioneiro(de: string, ate: string) {
  return useQuery({
    queryKey: qk.pioneiroAgenda(de, ate),
    queryFn: () => apiRequest<AgendaPioneiro>(`/pioneiro/agenda?de=${de}&ate=${ate}`),
  });
}

export function useSalvarPlano() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (body: { data: string; hora: string; duracaoMin: number; local?: string | null; nota?: string | null }) =>
      apiRequest<{ plano: PlanoSaida }>("/pioneiro/planos", { method: "POST", body }),
    onSuccess: invalidar,
  });
}

export function useApagarPlano() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: number) => apiRequest<{ ok: boolean }>(`/pioneiro/planos/${id}`, { method: "DELETE" }),
    onSuccess: invalidar,
  });
}

export function useViagens(mes: string) {
  return useQuery({
    queryKey: qk.pioneiroViagens(mes),
    queryFn: () => apiRequest<ViagensMes>(`/pioneiro/viagens?mes=${mes}`),
  });
}

export function useSalvarViagem() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (body: { data: string; km: string | number; custo?: string | number | null; nota?: string | null }) =>
      apiRequest<{ viagem: Viagem }>("/pioneiro/viagens", { method: "POST", body }),
    onSuccess: invalidar,
  });
}

export function useApagarViagem() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: number) => apiRequest<{ ok: boolean }>(`/pioneiro/viagens/${id}`, { method: "DELETE" }),
    onSuccess: invalidar,
  });
}

/** O ano de serviço mês a mês, os emblemas e a quilometragem do mês. */
export function useProgresso(mes: string) {
  return useQuery({
    queryKey: qk.pioneiroProgresso(mes),
    queryFn: () => apiRequest<ProgressoPioneiro>(`/pioneiro/progresso?mes=${mes}`),
  });
}

export function useAtualizarPerfilPioneiro() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (body: { metaMensal?: number; compartilharPlanos?: boolean }) =>
      apiRequest<{ metaMensal: number; compartilharPlanos: boolean }>("/pioneiro/perfil", { method: "PUT", body }),
    onSuccess: invalidar,
  });
}

/** O token do calendário que o celular assina (`trocar` derruba o link antigo). */
export function useLinkCalendario() {
  return useMutation({
    mutationFn: (trocar: boolean) => apiRequest<{ token: string }>("/pioneiro/calendario", { method: "POST", body: { trocar } }),
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
