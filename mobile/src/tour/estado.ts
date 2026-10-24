import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname } from "expo-router";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { View } from "react-native";
import type { Usuario } from "@/api/types";
import { useAuth } from "@/context/AuthContext";
import { esperarAbertura } from "@/utils/abertura";
import type { Ambiente } from "@/utils/ambiente";
import { ehAdminGeral, podeGerenciar, podeMarcarTerritorio, podeUsarPioneiro, podeVerGrupos } from "@/utils/permissoes";
import { VERSAO_NOVIDADES } from "./novidades";
import { TOURS, type Passo, type Regra } from "./passos";

/**
 * O tutorial do app: qual passo está na tela, os alvos que as telas registram e o que cada um já
 * viu. Um estado só, fora do React, porque quem desenha (CamadaTour, na raiz e dentro do menu
 * lateral) e quem é destacado (as barras, os cabeçalhos) moram em árvores diferentes.
 */

export const REGRAS: Record<Regra, (u: Usuario | null) => boolean> = {
  pioneiro: podeUsarPioneiro,
  marcarTerritorio: podeMarcarTerritorio,
  "gerenciar:dirigentes": (u) => podeGerenciar(u, "dirigentes"),
  "gerenciar:territorios": (u) => podeGerenciar(u, "territorios"),
  "gerenciar:reunioes": (u) => podeGerenciar(u, "reunioes"),
  adminGeral: ehAdminGeral,
  verGrupos: podeVerGrupos,
};

export interface TourAtivo {
  ambiente: Ambiente;
  /** De quem é: o "já vi" fica guardado por pessoa (duas contas no mesmo celular). */
  usuarioId: number | null;
  /** Só os passos que valem para quem está logado. */
  passos: Passo[];
  i: number;
  /** Para onde ia: um passo opcional sem alvo pula no mesmo sentido. */
  direcao: 1 | -1;
}

let atual: TourAtivo | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((ouvir) => ouvir());

const assinar = (ouvir: () => void) => {
  ouvintes.add(ouvir);
  return () => {
    ouvintes.delete(ouvir);
  };
};
const foto = () => atual;

export const useTour = () => useSyncExternalStore(assinar, foto);

export const tourAtivo = () => atual !== null;

export function iniciarTour(ambiente: Ambiente, usuario: Usuario | null) {
  atual = {
    ambiente,
    usuarioId: usuario?.id ?? null,
    passos: TOURS[ambiente].filter((p) => !p.se || REGRAS[p.se](usuario)),
    i: 0,
    direcao: 1,
  };
  avisar();
}

function irPara(i: number) {
  if (!atual) return;
  if (i >= atual.passos.length) return encerrarTour();
  atual = { ...atual, direcao: i >= atual.i ? 1 : -1, i: Math.max(0, i) };
  avisar();
}

export const proximoPasso = () => atual && irPara(atual.i + 1);
export const passoAnterior = () => atual && (atual.i === 0 ? encerrarTour() : irPara(atual.i - 1));
/** O passo não tem o que mostrar: segue no sentido em que vinha (do primeiro, só para a frente). */
export const pularPasso = () => atual && irPara(atual.direcao === -1 && atual.i > 0 ? atual.i - 1 : atual.i + 1);

/** Fim, por concluir ou por "pular": conta como visto (o "Tutorial" de Ajustes refaz). */
export function encerrarTour() {
  if (!atual) return;
  const { ambiente, usuarioId } = atual;
  cancelarTour();
  AsyncStorage.setItem(chaveTour(ambiente, usuarioId), "1").catch(() => {});
}

/** Some sem contar como visto: a conta saiu no meio dele. */
export function cancelarTour() {
  if (!atual) return;
  atual = null;
  acoes.fecharMenu?.();
  avisar();
}

// --- O que as telas registram -------------------------------------------------------------

const alvos = new Map<string, View>();
const refs = new Map<string, (n: View | null) => (() => void) | undefined>();

/**
 * O ref de um alvo do tutorial: `<Pressable ref={alvoTour("servir.menu")} collapsable={false}>`.
 * Uma função por id, sempre a mesma (o React não religa a cada render), e serve dentro de `map`.
 * A limpeza que ela devolve é de cada view: dois iguais montados ao mesmo tempo não se apagam.
 * `collapsable={false}`: sem isso o Android pode achatar a view, e ela não tem como ser medida.
 */
