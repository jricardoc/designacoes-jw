/**
 * Conferência do cronômetro sem internet: node --no-warnings scripts/verificarCronometro.mjs
 * O celular aplica as ações que esperam a rede como o servidor aplicaria.
 */
import { comPendentes } from "../src/components/ministerio/cronometroFila.ts";

let falhas = 0;
const ok = (condicao, descricao) => {
  console.log(`${condicao ? "   ok  " : "   FALHA"} ${descricao}`);
  if (!condicao) falhas += 1;
};

const t0 = Date.parse("2026-10-24T08:00:00Z");
const min = (n) => t0 + n * 60000;
const parado = { rodando: false, inicio: null, acumuladoSeg: 0 };

const pausado = comPendentes(parado, [
  { acao: "iniciar", em: t0 },
  { acao: "pausar", em: min(30) },
]);
ok(!pausado.rodando && pausado.acumuladoSeg === 1800, "iniciar e pausar guardam os 30 min");
const deNovo = comPendentes(pausado, [
  { acao: "iniciar", em: min(40) },
  { acao: "iniciar", em: min(45) },
]);
ok(deNovo.rodando && Date.parse(deNovo.inicio) === min(40) && deNovo.acumuladoSeg === 1800, "iniciar de novo com ele rodando não recomeça");
ok(comPendentes(deNovo, [{ acao: "parar", em: min(70) }]).acumuladoSeg === 0, "parar zera (as horas sobem com a fila)");
const doServidor = { rodando: true, inicio: new Date(t0).toISOString(), acumuladoSeg: 600 };
ok(comPendentes(doServidor, [{ acao: "pausar", em: min(20) }]).acumuladoSeg === 1800, "pausar soma ao que o servidor já tinha");
ok(comPendentes(parado, [{ acao: "pausar", em: min(5) }]) === parado, "pausar parado não muda nada");
ok(comPendentes(doServidor, []) === doServidor, "sem pendentes: o do servidor");

if (falhas) {
  console.log(`\n${falhas} falha(s).`);
  process.exit(1);
}
