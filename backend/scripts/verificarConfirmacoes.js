/**
 * Verificacao dos textos e da montagem da tela de Confirmacoes.
 *
 *   npm run verificar:confirmacoes
 *
 * Nao precisa de banco: o que e testado aqui sao funcoes puras.
 *
 * Por que isto existe: o texto vai para o WhatsApp de um irmao. Uma saudacao errada ("Bom
 * dia" as 21h) ou um link montado com o telefone da pessoa errada nao geram erro nenhum no
 * sistema — geram uma mensagem constrangedora, e quem descobre e o irmao.
 */
const Convite = require('../src/services/ConviteReuniaoService');
const Confirmacao = require('../src/services/ConfirmacaoDesignacaoService');
const { ESCOPOS, CATALOGO_ESCOPOS, temEscopo } = require('../src/middleware/escopos');

let falhas = 0;
const chk = (ok, m) => { console.log(`${ok ? '  OK  ' : ' FALHA'} ${m}`); if (!ok) falhas++; };
const sec = (t) => console.log(`\n=== ${t} ===`);

// Bahia e UTC-3 o ano inteiro (nao ha horario de verao desde 2019).
const emBahia = (hora) => new Date(Date.UTC(2026, 8, 3, hora + 3, 0, 0));

sec('saudacao pela hora da congregacao');
const { saudacaoDaHora, nomeDeTratamento } = Convite._internos;
chk(saudacaoDaHora(emBahia(0)) === 'Bom dia', 'meia-noite ainda e "Bom dia"');
chk(saudacaoDaHora(emBahia(11)) === 'Bom dia', '11h e "Bom dia"');
chk(saudacaoDaHora(emBahia(12)) === 'Boa tarde', 'meio-dia vira "Boa tarde"');
chk(saudacaoDaHora(emBahia(17)) === 'Boa tarde', '17h ainda e "Boa tarde"');
chk(saudacaoDaHora(emBahia(18)) === 'Boa noite', '18h vira "Boa noite"');
chk(saudacaoDaHora(emBahia(23)) === 'Boa noite', '23h e "Boa noite"');
// O servidor roda em UTC: as 23h de Bahia sao 02h do dia seguinte la. Sem o fuso, a
// mensagem sairia "Bom dia" para quem esta indo dormir.
chk(saudacaoDaHora(new Date(Date.UTC(2026, 8, 4, 2, 0))) === 'Boa noite',
    'a hora e a da congregacao, nao a UTC do servidor');

sec('como a pessoa e chamada');
chk(nomeDeTratamento('Jucélia dos Santos Gomes') === 'Jucélia', 'so o primeiro nome');
chk(nomeDeTratamento('Maria Eduarda dos S. Gomes de Araújo') === 'Maria Eduarda',
    '"Maria" sozinha nao identifica ninguem: leva o segundo nome junto');
chk(nomeDeTratamento('José Ricardo Carvalho') === 'José Ricardo', 'idem para "José"');
chk(nomeDeTratamento('Átilas Santos') === 'Átilas', 'nome comum fica so com o primeiro');
chk(nomeDeTratamento('Kauã') === 'Kauã', 'nome de uma palavra so');
chk(nomeDeTratamento('  Ana  Lúcia  Portela ') === 'Ana Lúcia', 'espaco sobrando nao atrapalha');
chk(nomeDeTratamento('') === '' && nomeDeTratamento(null) === '', 'vazio nao vira nome');

sec('a mensagem inteira');
chk(Convite.textoConfirmacaoDesignacao('Jucélia dos Santos', emBahia(9))
    === 'Bom dia Jucélia! Tudo certinho com a sua designação?', 'texto de manha');
chk(Convite.textoConfirmacaoDesignacao('Átilas Santos', emBahia(19))
    === 'Boa noite Átilas! Tudo certinho com a sua designação?', 'texto de noite');
chk(Convite.textoConfirmacaoDesignacao('', emBahia(9)) === null, 'sem nome nao ha mensagem');

