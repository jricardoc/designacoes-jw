/**
 * Confere as regras das tarefas do sistema: prazo, janela de exibicao e hora dos avisos.
 *
 *   npm run verificar:tarefas
 *
 * NAO PRECISA DE BANCO. Tudo aqui e a parte pura de RegrasTarefas e de TarefasService —
 * o "agora" e fixado, o contexto e montado a mao, e as contas sao conferidas uma a uma.
 *
 * Existe pelo mesmo motivo de verificarRegrasLembrete.js: prazo errado nao levanta excecao
 * nenhuma. Uma tarefa que vence um dia tarde nao quebra nada — so chega depois da reuniao.
 *
 * As datas usadas sao de setembro de 2026, com a reuniao de meio de semana na QUINTA
 * (03/09, 10/09) e o fim de semana no DOMINGO (06/09), que e a semana real da congregacao.
 */
const Regras = require('../src/services/RegrasTarefas');
const Tarefas = require('../src/services/TarefasService');

let falhas = 0;
const eq = (achado, esperado, descricao) => {
    const ok = JSON.stringify(achado) === JSON.stringify(esperado);
    if (ok) {
        console.log(`   ok   ${descricao}`);
    } else {
        falhas += 1;
        console.log(`   FALHA ${descricao}\n         esperado ${JSON.stringify(esperado)}\n         veio     ${JSON.stringify(achado)}`);
    }
};
const ok = (condicao, descricao) => eq(!!condicao, true, descricao);

const tipo = (id) => Regras.tipoPorId(id);

console.log('=== 1. Semana de segunda a domingo ===\n');
eq(Regras.segundaDaSemanaISO('2026-09-03'), '2026-08-31', 'quinta 03/09 -> segunda 31/08 (atravessa o mes)');
eq(Regras.domingoDaSemanaISO('2026-09-03'), '2026-09-06', 'quinta 03/09 -> domingo 06/09');
eq(Regras.segundaDaSemanaISO('2026-09-06'), '2026-08-31', 'DOMINGO pertence a semana que abriu na segunda anterior');
eq(Regras.domingoDaSemanaISO('2026-09-06'), '2026-09-06', 'domingo fecha a propria semana');
eq(Regras.segundaDaSemanaISO('2026-08-31'), '2026-08-31', 'segunda e a propria abertura');

console.log('\n=== 2. Vencimento por cadencia ===\n');
eq(Regras.vencimentoDe(tipo('zoom'), '2026-09-03'), '2026-09-02', 'Zoom vence na VESPERA da reuniao');
eq(Regras.vencimentoDe(tipo('compartilharQuadro'), '2026-09-06'), '2026-09-05', 'compartilhar o quadro tambem vence na vespera');
eq(Regras.vencimentoDe(tipo('confirmacoes'), '2026-09-03'), '2026-09-02', 'confirmacoes vencem na quarta (vespera da quinta)');
eq(Regras.vencimentoDe(tipo('limpeza'), '2026-09-03'), '2026-09-06', 'limpeza vale a semana inteira: vence no domingo');
eq(Regras.vencimentoDe(tipo('quadroDesignacoes'), '2026-08-31'), '2026-08-31', 'quadro vence no ultimo dia que ele cobre');

