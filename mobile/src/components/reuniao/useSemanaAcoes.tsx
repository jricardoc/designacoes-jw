import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { Reuniao, SemanaReuniao } from "@/api/types";
import { useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { podeGerenciar } from "@/utils/permissoes";
import { MESES } from "@/theme";
import { exportarImagem } from "@/utils/exportImagem";
import { exportarPdf } from "@/utils/exportPdf";
import { gerarHtmlSemana } from "@/utils/pdfHtml";
import { datasDaSemana } from "@/utils/semanaReuniao";
import { AssistenciaSheet } from "./AssistenciaSheet";
import { CompartilharReuniaoSheet } from "./CompartilharReuniaoSheet";
import { SemanaCard } from "./SemanaCard";
import { SemanaShareCard } from "./SemanaShareCard";

/** A semana escolhida junto do mês/ano dela — o PDF precisa dos dois para o cabeçalho. */
export interface Alvo {
  reuniao: Reuniao;
  semana: SemanaReuniao;
}

/**
 * As ações de um cartão de semana — PDF, compartilhar (imagem via view-shot +
 * convites de texto) e registro de assistência — com os estados e overlays que
 * elas exigem. Vivia inteiro em app/(tabs)/reuniao.tsx; virou hook quando a
 * tela "Todos os meses" passou a listar os mesmos cartões.
 *
 * Uso: chamar `renderSemana(...)` para cada semana e montar `{overlays}` UMA
 * vez no fim da tela (é onde ficam o cartão escondido da captura e as folhas).
 */
export function useSemanaAcoes() {
  const { usuario } = useAuth();
  // Registrar assistência muda dados da congregação: só quem gerencia reuniões.
  // PDF e compartilhar continuam para todos — são exportações de leitura.
  const podeRegistrarAssistencia = podeGerenciar(usuario, "reunioes");
  const toast = useToast();

  // Mesma mecânica do quadro: montar o cartão fora da tela é o que dispara a captura.
  const [alvoImagem, setAlvoImagem] = useState<Alvo | null>(null);
  // A semana cujo leque de opções de compartilhamento está aberto.
  const [alvoShare, setAlvoShare] = useState<Alvo | null>(null);
  // A semana cuja assistência está sendo registrada.
  const [alvoAssistencia, setAlvoAssistencia] = useState<SemanaReuniao | null>(null);
  const [pdfDe, setPdfDe] = useState<number | null>(null);
  const shotRef = useRef<View>(null);
  const capturando = useRef(false);

  const nomeArquivo = (alvo: Alvo, ext: string) => {
    const { meio } = datasDaSemana(alvo.semana);
    const marca = meio ? meio.diaMes.replace("/", "-") : String(alvo.semana.id);
    const mes = (MESES[alvo.reuniao.mes] ?? "mes").toLowerCase();
    return `reuniao-${marca}-${mes}-${alvo.reuniao.ano}.${ext}`;
  };

  const gerarPdf = async (alvo: Alvo) => {
    setPdfDe(alvo.semana.id);
    try {
      const html = gerarHtmlSemana(
        alvo.reuniao,
        alvo.semana,
        datasDaSemana(alvo.semana),
      );
      await exportarPdf(html, nomeArquivo(alvo, "pdf"));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao gerar PDF", "error");
    } finally {
      setPdfDe(null);
    }
  };

  /** Chamado pelo onLayout do cartão escondido — antes disso a imagem sai em branco. */
  const capturarSemana = async () => {
    if (!alvoImagem || capturando.current) return;
    capturando.current = true;
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      await exportarImagem(shotRef, nomeArquivo(alvoImagem, "png"));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao gerar imagem", "error");
    } finally {
      setAlvoImagem(null);
      capturando.current = false;
    }
  };

  const renderSemana = (
    reuniao: Reuniao,
    semana: SemanaReuniao,
    index: number,
    destaque = false,
  ) => {
    // Sem data importada não há como chavear o registro por dia — o botão de
    // assistência fica de fora junto com o de quem não gerencia reuniões.
    const temData = !!datasDaSemana(semana).meio;
    return (
      <SemanaCard
        key={semana.id}
        semana={semana}
        index={index}
        destaque={destaque}
        onPdf={() => gerarPdf({ reuniao, semana })}
        onCompartilhar={() => setAlvoShare({ reuniao, semana })}
        onAssistencia={
          podeRegistrarAssistencia && temData
            ? () => setAlvoAssistencia(semana)
            : undefined
        }
        gerandoPdf={pdfDe === semana.id}
        compartilhando={alvoImagem?.semana.id === semana.id}
      />
    );
  };

  const overlays = (
    <>
      {/* Fora da tela de propósito: precisa estar montado e com layout para o view-shot
          capturar, mas não pode aparecer para o usuário. */}
      {alvoImagem ? (
        <View style={estilos.shotHost} pointerEvents="none" onLayout={capturarSemana}>
          <SemanaShareCard
            ref={shotRef}
            reuniao={alvoImagem.reuniao}
            semana={alvoImagem.semana}
          />
        </View>
      ) : null}

      <CompartilharReuniaoSheet
        semana={alvoShare?.semana ?? null}
        onClose={() => setAlvoShare(null)}
        onImagem={() => {
          if (alvoShare) setAlvoImagem(alvoShare);
        }}
      />

      <AssistenciaSheet
        semana={alvoAssistencia}
        onClose={() => setAlvoAssistencia(null)}
      />
    </>
  );

  return { renderSemana, overlays };
}

const estilos = StyleSheet.create({
  // Longe da área visível, sem opacity 0: view invisível por opacidade sai em branco no
  // print de alguns Android.
  shotHost: { position: "absolute", left: -10000, top: 0 },
});
