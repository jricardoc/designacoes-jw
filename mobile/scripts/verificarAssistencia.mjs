/**
 * Conferência das contas da assistência por mês: node --no-warnings scripts/verificarAssistencia.mjs
 */
import {
  chaveMes,
  mesesAte,
  nomeMes,
  resumoDoMes,
  reunioesDoMes,
  somarMeses,
  variacao,
} from "../src/utils/assistenciaMensal.ts";

let falhas = 0;
const eq = (achado, esperado, descricao) => {
  const ok = JSON.stringify(achado) === JSON.stringify(esperado);
  console.log(`${ok ? "   ok  " : "   FALHA"} ${descricao}${ok ? "" : `\n         esperado ${JSON.stringify(esperado)}\n         veio     ${JSON.stringify(achado)}`}`);
  if (!ok) falhas += 1;
};

const r = (data, tipo, presencial, zoom) => ({ data, tipo, presencial, zoom });
const registros = [
  r("02/10/2026", "meio", 70, 20),
  r("05/10/2026", "fds", 80, 25),
  r("09/10/2026", "meio", 72, 19),
  r("12/10/2026", "fds", 85, 30),
  r("16/10/2026", "meio", 75, 21),
  r("28/09/2026", "fds", 78, 22),
  r("xx", "meio", 1, 1),
];

eq(chaveMes("16/10/2026"), "2026-10", "chave do mês");
eq(chaveMes("ruim"), null, "data ilegível");
eq(nomeMes("2026-10"), "outubro de 2026", "nome do mês");
eq(nomeMes("2026-03", true), "mar", "nome curto");
eq(somarMeses("2026-01", -1), "2025-12", "mês anterior cruza o ano");
eq(somarMeses("2026-11", 3), "2027-02", "meses à frente cruzam o ano");
eq(mesesAte("2026-02", 4), ["2025-11", "2025-12", "2026-01", "2026-02"], "últimos 4 meses");
eq(reunioesDoMes(registros, "2026-10", "meio").map((x) => x.data), ["02/10/2026", "09/10/2026", "16/10/2026"], "reuniões do mês, em ordem");
eq(resumoDoMes(registros, "2026-10", "meio"), { reunioes: 3, total: 277, media: 92, mediaPresencial: 72, mediaZoom: 20 }, "meio de semana de outubro");
eq(resumoDoMes(registros, "2026-10"), { reunioes: 5, total: 497, media: 99, mediaPresencial: 76, mediaZoom: 23 }, "as duas reuniões de outubro");
eq(resumoDoMes(registros, "2026-08"), null, "mês sem reunião");
eq(variacao(105, 100), 5, "variação positiva");
eq(variacao(90, 100), -10, "variação negativa");
eq(variacao(90, null), null, "sem mês anterior");

console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
