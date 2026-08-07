import type { SemanaReuniao } from "@/api/types";
import {
  NOME_CONGREGACAO,
  ZOOM_FIM_DE_SEMANA,
  ZOOM_MEIO_SEMANA,
} from "@/config/zoomReunioes";
import { MESES } from "@/theme";
import { datasDaSemana } from "@/utils/semanaReuniao";

/**
 * Convites de Zoom prontos para compartilhar. O texto segue o modelo que a
 * congregação já manda no WhatsApp; só as partes variáveis (datas, leitura,
 * orador, tema, congregação) saem da programação importada.
 */

const SENTINELA_DELETADO = "__DELETADO__";

function limpo(valor?: string | null): string | null {
  if (!valor || valor === SENTINELA_DELETADO) return null;
  const t = String(valor).trim();
  return t && t !== "-" ? t : null;
}

/**
 * "01-07 de junho" (segunda a domingo). Quando a semana cruza o mês:
 * "29 de junho - 05 de julho". Sem data importada, cai no rótulo do PDF.
 */
function faixaPorExtenso(semana: SemanaReuniao): string {
  const { inicio, fds } = datasDaSemana(semana);
  if (!inicio || !fds) return semana.faixaData;

  const mesInicio = (MESES[inicio.data.getMonth() + 1] ?? "").toLowerCase();
  const mesFds = (MESES[fds.data.getMonth() + 1] ?? "").toLowerCase();

  if (inicio.data.getMonth() === fds.data.getMonth()) {
    return `${inicio.dia}-${fds.dia} de ${mesInicio}`;
  }
  return `${inicio.dia} de ${mesInicio} - ${fds.dia} de ${mesFds}`;
}

/** O ano do domingo da semana — o convite de fim de semana escreve por extenso. */
function anoDaSemana(semana: SemanaReuniao): number | null {
  const { fds } = datasDaSemana(semana);
  return fds ? fds.data.getFullYear() : null;
}

/** Tema entre aspas curvas, sem duplicar as que já vierem da programação. */
function temaEntreAspas(tema: string): string {
  if (/^["“”']/.test(tema)) return tema;
  return `“${tema}”`;
}

export function conviteZoomMeioSemana(semana: SemanaReuniao): string {
  const faixa = faixaPorExtenso(semana);
  const leitura = limpo(semana.leituraSemanal);
  const linhaSemana = leitura ? `${faixa} - ${leitura}` : faixa;

  return [
    `A Congregação ${NOME_CONGREGACAO} convida você para uma reunião Zoom`,
    linhaSemana,
    `Sala aberta: ${ZOOM_MEIO_SEMANA.salaAberta}`,
    ZOOM_MEIO_SEMANA.link,
    `ID da reunião: ${ZOOM_MEIO_SEMANA.id}`,
    `Senha de acesso: ${ZOOM_MEIO_SEMANA.senha}`,
    `"Uma boa Reunião a todos"`,
  ].join("\n\n");
}

export function conviteZoomFimDeSemana(semana: SemanaReuniao): string {
  const orador = limpo(semana.fds_orador);
  const tema = limpo(semana.fds_tema);
  const congregacao = limpo(semana.fds_congregacao);
  const ano = anoDaSemana(semana);
  const faixa = faixaPorExtenso(semana).toUpperCase();
  const linhaData = ano ? `${faixa} DE ${ano}` : faixa;

  const blocos: string[] = [
    `A Congregação ${NOME_CONGREGACAO} convida você para uma reunião Zoom`,
  ];
  if (orador) blocos.push(`Orador: ${orador}`);
  if (tema) blocos.push(`Tema: ${temaEntreAspas(tema)}`);
  if (congregacao) blocos.push(`Congregação: ${congregacao}`);
  blocos.push(
    linhaData,
    `Abertura da sala: ${ZOOM_FIM_DE_SEMANA.salaAberta}`,
    `Entrar na reunião Zoom\n${ZOOM_FIM_DE_SEMANA.link}`,
    `ID da reunião: ${ZOOM_FIM_DE_SEMANA.id}\nSenha de acesso: ${ZOOM_FIM_DE_SEMANA.senha}`,
    `Essas informações, não devem ser compartilhadas nas redes sociais.`,
    `Uma boa reunião a todos.`,
  );

  return blocos.join("\n\n");
}