console.log('\n=== 3. O prazo do quadro sai do ultimo dia COBERTO, nao do fim do mes ===\n');
{
    // O caso que o irmao descreveu: hoje e 29/08 e o quadro de agosto acaba em 31/08.
    const { vencimentoISO, alvo } = Tarefas._internos.prazoDoQuadro(
        { ano: 2026, mes: 8 },
        ['03/08', '10/08', '17/08', '24/08', '31/08'],
        '2026-08-29',
    );
    eq(vencimentoISO, '2026-08-31', 'quadro de agosto termina em 31/08');
    eq(alvo, { ano: 2026, mes: 9 }, 'e o que falta montar e setembro');
}
{
    // Um quadro que acaba ANTES do fim do mes (a ultima semana ja e do mes seguinte).
    const { vencimentoISO } = Tarefas._internos.prazoDoQuadro(
        { ano: 2026, mes: 8 }, ['03/08', '10/08', '17/08', '24/08'], '2026-08-01',
    );
    eq(vencimentoISO, '2026-08-24', 'sem linha depois do dia 24, o prazo e o dia 24');
}
{
    // Quadro de janeiro que comeca em dezembro: resolverDataDeQuadro joga "29/12" para o ano
    // anterior, e o maximo continua sendo o de janeiro.
    const { vencimentoISO, alvo } = Tarefas._internos.prazoDoQuadro(
        { ano: 2026, mes: 1 }, ['29/12', '05/01', '26/01'], '2026-01-02',
    );
    eq(vencimentoISO, '2026-01-26', 'quadro de janeiro que comeca em dezembro nao se confunde');
    eq(alvo, { ano: 2026, mes: 2 }, 'e aponta para fevereiro');
}
{
    const { vencimentoISO, alvo } = Tarefas._internos.prazoDoQuadro(
        { ano: 2026, mes: 12 }, [], '2026-12-10',
    );
    eq(vencimentoISO, '2026-12-31', 'quadro sem linha nenhuma cai no ultimo dia do mes');
    eq(alvo, { ano: 2027, mes: 1 }, 'e dezembro aponta para janeiro do ano seguinte');
}
{
    const { vencimentoISO, alvo } = Tarefas._internos.prazoDoQuadro(null, [], '2026-08-29');
    eq(vencimentoISO, '2026-08-29', 'sem quadro publicado, o prazo e hoje');
    eq(alvo, { ano: 2026, mes: 8 }, 'e o alvo e o mes corrente');
}

console.log('\n=== 4. Janela: quando a tarefa aparece e quando some ===\n');
{
    const oc = Tarefas._internos.ocorrenciaDe(tipo('zoom'), { alvoISO: '2026-09-03', titulo: 'x' });
    eq([oc.aberturaISO, oc.vencimentoISO, oc.limiteISO], ['2026-08-31', '2026-09-02', '2026-09-03'],
        'Zoom: abre 31/08, vence 02/09, some depois de 03/09');
    ok(!Regras.estaVisivel(oc, '2026-08-30'), 'nao aparece antes da abertura');
    ok(Regras.estaVisivel(oc, '2026-08-31'), 'aparece no dia da abertura');
    ok(Regras.estaVisivel(oc, '2026-09-03'), 'CONTINUA no dia da reuniao, mesmo vencida');
    ok(!Regras.estaVisivel(oc, '2026-09-04'), 'some no dia seguinte a reuniao');
}
{
    const oc = Tarefas._internos.ocorrenciaDe(tipo('confirmacoes'), { alvoISO: '2026-09-03', titulo: 'x' });
    eq(oc.aberturaISO, '2026-08-31', 'confirmacoes abrem na SEGUNDA da semana, nao num offset');
    ok(Regras.estaVisivel(oc, '2026-08-31'), 'visivel ja na segunda');
}
{
    const oc = Tarefas._internos.ocorrenciaDe(tipo('quadroDesignacoes'), { alvoISO: '2026-08-31', titulo: 'x' });
    eq(oc.aberturaISO, '2026-08-17', 'quadro aparece com 14 dias de antecedencia');
    ok(Regras.estaVisivel(oc, '2026-09-10'), 'e continua depois de vencido, em atraso');
    ok(!Regras.estaVisivel(oc, '2026-09-22'), 'ate o limite de 21 dias');
}
{
    const oc = Tarefas._internos.ocorrenciaDe(tipo('limpeza'), { alvoISO: '2026-09-03', titulo: 'x' });
    eq([oc.aberturaISO, oc.vencimentoISO, oc.limiteISO], ['2026-08-31', '2026-09-06', '2026-09-06'],
        'limpeza: a semana inteira, de segunda a domingo');
}

console.log('\n=== 5. Rotulo do prazo ===\n');
eq(Regras.rotuloDoPrazo('2026-09-02', '2026-09-02'), 'Vence hoje', 'vence hoje');
eq(Regras.rotuloDoPrazo('2026-09-02', '2026-09-01'), 'Vence amanhã', 'vence amanha');
eq(Regras.rotuloDoPrazo('2026-09-02', '2026-09-03'), 'Atrasada desde ontem', 'um dia de atraso');
eq(Regras.rotuloDoPrazo('2026-09-02', '2026-09-05'), 'Atrasada há 3 dias', 'tres dias de atraso');
eq(Regras.rotuloDoPrazo('2026-09-10', '2026-09-03'), 'Faltam 7 dias', 'uma semana pela frente');

