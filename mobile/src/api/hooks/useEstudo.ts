import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import { enfileirar, novaChave } from "@/territorios/fila";
import type { AssuntoEstudo, EstadoEstudo, PerfilEstudo, RotinaEstudo, SessaoEstudo, TipoAssunto, TipoRotina } from "@/api/types";

/**
 * O estudo pessoal: uma consulta só traz tudo (perfil, trechos lidos, assuntos, sessões e
 * rotina), e toda mudança a renova. É do próprio usuário: o servidor usa o login, nunca um id
 * vindo daqui.
 */
export function useEstudo() {
  return useQuery({ queryKey: qk.estudo, queryFn: () => apiRequest<EstadoEstudo>("/estudo") });
}

function useRenovar() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: qk.estudo });
}

export function usePerfilEstudo() {
  const renovar = useRenovar();
  return useMutation({
    mutationFn: (body: Partial<Pick<PerfilEstudo, "plano" | "opcao" | "inicio" | "ritmo" | "planoB">>) =>
      apiRequest<{ perfil: PerfilEstudo }>("/estudo/perfil", { method: "PUT", body }),
    onSuccess: renovar,
  });
}

/**
 * Marcar e desmarcar trechos lidos (e a joia de um trecho). Muda a tela na hora: o quadrículo
 * não pode esperar a rede para acender. Passa pela fila (src/territorios/fila): sem internet,
 * fica no celular com a hora em que foi marcado e sobe sozinho depois.
 */
export function useMarcarLeitura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { plano: PerfilEstudo["plano"]; itens: string[]; lido?: boolean; nota?: string | null }) => {
      const r = await enfileirar({ clientKey: novaChave(), tipo: "leitura", corpo: { ...body, em: Date.now() }, titulo: "Leitura da Bíblia" });
      if (r.erro) throw new Error(r.erro);
      return { naFila: !r.enviado };
    },
    onMutate: async (b) => {
      await qc.cancelQueries({ queryKey: qk.estudo });
      const antes = qc.getQueryData<EstadoEstudo>(qk.estudo);
      if (antes) {
        const tinha = new Map(antes.leituras.filter((l) => l.plano === b.plano).map((l) => [l.item, l]));
        const resto = antes.leituras.filter((l) => !(l.plano === b.plano && b.itens.includes(l.item)));
        const novas =
          b.lido === false
            ? []
            : b.itens.map((item) => ({
                plano: b.plano,
                item,
                dia: tinha.get(item)?.dia ?? antes.hoje,
                nota: b.nota !== undefined ? b.nota : (tinha.get(item)?.nota ?? null),
              }));
        qc.setQueryData<EstadoEstudo>(qk.estudo, { ...antes, leituras: [...resto, ...novas] });
      }
      return { antes };
    },
    onError: (_e, _b, ctx) => {
      if (ctx?.antes) qc.setQueryData(qk.estudo, ctx.antes);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.estudo }),
  });
}

type CorpoAssunto = { titulo?: string; tipo?: TipoAssunto; link?: string | null; nota?: string | null; estudado?: boolean };

export function useSalvarAssunto() {
  const renovar = useRenovar();
  return useMutation({
    mutationFn: ({ id, ...body }: CorpoAssunto & { id?: number }) =>
      apiRequest<{ assunto: AssuntoEstudo }>(id ? `/estudo/assuntos/${id}` : "/estudo/assuntos", { method: id ? "PUT" : "POST", body }),
    onSuccess: renovar,
  });
}

export function useApagarAssunto() {
  const renovar = useRenovar();
  return useMutation({
    mutationFn: (id: number) => apiRequest<{ ok: boolean }>(`/estudo/assuntos/${id}`, { method: "DELETE" }),
    onSuccess: renovar,
  });
}

/** O cronômetro do estudo (no servidor): iniciar, concluir (com o resumo) ou descartar. */
export function useSessaoEstudo() {
  const renovar = useRenovar();
  return useMutation({
    mutationFn: (
      body:
        | { acao: "iniciar"; assuntoId?: number | null }
        | { acao: "descartar" }
        | { acao: "concluir"; minutos?: number; resumo?: string; aplicacao?: string; estudado?: boolean; ideias?: string[] },
    ) => apiRequest<{ perfil?: PerfilEstudo; sessao?: SessaoEstudo; ideias?: number }>("/estudo/sessao", { method: "POST", body }),
    onSuccess: renovar,
  });
}

export function useRegistrarEstudo() {
  const renovar = useRenovar();
  return useMutation({
    mutationFn: (body: { dia: string; minutos: number; assuntoId?: number | null; titulo?: string; resumo?: string; aplicacao?: string }) =>
      apiRequest<{ sessao: SessaoEstudo }>("/estudo/sessoes", { method: "POST", body }),
    onSuccess: renovar,
  });
}

export function useApagarEstudo() {
  const renovar = useRenovar();
  return useMutation({
    mutationFn: (id: number) => apiRequest<{ ok: boolean }>(`/estudo/sessoes/${id}`, { method: "DELETE" }),
    onSuccess: renovar,
  });
}

export function useSalvarRotina() {
  const renovar = useRenovar();
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: number; tipo: TipoRotina; dias: number[]; hora: string; avisoMin: number | null }) =>
      apiRequest<{ rotina?: RotinaEstudo; ok?: boolean }>(id ? `/estudo/rotina/${id}` : "/estudo/rotina", { method: id ? "PUT" : "POST", body }),
    onSuccess: renovar,
  });
}

export function useApagarRotina() {
  const renovar = useRenovar();
  return useMutation({
    mutationFn: (id: number) => apiRequest<{ ok: boolean }>(`/estudo/rotina/${id}`, { method: "DELETE" }),
    onSuccess: renovar,
  });
}
