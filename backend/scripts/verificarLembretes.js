/**
 * Verificacao do corpo do push de lembrete (LembreteDesignacoesService.montarCorpo).
 *
 *   npm run verificar:lembretes
 *
 * Nao precisa de banco: montarCorpo e uma funcao pura sobre a lista de compromissos que
 * MinhasDesignacoesService ja devolveu.
 *
 * O que estes casos protegem: o recado por funcao tem de alcancar as DUAS grafias que chegam
 * ate aqui -- a do quadro ("Audio e Video", "Estacionamento") e a da programacao importada
 * ("Áudio e vídeo", "Portão / estacionamento"). Uma falha aqui e silenciosa: o push sai, so
 * que sem o recado, e ninguem descobre ate um irmao reclamar.
 */
const { _internos } = require('../src/services/LembreteDesignacoesService');
const { montarCorpo } = _internos;

let falhas = 0;
const chk = (ok, m) => { console.log(`${ok ? '  OK  ' : ' FALHA'} ${m}`); if (!ok) falhas++; };
const sec = (t) => console.log(`\n=== ${t} ===`);

const DATA = '2026-08-05';
const item = (titulo) => ({ titulo });

const INDICADOR = 'receber os irmãos';
const AUDIO_VIDEO = 'ligar os aparelhos';
const ESTACIONAMENTO = 'apoiar o estacionamento';

sec('grafia do quadro de designacoes');
chk(montarCorpo([item('Indicador')], DATA).includes(INDICADOR),
    'Indicador leva o recado de indicador');
chk(montarCorpo([item('Audio e Video')], DATA).includes(AUDIO_VIDEO),
    '"Audio e Video" (sem acento, como o quadro grava) leva o recado de A/V');
chk(montarCorpo([item('Estacionamento')], DATA).includes(ESTACIONAMENTO),
    'Estacionamento leva o recado de estacionamento');

sec('grafia da programacao importada');
chk(montarCorpo([item('Áudio e vídeo')], DATA).includes(AUDIO_VIDEO),
    '"Áudio e vídeo" (com acento) leva o mesmo recado de A/V');
chk(montarCorpo([item('Portão / estacionamento')], DATA).includes(ESTACIONAMENTO),
    '"Portão / estacionamento" leva o recado de estacionamento');

sec('quem NAO tem recado');
const microfone = montarCorpo([item('Microfone Volante')], DATA);
chk(!microfone.includes(INDICADOR) && !microfone.includes(AUDIO_VIDEO) && !microfone.includes(ESTACIONAMENTO),
    'Microfone volante continua sem recado extra');
chk(montarCorpo([item('Leitura da Bíblia')], DATA) === 'Leitura da Bíblia - amanhã, 05/08',
    'parte da reuniao sem mecanica mantem o corpo antigo, intacto');

sec('combinacoes');
const dois = montarCorpo([item('Leitura da Bíblia'), item('Indicador')], DATA);
chk(dois.startsWith('Leitura da Bíblia e mais 1 - amanhã, 05/08'),
    'a designacao vem primeiro; o recado nao rouba o comeco do corpo');
chk(dois.includes(INDICADOR), 'o recado sai mesmo quando a funcao nao e o primeiro item');

const repetido = montarCorpo([item('Indicador'), item('Indicador')], DATA);
chk(repetido.split(INDICADOR).length - 1 === 1, 'servir duas vezes na mesma funcao nao repete o recado');

const duas = montarCorpo([item('Indicador'), item('Estacionamento')], DATA);
chk(duas.includes(INDICADOR) && duas.includes(ESTACIONAMENTO),
    'duas funcoes no mesmo dia levam os dois recados');

sec('texto exato pedido pela congregacao');
chk(montarCorpo([item('Indicador')], DATA) ===
    'Indicador - amanhã, 05/08\n\nSe esforce para chegar mais cedo e receber os irmãos. Obrigado pelo apoio!',
    'corpo completo do indicador');
chk(montarCorpo([item('Audio e Video')], DATA) ===
    'Audio e Video - amanhã, 05/08\n\nSe esforce para chegar mais cedo e lembre-se de ligar os aparelhos, abrir o zoom e ativar a enquete. Obrigado!',
    'corpo completo do audio e video');
chk(montarCorpo([item('Estacionamento')], DATA) ===
    'Estacionamento - amanhã, 05/08\n\nSe esforce para chegar mais cedo e apoiar o estacionamento. Obrigado pelo seu apoio!',
    'corpo completo do estacionamento');

console.log(`\n${falhas === 0 ? '*** TODAS AS VERIFICACOES PASSARAM ***' : `*** ${falhas} FALHA(S) ***`}`);
process.exit(falhas === 0 ? 0 : 1);
