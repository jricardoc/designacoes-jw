import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { ArquivoSelecionado } from "@/api/hooks/useReunioes";
import { qk } from "@/api/queryKeys";
import type {
  DetalheGrupo,
  FichaMembro,
  GrupoCampo,
  MeuRelatorio,
  NovoRelatorio,
  PainelGrupos,
  PeriodoGrupo,
  PreviaDivisao,
  RelatorioCampo,
  ResultadoDivisao,
  ResumoRelatorioMes,
} from "@/api/types";

/**
 * Os grupos de campo da congregação.
 *
 * Leitura livre — o cadastro de publicador precisa da lista para montar o seletor. Criar,
 * renomear e excluir é do admin geral (o backend exige, e a tela de Ajustes só oferece a ele).
 */
export function useGrupos() {
  return useQuery({
    queryKey: qk.grupos,
    queryFn: () => apiRequest<GrupoCampo[]>("/grupos"),
    // Mudam raramente: renomear um grupo é coisa de troca de designação.
    staleTime: 5 * 60_000,
  });
}

/** Invalida a lista de grupos E a de publicadores: o nome do grupo aparece nas duas. */
function useInvalidarGrupos() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.grupos });
    qc.invalidateQueries({ queryKey: qk.irmaos });
  };
}

export function useCriarGrupo() {
  const invalidar = useInvalidarGrupos();
  return useMutation({
    mutationFn: (nome: string) =>
      apiRequest<GrupoCampo>("/grupos", { method: "POST", body: { nome } }),
    onSuccess: invalidar,
  });
}

export function useAtualizarGrupo() {
  const invalidar = useInvalidarGrupos();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; nome?: string; ordem?: number; ativo?: boolean }) =>
      apiRequest<GrupoCampo>(`/grupos/${id}`, { method: "PUT", body }),
    onSuccess: invalidar,
  });
}

export function useExcluirGrupo() {
  const invalidar = useInvalidarGrupos();
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest<{ success: boolean; publicadoresSemGrupo: number }>(`/grupos/${id}`, {
        method: "DELETE",
      }),
    onSuccess: invalidar,
  });
}

// --- Relatório de serviço de campo ------------------------------------------

/** Os grupos que o usuário abre (o próprio, ou todos), com o andamento do relatório do mês. */
export function usePainelGrupos(mes: string) {
  return useQuery({
    queryKey: qk.painelGrupos(mes),
    queryFn: () => apiRequest<PainelGrupos>(`/grupos/painel?mes=${mes}`),
    placeholderData: keepPreviousData,
  });
}

/** Um grupo: o relatório do mês de cada membro e o que cada um fez no período. */
export function useDetalheGrupo(id: number, mes: string, periodo: PeriodoGrupo) {
  return useQuery({
    queryKey: qk.detalheGrupo(id, mes, periodo),
    queryFn: () => apiRequest<DetalheGrupo>(`/grupos/${id}/detalhe?mes=${mes}&periodo=${periodo}`),
    enabled: Number.isInteger(id) && id > 0,
    // Trocar o mês ou o período não pisca a tela: o anterior fica até o novo chegar.
    placeholderData: keepPreviousData,
  });
}

/** A ficha de um irmão do grupo (relatórios, Zoom, designações e contato). */
export function useFichaMembro(grupoId: number, irmaoId: number) {
  return useQuery({
    queryKey: qk.fichaMembro(grupoId, irmaoId),
    queryFn: () => apiRequest<FichaMembro>(`/grupos/${grupoId}/membros/${irmaoId}`),
    enabled: grupoId > 0 && irmaoId > 0,
  });
}

/** O total da congregação no mês. Só para o secretário e o admin (o backend recusa os outros). */
export function useResumoRelatorio(mes: string, ativo: boolean) {
  return useQuery({
    queryKey: qk.resumoRelatorio(mes),
    queryFn: () => apiRequest<ResumoRelatorioMes>(`/relatorios-campo/resumo?mes=${mes}`),
    enabled: ativo,
    placeholderData: keepPreviousData,
  });
}

/** Anotar um relatório mexe no grupo, no painel, no total e na tarefa de "pedir o relatório". */
function useInvalidarRelatorio() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["grupo-detalhe"] });
    qc.invalidateQueries({ queryKey: ["grupos-painel"] });
    qc.invalidateQueries({ queryKey: ["relatorio-resumo"] });
    qc.invalidateQueries({ queryKey: qk.tarefas });
  };
}

/** O relatório do próprio irmão no mês, para "Registrar o campo" abrir preenchido. */
export function useMeuRelatorio(mes: string, ativo: boolean) {
  return useQuery({
    queryKey: qk.meuRelatorio(mes),
    queryFn: () => apiRequest<MeuRelatorio>(`/relatorios-campo/meu?mes=${mes}`),
    enabled: ativo,
    retry: false,
  });
}

/** O próprio irmão manda o relatório: cai no relatório do grupo. */
export function useEnviarMeuRelatorio() {
  const qc = useQueryClient();
  const invalidar = useInvalidarRelatorio();
  return useMutation({
    mutationFn: (body: Omit<NovoRelatorio, "irmaoId">) => apiRequest<RelatorioCampo>("/relatorios-campo/meu", { method: "PUT", body }),
    onSuccess: () => {
      invalidar();
      qc.invalidateQueries({ queryKey: ["meu-relatorio"] });
    },
  });
}

export function useSalvarRelatorio() {
  const invalidar = useInvalidarRelatorio();
  return useMutation({
    mutationFn: (body: NovoRelatorio) =>
      apiRequest<RelatorioCampo>("/relatorios-campo", { method: "PUT", body }),
    onSuccess: invalidar,
  });
}

export function useApagarRelatorio() {
  const invalidar = useInvalidarRelatorio();
  return useMutation({
    mutationFn: (id: number) => apiRequest<{ ok: boolean }>(`/relatorios-campo/${id}`, { method: "DELETE" }),
    onSuccess: invalidar,
  });
}

/** Quem é o secretário (admin geral). `null` tira. */
export function useDefinirSecretario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (irmaoId: number | null) =>
      apiRequest<{ success: boolean }>("/grupos/secretario", { method: "PUT", body: { irmaoId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grupos-painel"] }),
  });
}

// --- Nova divisão dos grupos (PDF da lista) ---------------------------------

/** Lê o PDF e casa os nomes com o cadastro. Não grava nada. */
export function usePreviaDivisao() {
  return useMutation({
    mutationFn: (file: ArquivoSelecionado) => {
      const form = new FormData();
      form.append("file", {
        uri: file.uri,
        name: file.name || "grupos.pdf",
        type: file.mimeType || "application/pdf",
      } as unknown as Blob);
      return apiRequest<PreviaDivisao>("/grupos/divisao/previa", { method: "POST", body: form });
    },
  });
}

export interface DivisaoParaAplicar {
  grupos: {
    numero: number;
    local: string | null;
    dirigente: { membro: string } | { irmaoId: number } | null;
    ajudante: { membro: string } | { irmaoId: number } | null;
    membros: { nomeDocumento: string; irmaoId?: number; pioneiro: boolean }[];
  }[];
  tirarDosGrupos: boolean;
}

export function useAplicarDivisao() {
  const qc = useQueryClient();
  const invalidarRelatorio = useInvalidarRelatorio();
  return useMutation({
    mutationFn: (body: DivisaoParaAplicar) =>
      apiRequest<ResultadoDivisao>("/grupos/divisao/aplicar", { method: "POST", body, timeoutMs: 90_000 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.grupos });
      qc.invalidateQueries({ queryKey: qk.irmaos });
      invalidarRelatorio();
    },
  });
}
