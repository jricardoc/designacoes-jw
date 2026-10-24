import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useCronometro } from "@/api/hooks/usePioneiro";
import type { CronometroPioneiro } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { useToast } from "@/components/ui";
import { usePendentes } from "@/territorios/fila";
import { comPendentes, type AcaoCronometro } from "./cronometroFila";
import { doisDig, duracao } from "./escolhas";

/** 4520 -> "1:15:20" */
export const relogio = (s: number) => `${Math.floor(s / 3600)}:${doisDig(Math.floor((s % 3600) / 60))}:${doisDig(s % 60)}`;

/**
 * O cronômetro do ministério: o tempo que anda na tela e as ações. Quem guarda o tempo é o
 * servidor, então o Início do Ministério e o do Servir Mais mostram o mesmo relógio. Sem
 * internet, as ações esperam na fila e o relógio já anda com elas.
 */
export function useControleCronometro(doServidor: CronometroPioneiro | undefined) {
  const toast = useToast();
  const { feito } = useCelebracao();
  const mutacao = useCronometro();
  const pendentes = usePendentes("cronometro");
  const c = doServidor && comPendentes(doServidor, pendentes.map((i) => i.corpo as { acao: AcaoCronometro; em: number }));
  const [agora, setAgora] = useState(() => Date.now());
  const rodando = !!c?.rodando;

  // O relógio anda na tela de segundo em segundo.
  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [rodando]);

  const segundos = c ? c.acumuladoSeg + (c.rodando && c.inicio ? Math.max(0, Math.floor((agora - new Date(c.inicio).getTime()) / 1000)) : 0) : 0;
  const emAndamento = !!c && (c.rodando || c.acumuladoSeg > 0);

  const acao = (a: AcaoCronometro) =>
    mutacao.mutate(a, {
      onSuccess: (r) => {
        if (r.naFila && a === "parar") toast.show("Sem internet: as horas sobem quando o sinal voltar");
        else if (r.naFila && a !== "descartar") toast.show("Sem internet: o cronômetro segue no celular e sobe quando o sinal voltar");
        if (a === "parar" && r.registro) feito({ titulo: "Horas lançadas", detalhe: `${duracao(r.registro.minutos)} de hoje`, icone: "time" });
        if (a === "iniciar") setAgora(Date.now());
      },
      onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu", "error"),
    });

  const parar = () => {
    const minutos = Math.round(segundos / 60);
    if (minutos < 1) {
      acao("descartar");
      toast.show("Menos de 1 minuto: não lançado");
      return;
    }
    Alert.alert("Parar o cronômetro?", `Lança ${duracao(minutos)} hoje.`, [
      { text: "Continuar", style: "cancel" },
      { text: "Descartar", style: "destructive", onPress: () => acao("descartar") },
      { text: "Lançar", onPress: () => acao("parar") },
    ]);
  };

  return { segundos, rodando, emAndamento, acao, parar, pendente: mutacao.isPending };
}
