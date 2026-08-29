import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type {
  OpcaoTarefa,
  PainelTarefas,
  RespostaTarefas,
  TarefaAtribuivel,
  TipoTarefa,
} from "@/api/types";

/**
 * As tarefas pendentes do irmão logado — o To-Do da tela de início.
 *
 * O prazo vem calculado do backend (o texto "Vence hoje" inclusive), e não é recalculado
 * aqui: o mesmo prazo governa o push, e duas contas separadas acabariam discordando sobre a
 * mesma tarefa — foi o que já aconteceu com o horário dos compromissos.
 */
export function useTarefas() {
  return useQuery({
    queryKey: qk.tarefas,
    queryFn: () => apiRequest<RespostaTarefas>("/tarefas"),
    // O prazo vira à meia-noite e o quadro pode ser publicado a qualquer hora: um minuto de
    // frescor evita a ida à rede a cada foco sem deixar a lista envelhecer na tela.
    staleTime: 60_000,
  });
}

/**
 * Marca (ou desmarca) uma ocorrência como cumprida.
 *
 * O backend devolve a lista já recalculada, e ela é escrita direto no cache: sem isso o card
 * ficaria na tela até o próximo refetch, e o irmão tocaria em "Concluí" duas vezes achando
 * que não pegou.
 */
export function useConcluirTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      tipo,
      ocorrencia,
      desfazer,
    }: {
      tipo: TipoTarefa;
      ocorrencia: string;
      desfazer?: boolean;
    }) =>
      apiRequest<RespostaTarefas & { concluida: boolean }>("/tarefas/concluir", {
        method: "POST",
        body: { tipo, ocorrencia, desfazer: desfazer === true },
      }),
    onSuccess: (dados) => qc.setQueryData(qk.tarefas, dados),
  });
}

/**
 * O catálogo das tarefas atribuíveis.
 *
 * Vem do backend, e não de uma lista aqui, pelo mesmo motivo do catálogo de escopos: uma
 * tarefa nova aparece no app sem precisar de build.
 */
export function useCatalogoTarefas(enabled = true) {
  return useQuery({
    queryKey: qk.catalogoTarefas,
    queryFn: () => apiRequest<{ tarefas: OpcaoTarefa[] }>("/tarefas/catalogo"),
    enabled,
    staleTime: 30 * 60_000,
  });
}

/** As tarefas de um usuário específico (tela do admin geral). */
export function useTarefasDoUsuario(usuarioId: number | null) {
  return useQuery({
    queryKey: qk.tarefasUsuario(usuarioId ?? 0),
    queryFn: () =>
      apiRequest<{ tarefas: TarefaAtribuivel[] }>(`/usuarios/${usuarioId}/tarefas`),
    enabled: !!usuarioId,
  });
}

/**
 * Define as tarefas de um usuário. Substitui a lista inteira — a tela manda o estado final
 * das caixas marcadas, como em `useAtualizarEscopos`.
 */
export function useDefinirTarefas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tarefas }: { id: number; tarefas: TarefaAtribuivel[] }) =>
      apiRequest<{ tarefas: TarefaAtribuivel[] }>(`/usuarios/${id}/tarefas`, {
        method: "PUT",
        body: { tarefas },
      }),
    onSuccess: (_dados, { id }) => {
      qc.invalidateQueries({ queryKey: qk.tarefasUsuario(id) });
      // O admin pode estar designando para si mesmo — e aí a própria tela de início muda.
      qc.invalidateQueries({ queryKey: qk.tarefas });
    },
  });
}

/**
 * O painel do admin geral. `enabled` para a consulta não sair antes de a tela saber que
 * quem está olhando é admin — o backend recusaria com 403 e o erro apareceria à toa.
 */
export function usePainelTarefas(janelaDias: number, enabled = true) {
  return useQuery({
    queryKey: qk.painelTarefas(janelaDias),
    queryFn: () => apiRequest<PainelTarefas>(`/tarefas/painel?janela=${janelaDias}`),
    enabled,
    // Lê a programação e os quadros inteiros: não é consulta para repetir a cada foco.
    staleTime: 2 * 60_000,
  });
}

/** Cobra um irmão, agora, sobre uma pendência específica. */
export function useLembrarTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (corpo: { usuarioId: number; tipo: TipoTarefa; ocorrencia: string }) =>
      apiRequest<{ mensagem: string; enviados: number }>("/tarefas/lembrar", {
        method: "POST",
        body: corpo,
      }),
    // A pendência continua pendente (o irmão ainda não fez), mas outra coisa pode ter mudado
    // desde que a tela carregou — recarregar é barato e evita cobrar duas vezes algo que já
    // foi cumprido enquanto o admin olhava.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["painel-tarefas"] }),
  });
}