export function alvoTour(id: string) {
  let ref = refs.get(id);
  if (!ref) {
    ref = (n) => {
      if (!n) return;
      alvos.set(id, n);
      return () => {
        if (alvos.get(id) === n) alvos.delete(id);
      };
    };
    refs.set(id, ref);
  }
  return ref;
}

export const alvoDoTour = (id: string) => alvos.get(id);

type AcaoTour = "abrirMenu" | "fecharMenu" | "mostrarAmbientes";
const acoes: Partial<Record<AcaoTour, () => void>> = {};

/** O que o tutorial pede a uma tela (abrir o menu lateral, mostrar os ambientes nele). */
export function useAcaoTour(nome: AcaoTour, fn: () => void) {
  useEffect(() => {
    acoes[nome] = fn;
    return () => {
      if (acoes[nome] === fn) delete acoes[nome];
    };
  }, [nome, fn]);
}

export const executarAcaoTour = (nome: AcaoTour) => acoes[nome]?.();

// --- O que cada um já viu ------------------------------------------------------------------

const TODOS: Ambiente[] = ["servir", "ministerio", "territorio", "estudo"];
const chaveTour = (a: Ambiente, usuarioId: number | null) => `tour:${usuarioId ?? "-"}:${a}:v1`;
const chaveNovidades = (usuarioId: number | null) => `novidades:${usuarioId ?? "-"}`;

/** Sem como ler (armazenamento com problema): conta como visto, para não insistir a cada abertura. */
async function lido(chave: string, valor: string) {
  try {
    return (await AsyncStorage.getItem(chave)) === valor;
  } catch {
    return true;
  }
}

export const tourVisto = (a: Ambiente, usuarioId: number | null) => lido(chaveTour(a, usuarioId), "1");
export const novidadesVistas = (usuarioId: number | null) => lido(chaveNovidades(usuarioId), VERSAO_NOVIDADES);
export const marcarNovidadesVistas = (usuarioId: number | null) =>
  AsyncStorage.setItem(chaveNovidades(usuarioId), VERSAO_NOVIDADES).catch(() => {});

/** "Tutorial do app" em Ajustes: cada ambiente mostra o dele de novo na próxima entrada. */
export const esquecerTours = (usuarioId: number | null) =>
  AsyncStorage.multiRemove(TODOS.map((a) => chaveTour(a, usuarioId))).catch(() => {});

/** Em qual ambiente a rota está (as telas soltas da raiz, como Notificações, são do Servir Mais). */
export function ambienteDaRota(rota: string): Ambiente {
  if (rota.startsWith("/ministerio")) return "ministerio";
  if (rota.startsWith("/territorio")) return "territorio";
  if (rota.startsWith("/estudo")) return "estudo";
  return "servir";
}

/**
 * No layout de cada ambiente: na primeira vez nele, o tutorial começa sozinho, depois da abertura
 * e se não houver novidades para mostrar (quem fecha as novidades escolhe fazer o tour ou não).
 */
export function useTourAutomatico(ambiente: Ambiente) {
  const { usuario } = useAuth();
  const pathname = usePathname();
  const agora = useRef({ pathname, usuario });
  useEffect(() => {
    agora.current = { pathname, usuario };
  }, [pathname, usuario]);
  const logado = !!usuario;

  useEffect(() => {
    if (!logado) return;
    let cancelado = false;
    const aqui = () => !cancelado && !atual && agora.current.pathname !== "/novidades" && ambienteDaRota(agora.current.pathname) === ambiente;
    (async () => {
      await esperarAbertura();
      // Depois das transições de entrada (e do push das novidades, se houver).
      await new Promise((r) => setTimeout(r, 1200));
      const id = agora.current.usuario?.id ?? null;
      if (!aqui() || !(await novidadesVistas(id)) || (await tourVisto(ambiente, id))) return;
      if (aqui()) iniciarTour(ambiente, agora.current.usuario);
    })();
    return () => {
      cancelado = true;
    };
  }, [logado, ambiente]);
}
