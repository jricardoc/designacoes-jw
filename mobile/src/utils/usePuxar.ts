import { useCallback, useState } from "react";

/**
 * Estado do "puxar para atualizar": o spinner só aparece quando o DEDO puxou.
 *
 * Ligar o RefreshControl no `isRefetching` do TanStack Query mostrava o spinner também nas
 * recargas de fundo (depois de salvar ou remover algo, ao voltar para a tela). No iPhone, um
 * `refreshing` ligado por código empurra o conteúdo para baixo e às vezes não devolve: a tela
 * ficava com o spinner parado e um vão em cima até sair e entrar de novo.
 *
 * Uso: `<RefreshControl {...usePuxar(refetch)} />`, ou com várias listas,
 * `usePuxar(() => Promise.all([refetch(), outra.refetch()]))`.
 */
export function usePuxar(recarregar: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await recarregar();
    } finally {
      setRefreshing(false);
    }
  }, [recarregar]);
  return { refreshing, onRefresh };
}
