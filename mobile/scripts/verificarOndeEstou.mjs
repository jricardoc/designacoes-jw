/**
 * Conferência do "Você está no território": node --no-warnings scripts/verificarOndeEstou.mjs
 * Sem app nem rede: o Node 24 lê o .ts direto (só tira os tipos).
 */
import { distanciaAoPoligono, territorioDoPonto } from "../src/territorios/onde.ts";

let falhas = 0;
const ok = (condicao, descricao) => {
  console.log(`${condicao ? "   ok  " : "   FALHA"} ${descricao}`);
  if (!condicao) falhas += 1;
};

// Duas quadras de ~100 m em Itapuã, separadas por uma rua de ~20 m (0,00018° de longitude).
const M_LNG = 1 / (111_320 * Math.cos((-12.94 * Math.PI) / 180));
const quadra = (lng0) => [[-12.94, lng0], [-12.94, lng0 + 100 * M_LNG], [-12.9391, lng0 + 100 * M_LNG], [-12.9391, lng0]];
const t01 = { numero: "01", quadras: [{ pontos: quadra(-38.36) }] };
const t02 = { numero: "02", quadras: [{ pontos: quadra(-38.36 + 120 * M_LNG) }] };
const todos = [t01, t02];

ok(distanciaAoPoligono([-12.93955, -38.36 + 50 * M_LNG], quadra(-38.36)) === 0, "dentro da quadra: distância 0");
const d = distanciaAoPoligono([-12.93955, -38.36 + 110 * M_LNG], quadra(-38.36));
ok(Math.abs(d - 10) < 0.5, `na rua, a 10 m da quadra: ${d.toFixed(2)} m`);
ok(territorioDoPonto([-12.93955, -38.36 + 50 * M_LNG], todos)?.numero === "01", "dentro da quadra do 01: território 01");
ok(territorioDoPonto([-12.93955, -38.36 + 105 * M_LNG], todos)?.numero === "01", "na rua, a 5 m do 01 e 15 m do 02: território 01");
ok(territorioDoPonto([-12.93955, -38.36 + 118 * M_LNG], todos)?.numero === "02", "na rua, a 18 m do 01 e 2 m do 02: território 02");
ok(territorioDoPonto([-12.93955, -38.36 + 400 * M_LNG], todos) === null, "a 180 m de qualquer quadra: nenhum");
ok(territorioDoPonto([-12.93955, -38.36], [{ numero: "x", quadras: [{ pontos: [[0, 0], [0, 1]] }] }]) === null, "polígono com menos de 3 pontos: ignorado");

console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
