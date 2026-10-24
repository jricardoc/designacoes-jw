/**
 * Conferência das visitas sem internet: node --no-warnings scripts/verificarVisitasFila.mjs
 * As conversas de hoje contam a visita guardada no celular como o servidor vai contar.
 */
import { conversasComPendentes } from "../src/components/ministerio/visitasFila.ts";

let falhas = 0;
const ok = (condicao, descricao) => {
  console.log(`${condicao ? "   ok  " : "   FALHA"} ${descricao}`);
  if (!condicao) falhas += 1;
};

const item = (id, feita = null) => ({ id, nome: `Contato ${id}`, feita });
const hoje = { total: 3, feitas: 1, itens: [item(1), item(2, "conversa"), item(3)] };

ok(conversasComPendentes(hoje, []) === hoje, "sem nada na fila: o mesmo objeto");
const comUma = conversasComPendentes(hoje, [{ revisitaId: 1, tipo: "nao_em_casa" }]);
ok(comUma.feitas === 2 && comUma.itens[0].feita === "nao_em_casa", "a visita guardada conta como feita, com o tipo dela");
ok(comUma.total === 3 && comUma.itens[2].feita === null, "o total e as outras não mudam");
const jaFeita = conversasComPendentes(hoje, [{ revisitaId: 2, tipo: "estudo" }]);
ok(jaFeita.feitas === 1 && jaFeita.itens[1].feita === "conversa", "a que o servidor já contou fica como está");
ok(conversasComPendentes(hoje, [{ revisitaId: 9, tipo: "conversa" }]).feitas === 1, "visita de quem não está nas de hoje não mexe na conta");
ok(hoje.feitas === 1 && hoje.itens[0].feita === null, "não muda o painel guardado");

console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