console.log('\n=== 6. Hora dos avisos ===\n');
const instante = (t, avisoId, alvoISO, vencimentoISO) => {
    const aviso = Regras.avisosDe(t).find(a => a.id === avisoId);
    return Regras.instanteDoAviso(aviso, { alvoISO, vencimentoISO }).toISOString();
};
eq(instante('confirmacoes', 'segunda', '2026-09-03', '2026-09-02'), '2026-08-31T10:00:00.000Z',
    'confirmacoes avisam na SEGUNDA as 10h, como pedido');
eq(instante('confirmacoes', 'vespera', '2026-09-03', '2026-09-02'), '2026-09-02T09:00:00.000Z',
    'e de novo na vespera, as 9h');
eq(instante('zoom', 'manha', '2026-09-03', '2026-09-02'), '2026-09-02T09:00:00.000Z',
    'Zoom avisa na vespera de manha');
eq(instante('zoom', 'tarde', '2026-09-03', '2026-09-02'), '2026-09-02T17:00:00.000Z',
    'e de novo na vespera a tarde');
eq(instante('quadroDesignacoes', '7d', '2026-08-31', '2026-08-31'), '2026-08-24T10:00:00.000Z',
    'quadro avisa 7 dias antes, as 10h');
eq(instante('quadroDesignacoes', 'hoje', '2026-08-31', '2026-08-31'), '2026-08-31T10:00:00.000Z',
    'e no proprio dia do prazo');
eq(Regras.avisosDe('limpeza'), [], 'limpeza nao acorda ninguem: e informativa');

console.log('\n=== 7. O texto do aviso de segunda cita o quadro no grupo ===\n');
{
    const aviso = Regras.avisosDe('confirmacoes').find(a => a.id === 'segunda');
    const { corpo } = Regras.textoDoAviso(tipo('confirmacoes'), aviso, {
        alvoISO: '2026-09-03', vencimentoISO: '2026-09-02',
    });
    ok(/Marcelo/.test(corpo), 'o lembrete de segunda manda conferir o quadro do irmao Marcelo');
    ok(/confirm/i.test(corpo), 'e continua sendo sobre confirmar as designacoes');
}

console.log('\n=== 7b. O texto do quadro concorda em genero e cita o MES ===\n');
{
    // Este bloco nasceu de um defeito real: o lembrete dizia "Monte a quadro de designacoes
    // de O quadro atual termina em 31/08" — artigo errado, e o `detalhe` do card no lugar do
    // mes. As duas coisas passavam sem erro nenhum, direto para o celular da congregacao.
    const aviso = Regras.avisosDe('quadroDesignacoes').find(a => a.id === '7d');
    const dados = { alvoISO: '2026-08-31', vencimentoISO: '2026-08-31', referencia: 'setembro de 2026' };

    const designacoes = Regras.textoDoAviso(tipo('quadroDesignacoes'), aviso, dados);
    eq(designacoes.titulo, 'Monte o quadro de designações de setembro de 2026', 'quadro e masculino: "o quadro"');
    ok(designacoes.corpo.startsWith('O quadro de designações de setembro de 2026'), 'e o corpo tambem');

    const dirigentes = Regras.textoDoAviso(tipo('quadroDirigentes'), aviso, dados);
    eq(dirigentes.titulo, 'Monte a escala de dirigentes de setembro de 2026', 'escala e feminino: "a escala"');
    ok(dirigentes.corpo.startsWith('A escala de dirigentes de setembro de 2026'), 'e o corpo tambem');
}
{
    // E a `referencia` tem de CHEGAR ate aqui: e o campo que o card carrega para o lembrete.
    const oc = Tarefas._internos.ocorrenciaDe(tipo('quadroDesignacoes'), {
        alvoISO: '2026-08-31', ocorrencia: '2026-09-01', titulo: 'x',
        detalhe: 'O quadro atual termina em 31/08', referencia: 'setembro de 2026',
    });
    const ctx = { hojeISO: '2026-08-29', grupos: [], porTipo: { quadroDesignacoes: [oc] } };
    const [card] = Tarefas.montarParaUsuario({
        contexto: ctx, designadas: ['quadroDesignacoes'], concluidas: new Set(), grupoId: null,
    });
    eq(card.referencia, 'setembro de 2026', 'o card leva a referencia (o mes), e nao so o detalhe');
    eq(card.detalhe, 'O quadro atual termina em 31/08', 'e o detalhe continua sendo o texto da tela');
}

