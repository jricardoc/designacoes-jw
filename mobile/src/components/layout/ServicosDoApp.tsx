import { router } from "expo-router";
import { useEffect } from "react";
import { AvisoAtualizacao } from "@/components/AvisoAtualizacao";
import { BloqueioBiometria } from "@/components/BloqueioBiometria";
import { enviarErros } from "@/lib/erros";
import { useAuth } from "@/context/AuthContext";
import { CamadaTour, ControleTour } from "@/tour/CamadaTour";
import { cancelarTour, novidadesVistas } from "@/tour/estado";
import { esperarAbertura } from "@/utils/abertura";
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
  // Leva nova de novidades: a tela abre sozinha uma vez, depois da abertura (e da ida para a tela
  // inicial, logo após o login). Fechada, oferece o tutorial do ambiente.
  const usuarioId = useAuth().usuario?.id ?? null;
  useEffect(() => {
    let cancelado = false;
    esperarAbertura()
      .then(() => new Promise((r) => setTimeout(r, 700)))
      .then(() => novidadesVistas(usuarioId))
      .then((vistas) => {
        if (!cancelado && !vistas) router.push("/novidades");
      });
    return () => {
      cancelado = true;
    };
  }, [usuarioId]);
  // Saiu da conta no meio do tutorial: ele não volta na próxima pessoa.
  useEffect(() => () => cancelarTour(), []);
  return (
    <>
      <ControleTour />
      <AvisoAtualizacao />
      {/* Depois da faixa de atualização, para o tutorial ficar por cima dela. */}
      <CamadaTour />
      {/* Face ID / digital ao abrir o app, para quem ligou na Conta. Por cima de tudo. */}
      <BloqueioBiometria />
    </>
  );
}
