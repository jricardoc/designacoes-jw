import type { EscopoAdmin, Usuario } from "@/api/types";

/**
 * Níveis de admin por área.
 *
 * Espelha backend/src/middleware/escopos.js — a decisão que VALE é a de lá; aqui
 * é só para a tela não oferecer o que vai voltar 403. Divergir dos dois lados
 * não abre brecha de segurança, mas gera botão que não funciona.
 *
 * Admin geral (`isAdmin`) contempla todos os escopos; a função Áudio e Vídeo, o de reuniões.
 */
export function podeGerenciar(
  usuario: Usuario | null | undefined,
  escopo: EscopoAdmin,
): boolean {
  if (!usuario) return false;
  if (usuario.isAdmin) return true;
  if (Array.isArray(usuario.escopos) && usuario.escopos.includes(escopo)) return true;
  // A função Áudio e Vídeo do cadastro libera a área de reuniões (importar, assistência,
  // compartilhar). Só com a conta vinculada ao irmão — igual ao backend.
  return escopo === "reunioes" && !!usuario.irmao?.funcoes?.includes("audioVideo");
}

/** Tem admin geral? É o que libera cadastro de irmãos, config e usuários. */
export function ehAdminGeral(usuario: Usuario | null | undefined): boolean {
  return !!usuario?.isAdmin;
}

/**
 * Tem QUALQUER nível de admin? Serve para decidir se vale mostrar uma seção
 * administrativa inteira, não para liberar uma ação específica.
 */
export function temAlgumEscopo(usuario: Usuario | null | undefined): boolean {
  return !!usuario?.isAdmin || (usuario?.escopos?.length ?? 0) > 0;
}

/**
 * Vê a tela de Grupos? Quem dirige ou ajuda um grupo (só o próprio) e o secretário e o admin
 * geral (todos). Espelha `veTodos`/`gruposQueLidera` do RelatorioCampoService.
 */
export function podeVerGrupos(usuario: Usuario | null | undefined): boolean {
  return (
    !!usuario?.isAdmin || !!usuario?.irmao?.secretario || (usuario?.irmao?.gruposQueLidera?.length ?? 0) > 0
  );
}

/**
 * Usa a área de pioneiros? O pioneiro do cadastro (regular ou auxiliar) e o admin geral. Espelha o `contexto`
 * do PioneiroService: lá também exige a conta ligada ao cadastro (as horas são de alguém).
 */
export function podeUsarPioneiro(usuario: Usuario | null | undefined): boolean {
  return !!usuario?.isAdmin || !!usuario?.irmao?.pioneiro;
}

/**
 * Pode registrar saída e marcar pontos no território? Dirigentes (função no cadastro, com a
 * conta vinculada) e quem cuida da área. Espelha `podeMarcarTerritorio` do backend.
 */
export function podeMarcarTerritorio(usuario: Usuario | null | undefined): boolean {
  return podeGerenciar(usuario, "territorios") || !!usuario?.irmao?.funcoes?.includes("dirigente");
}