console.log('\n=== 8. Recorte por usuario ===\n');
const contexto = {
    hojeISO: '2026-09-01',
    grupos: [],
    porTipo: {
        zoom: [Tarefas._internos.ocorrenciaDe(tipo('zoom'), { alvoISO: '2026-09-03', titulo: 'Mandar o link do Zoom' })],
        compartilharQuadro: [Tarefas._internos.ocorrenciaDe(tipo('compartilharQuadro'), { alvoISO: '2026-09-03', titulo: 'Compartilhar' })],
        confirmacoes: [Tarefas._internos.ocorrenciaDe(tipo('confirmacoes'), { alvoISO: '2026-09-03', titulo: 'Confirmar' })],
        quadroDesignacoes: [Tarefas._internos.ocorrenciaDe(tipo('quadroDesignacoes'), { alvoISO: '2026-08-31', ocorrencia: '2026-09-01', titulo: 'Montar' })],
        quadroDirigentes: [],
        limpeza: [
            Tarefas._internos.ocorrenciaDe(tipo('limpeza'), { alvoISO: '2026-09-03', titulo: 'Limpeza do salão', grupo: { id: 7, nome: 'Edilson Santos' } }),
            Tarefas._internos.ocorrenciaDe(tipo('limpeza'), { alvoISO: '2026-09-03', titulo: 'Limpeza do salão', grupo: { id: 9, nome: 'Outro Grupo' } }),
        ],
    },
};
const montar = (opcoes) => Tarefas.montarParaUsuario({ contexto, concluidas: new Set(), designadas: [], grupoId: null, ...opcoes });

eq(montar({}).length, 0, 'sem tarefa atribuida e sem grupo, a lista e vazia');
eq(montar({ designadas: ['zoom'] }).map(t => t.tipo), ['zoom'], 'so o que foi atribuido aparece');
eq(montar({ designadas: ['zoom', 'confirmacoes'] }).length, 2, 'duas tarefas, dois cards');
eq(montar({ designadas: ['limpeza'] }).length, 0, 'limpeza NAO se atribui a mao');
eq(montar({ grupoId: 7 }).map(t => t.grupo.nome), ['Edilson Santos'], 'limpeza vem do grupo, e so a do grupo dele');
eq(montar({ grupoId: 99 }).length, 0, 'grupo que nao limpa nesta semana nao ve nada');
eq(
    montar({ designadas: ['zoom'], concluidas: new Set(['zoom|2026-09-03']) }).length,
    0,
    'o que ele marcou como concluido some',
);
eq(
    montar({ designadas: ['quadroDesignacoes'], concluidas: new Set(['quadroDesignacoes|2026-09-01']) }).length,
    1,
    'mas um check NAO silencia a tarefa de quadro (ela so sai publicando o quadro)',
);
ok(montar({ designadas: ['quadroDesignacoes'] })[0].concluivel === false, 'e ela nao oferece botao de concluir');

console.log('\n=== 9. Ordem: o mais urgente primeiro ===\n');
{
    const lista = montar({ designadas: ['zoom', 'confirmacoes', 'quadroDesignacoes'], grupoId: 7 });
    const atrasadas = lista.filter(t => t.atrasada).map(t => t.tipo);
    eq(atrasadas, ['quadroDesignacoes'], 'o quadro venceu em 31/08 e aparece como atrasado');
    eq(lista[0].tipo, 'quadroDesignacoes', 'e vem no topo da lista');
    ok(
        lista.every((t, i) => i === 0 || t.diasAteVencer >= lista[i - 1].diasAteVencer),
        'o resto segue por prazo crescente',
    );
}

console.log('\n=== 10. Saneamento ===\n');
eq(Regras.sanearTarefas(['zoom', 'zoom', 'inventada']), ['zoom'], 'repetido e desconhecido caem fora');
eq(Regras.sanearTarefas(['limpeza']), [], 'limpeza nunca entra por atribuicao');
eq(Regras.sanearTarefas('zoom'), [], 'o que nao e lista vira lista vazia');
eq(Regras.CATALOGO.length, 5, 'o catalogo oferece as cinco tarefas atribuiveis');

console.log(`\n${falhas === 0 ? 'TUDO OK' : `${falhas} FALHA(S)`}\n`);
process.exit(falhas === 0 ? 0 : 1);