sec('quem entra na lista de confirmacao');
const { nomesDoCampo, tituloLimpo, chaveData } = Confirmacao._internos;
chk(nomesDoCampo('Jucélia dos Santos / Lúcia Tânia Assad').length === 2,
    'a dupla separada por "/" vira duas pessoas');
chk(nomesDoCampo('Grupo 1 & Grupo 2').length === 2, '"&" tambem separa');
chk(nomesDoCampo('__DELETADO__').length === 0, 'linha excluida pela web nao entra');
chk(nomesDoCampo('-').length === 0 && nomesDoCampo('A definir').length === 0,
    'marcador de vazio nao vira pessoa');
chk(nomesDoCampo(null).length === 0, 'campo nulo nao quebra');
chk(Confirmacao.CAMPOS_CONFIRMACAO.length === 10,
    'as 10 vagas de estudante: Leitura da Biblia e 4 partes do ministerio, x2 salas');
chk(Confirmacao.CAMPOS_CONFIRMACAO.every(c => c.sala === 'principal' || c.sala === 'salaB'),
    'toda vaga sabe em que sala acontece');
// So o que esta na lista pode virar linha no banco: o campo entra numa chave unica e vem da rede.
chk(!Confirmacao.CAMPOS_VALIDOS.has('presidente') && !Confirmacao.CAMPOS_VALIDOS.has('xpto'),
    'campo fora da lista e recusado');
chk(Confirmacao.CAMPOS_VALIDOS.has('tesouro3_salaB'), 'campo da lista e aceito');

sec('titulo e data');
chk(tituloLimpo('20:02 4. Iniciando conversas (3 min)') === 'Iniciando conversas (3 min)',
    'a hora e o numero saem do titulo');
chk(tituloLimpo('') === null, 'titulo vazio vira null');
chk(chaveData('03/09/2026') === 20260903, 'a data vira numero comparavel');
chk(chaveData('10/09/2026') > chaveData('03/09/2026'), 'ordena por dia dentro do mes');
chk(chaveData('03/10/2026') > chaveData('28/09/2026'), 'e atravessa a virada do mes');
chk(chaveData('sem data') === 0, 'data ilegivel nao quebra a ordenacao');

sec('link do WhatsApp');
const { linkWhatsApp } = Confirmacao._internos;
chk(linkWhatsApp('(71) 99999-8888', 'Oi') === 'https://wa.me/5571999998888?text=Oi',
    'pontuacao sai e o 55 do Brasil entra');
chk(linkWhatsApp('5571999998888', 'Oi') === 'https://wa.me/5571999998888?text=Oi',
    'numero que ja tem o 55 nao ganha outro');
chk(linkWhatsApp('999', 'Oi') === null, 'numero curto demais nao vira link');
chk(linkWhatsApp(null, 'Oi') === null && linkWhatsApp('', 'Oi') === null,
    'sem numero nao ha link — a tela cai no compartilhamento comum');
chk(linkWhatsApp('71999998888', 'Bom dia Ana! Tudo certinho?').includes('Bom%20dia%20Ana'),
    'o texto vai codificado na URL');

sec('o escopo novo');
chk(ESCOPOS.CONFIRMACOES === 'confirmacoes', 'o escopo existe');
chk(CATALOGO_ESCOPOS.some(e => e.id === 'confirmacoes'),
    'e aparece no catalogo, senao a tela de permissoes nao o oferece');
chk(temEscopo({ isAdmin: true }, ESCOPOS.CONFIRMACOES), 'admin geral ve as confirmacoes');
chk(temEscopo({ escopos: ['confirmacoes'] }, ESCOPOS.CONFIRMACOES), 'quem tem o cargo ve');
chk(!temEscopo({ escopos: ['reunioes'] }, ESCOPOS.CONFIRMACOES),
    'quem so importa a programacao NAO ve: sao areas diferentes');
chk(!temEscopo(null, ESCOPOS.CONFIRMACOES), 'sem usuario nao ve');

console.log(`\n${falhas === 0 ? '*** TODAS AS VERIFICACOES PASSARAM ***' : `*** ${falhas} FALHA(S) ***`}`);
process.exit(falhas === 0 ? 0 : 1);
