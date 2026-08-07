import type { EscopoAdmin, Usuario } from "@/api/types";

/**
 * Níveis de admin por área.
 *
 * Espelha backend/src/middleware/escopos.js — a decisão que VALE é a de lá; aqui
 * é só para a tela não oferecer o que vai voltar 403. Divergir dos dois lados
 * não abre brecha de segurança, mas gera botão que não funciona.
 *
 * Admin geral (`isAdmin`) contempla todos os escopos.
 */
export function podeGerenciar(
  usuario: Usuario | null | undefined,
  escopo: EscopoAdmin,
): boolean {
  if (!usuario) return false;
  if (usuario.isAdmin) return true;
  return Array.isArray(usuario.escopos) && usuario.escopos.includes(escopo);
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
