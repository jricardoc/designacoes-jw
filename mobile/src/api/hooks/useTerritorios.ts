import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type {
  ConflitoTerritorio,
  DesignacaoTerritorioLista,
  HistoricoTerritorio,
  Irmao,
  ListaTerritorios,
  MapaGeralTerritorios,
  PainelTerritorios,
  PreviaMyMaps,
  S13,
  TerritorioDetalhe,
} from "@/api/types";
import { comCopiaLocal } from "@/territorios/copiaLocal";

const caminho = (numero: string) => `/territorios/${encodeURIComponent(numero)}`;

export function useTerritorios() {
  return useQuery({
    queryKey: qk.territorios,
    queryFn: () => comCopiaLocal("territorios", () => apiRequest<ListaTerritorios>("/territorios/lista")),
  });
}

export function useMapaTerritorios(ativo = true) {
  return useQuery({
    queryKey: qk.territoriosMapa,
    queryFn: () => comCopiaLocal("territorios-mapa", () => apiRequest<MapaGeralTerritorios>("/territorios/mapa")),
    enabled: ativo,
    // Os polígonos só mudam com "Atualizar do My Maps".
    staleTime: 10 * 60_000,
  });
}

export function useTerritorio(numero: string | undefined) {
  return useQuery({
    queryKey: qk.territorio(numero ?? ""),
    queryFn: () => comCopiaLocal(`territorio-${numero}`, () => apiRequest<TerritorioDetalhe>(caminho(numero!))),
    enabled: !!numero,
  });
}

export function useHistoricoTerritorio(numero: string | undefined) {
  return useQuery({
    queryKey: qk.historicoTerritorio(numero ?? ""),
    queryFn: () => apiRequest<HistoricoTerritorio>(`${caminho(numero!)}/historico`),
    enabled: !!numero,
  });
}

const CHAVE_PRECARGA = "territorios:precarga";
const SEIS_HORAS = 6 * 3600_000;

/**
 * Guarda no celular o detalhe de todos os territórios (mapa, onde paramos, Não bater), de 6 em
 * 6 horas, 3 de cada vez. É o que garante o território aberto no campo SEM sinal, mesmo o que o
 * dirigente nunca abriu antes. Roda em segundo plano; falha calada (vale na próxima).
 */
export async function preCarregarTerritorios(numeros: string[]) {
  try {
    const ultima = Number(await AsyncStorage.getItem(CHAVE_PRECARGA));
    if (Date.now() - ultima < SEIS_HORAS) return;
    await AsyncStorage.setItem(CHAVE_PRECARGA, String(Date.now()));
    const fila = [...numeros];
    const trabalhador = async () => {
      for (let numero = fila.shift(); numero; numero = fila.shift()) {
        await comCopiaLocal(`territorio-${numero}`, () => apiRequest<TerritorioDetalhe>(caminho(numero!))).catch(() => {});
      }
    };
    await Promise.all([trabalhador(), trabalhador(), trabalhador()]);
  } catch {
    // Sem rede ou sem espaço: o detalhe ainda é guardado a cada abertura.
  }
}

/** Ações que exigem internet (não passam pela fila): renovam tudo de território ao terminar. */
function useAcao<V, R = unknown>(fn: (vars: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.territorios }),
  });
}

export const useReconfirmarMarcacao = () =>
  useAcao((id: number) => apiRequest(`/territorios/marcacoes/${id}/reconfirmar`, { method: "POST" }));

export const useRetirarMarcacao = () =>
  useAcao((id: number) => apiRequest(`/territorios/marcacoes/${id}`, { method: "DELETE" }));

export const useApagarSaida = () =>
  useAcao((id: number) => apiRequest(`/territorios/saidas/${id}`, { method: "DELETE" }));

// ===== Gestão (área Territórios) =====

