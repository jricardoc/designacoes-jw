import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

/** Timestamp da meia-noite de hoje, no fuso do aparelho. */
function inicioDoDia(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * A meia-noite de HOJE, atualizada quando a tela volta ao foco ou o app volta
 * do background.
 *
 * Sem isto, uma tela que classifica dias em passado/próximo congela o "hoje"
 * da montagem: aberta no domingo e retomada na segunda, continuaria tratando
 * o domingo como o dia atual — e nem o puxar-para-atualizar cura, porque um
 * refetch que devolve JSON idêntico mantém a MESMA referência de dados
 * (structural sharing do React Query) e o memo que depende dela não recalcula.
 *
 * setState com o mesmo timestamp não re-renderiza, então o custo é zero
 * enquanto o dia não vira.
 */
export function useHoje(): number {
  const [hoje, setHoje] = useState(inicioDoDia);

  // Reganhar o foco (voltar de uma tela empilhada) reavalia o dia.
  useFocusEffect(
    useCallback(() => {
      setHoje(inicioDoDia());
    }, []),
  );

  // Voltar do background não redispara o focus effect — o AppState cobre.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") setHoje(inicioDoDia());
    });
    return () => sub.remove();
  }, []);

  return hoje;
}
