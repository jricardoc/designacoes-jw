import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import { useAuth } from "@/context/AuthContext";
import {
  sincronizarRemotas,
  type NotificacaoRemota,
} from "./historicoNotificacoes";

interface RespostaHistorico {
  historico: NotificacaoRemota[];
}

/**
 * Puxa de GET /push/historico a cópia servidor dos avisos enviados e funde com o
 * histórico local. É a rede de segurança da central: push dispensado da bandeja
 * com o app fechado não deixa rastro no aparelho — só o servidor lembra dele.
 *
 * Montado uma vez no layout autenticado, junto do usePushNotifications. A chave
 * carrega o id do usuário: troca de conta no mesmo aparelho não pode reaproveitar
 * o histórico de quem saiu (o logout também limpa o cache inteiro).
 */
export function useSincronizarNotificacoes() {
  const { usuario } = useAuth();

  const { data } = useQuery({
    queryKey: qk.notificacoesRemotas(usuario?.id ?? "anon"),
    queryFn: () => apiRequest<RespostaHistorico>("/push/historico"),
    enabled: !!usuario,
    staleTime: 5 * 60_000,
    // Backend antigo ainda sem a rota responde 404: insistir não muda nada.
    retry: false,
  });

  useEffect(() => {
    const remotas = data?.historico;
    if (Array.isArray(remotas) && remotas.length > 0) {
      sincronizarRemotas(remotas).catch(() => {});
    }
  }, [data]);
}