export const usePreviaMyMaps = () =>
  useMutation({
    mutationFn: (links: string[]) =>
      apiRequest<PreviaMyMaps>("/territorios/mymaps/previa", { method: "POST", body: { links }, timeoutMs: 60000 }),
  });

export const useImportarMyMaps = () =>
  useAcao((camadas: { mid: string; camada: string; numero: string; nome: string }[]) =>
    apiRequest<{ importados: string[]; erros: { numero: string; erro: string }[] }>("/territorios/mymaps/importar", {
      method: "POST",
      body: { camadas },
      timeoutMs: 120000,
    }),
  );

export const useAtualizarMyMaps = () =>
  useAcao(() =>
    apiRequest<{ atualizados: string[]; naoEncontrados: string[]; erros: { numero: string; erro: string }[] }>(
      "/territorios/mymaps/atualizar",
      { method: "POST", timeoutMs: 120000 },
    ),
  );

export const useEditarTerritorio = () =>
  useAcao(({ id, ...dados }: { id: number; numero?: string; nome?: string; area?: string; apelidos?: string; observacoes?: string }) =>
    apiRequest(`/territorios/${id}`, { method: "PUT", body: dados }),
  );

export const useCicloTerritorio = () =>
  useAcao(({ id, acao }: { id: number; acao: "novo" | "nao_iniciado" | "retomar" }) =>
    apiRequest(`/territorios/${id}/ciclo`, { method: "POST", body: { acao } }),
  );

export const useCriarAviso = () =>
  useAcao(({ id, tipo, texto }: { id: number; tipo: string; texto: string }) =>
    apiRequest(`/territorios/${id}/avisos`, { method: "POST", body: { tipo, texto } }),
  );

export const useRemoverAviso = () =>
  useAcao((id: number) => apiRequest(`/territorios/avisos/${id}`, { method: "DELETE" }));

export function useDesignacoesTerritorio(ativo = true) {
  return useQuery({
    queryKey: qk.designacoesTerritorio,
    queryFn: () => apiRequest<DesignacaoTerritorioLista[]>("/territorios/designacoes"),
    enabled: ativo,
  });
}

export const useDesignarTerritorio = () =>
  useAcao((d: { territorioId: number; irmaoId: number; dia: string }) =>
    apiRequest("/territorios/designacoes", { method: "POST", body: d }),
  );

export const useAtualizarDesignacao = () =>
  useAcao(({ id, acao }: { id: number; acao: "concluir" | "reabrir" }) =>
    apiRequest(`/territorios/designacoes/${id}`, { method: "PUT", body: { acao } }),
  );

export const useApagarDesignacao = () =>
  useAcao((id: number) => apiRequest(`/territorios/designacoes/${id}`, { method: "DELETE" }));

/** Quem pode receber território: os irmãos com a função Dirigente. */
export function useDirigentesTerritorio(ativo = true) {
  return useQuery({
    queryKey: qk.dirigentesTerritorio,
    queryFn: () => apiRequest<Irmao[]>("/irmaos/funcao/dirigente"),
    enabled: ativo,
    staleTime: 5 * 60_000,
  });
}

export function useConflitosTerritorio(ativo = true) {
  return useQuery({
    queryKey: qk.conflitosTerritorio,
    queryFn: () => apiRequest<ConflitoTerritorio[]>("/territorios/conflitos"),
    enabled: ativo,
  });
}

export const useRevisarSaida = () =>
  useAcao(({ id, status }: { id: number; status: "ativa" | "descartada" }) =>
    apiRequest(`/territorios/saidas/${id}/revisao`, { method: "PUT", body: { status } }),
  );

export function usePainelTerritorios(dias: number) {
  return useQuery({
    queryKey: qk.painelTerritorios(dias),
    queryFn: () => apiRequest<PainelTerritorios>(`/territorios/painel?dias=${dias}`),
  });
}

export const buscarS13 = (ano: number) => apiRequest<S13>(`/territorios/s13?ano=${ano}`);
