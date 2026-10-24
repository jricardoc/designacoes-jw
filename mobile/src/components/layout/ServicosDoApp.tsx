import { useEffect } from "react";
import { AvisoAtualizacao } from "@/components/AvisoAtualizacao";
import { BloqueioBiometria } from "@/components/BloqueioBiometria";
import { enviarErros } from "@/lib/erros";
import { usePushNotifications } from "@/notifications/usePushNotifications";
import { useSincronizarNotificacoes } from "@/notifications/useSincronizarNotificacoes";
import { useSincronizarFila } from "@/territorios/fila";

/**
 * O que roda com o irmão logado, em qualquer ambiente (Servir Mais ou Ministério). Mora na
 * raiz, montado UMA vez: antes ficava no layout de (tabs), e cada layout que montasse de novo
 * (o do Ministério, ou um segundo (tabs) empilhado) abriria outra rodada de listeners de push
 * e outro bloqueio por biometria.
 */
export function ServicosDoApp() {
  // Registra o dispositivo para notificações push após o login.
  usePushNotifications();
  // E puxa do servidor a cópia dos avisos que o aparelho perdeu.
  useSincronizarNotificacoes();
  // Envia o que foi marcado no território sem internet, em qualquer tela, quando o sinal volta.
  useSincronizarFila();
  // Os erros que ficaram guardados (o fatal, o de antes do login) sobem agora.
  useEffect(() => {
    enviarErros();
  }, []);
  return (
    <>
      <AvisoAtualizacao />
      {/* Face ID / digital ao abrir o app, para quem ligou na Conta. Por cima de tudo. */}
      <BloqueioBiometria />
    </>
  );
}
