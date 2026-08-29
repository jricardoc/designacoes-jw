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
const Painel = require('../src/services/PainelTarefasService');

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

console.log('\n=== 7c. A limpeza informa, nao cobra ===\n');
{
    // O irmao pediu: na limpeza nao cabe "Vence amanha". Ela nao e entrega de ninguem —
    // e a semana do GRUPO —, entao ela diz quando e, e so.
    eq(Regras.rotuloInformativo('2026-09-06', '2026-09-05'), 'Amanhã', 'vespera: so "Amanhã"');
    eq(Regras.rotuloInformativo('2026-09-06', '2026-09-06'), 'Hoje', 'no dia: so "Hoje"');
    eq(Regras.rotuloInformativo('2026-09-06', '2026-09-01'), 'Em 5 dias', 'antes: "Em N dias"');
    ok(!/[Vv]ence/.test(Regras.rotuloInformativo('2026-09-06', '2026-09-05')), 'a palavra "vence" nao aparece');

    const oc = Tarefas._internos.ocorrenciaDe(tipo('limpeza'), {
        alvoISO: '2026-09-03', titulo: 'Limpeza do salão', grupo: { id: 7, nome: 'Edilson Santos' },
    });
    const ctx = { hojeISO: '2026-09-05', grupos: [], porTipo: { limpeza: [oc] } };
    const [card] = Tarefas.montarParaUsuario({
        contexto: ctx, designadas: [], concluidas: new Set(), grupoId: 7,
    });
    eq(card.prazo, 'Amanhã', 'e o card da limpeza usa esse rotulo');
    eq(card.atrasada, false, 'a limpeza nunca fica "atrasada"');
    eq(card.concluivel, false, 'nem oferece check');
}
{
    // Mas a tarefa que E entrega continua cobrando, com todas as letras.
    const oc = Tarefas._internos.ocorrenciaDe(tipo('zoom'), { alvoISO: '2026-09-03', titulo: 'Zoom' });
    const ctx = { hojeISO: '2026-09-02', grupos: [], porTipo: { zoom: [oc] } };
    const [card] = Tarefas.montarParaUsuario({
        contexto: ctx, designadas: ['zoom'], concluidas: new Set(), grupoId: null,
    });
    eq(card.prazo, 'Vence hoje', 'o Zoom continua dizendo "Vence hoje"');
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

console.log('\n=== 8b. A acao da ocorrencia ganha da do tipo ===\n');
{
    // A tarefa de compartilhar sabe DE QUAL quadro se trata, e leva direto nele. O tipo
    // sozinho so consegue apontar para a lista, e ai o irmao tem de procurar o mes.
    const comQuadro = Tarefas._internos.ocorrenciaDe(tipo('compartilharQuadro'), {
        alvoISO: '2026-08-30', titulo: 'Compartilhar',
        acao: { titulo: 'Abrir o quadro', destino: 'quadro', id: 42 },
    });
    const semQuadro = Tarefas._internos.ocorrenciaDe(tipo('compartilharQuadro'), {
        alvoISO: '2026-08-30', titulo: 'Compartilhar',
    });
    const monta = (oc) => Tarefas.montarParaUsuario({
        contexto: { hojeISO: '2026-08-29', grupos: [], porTipo: { compartilharQuadro: [oc] } },
        designadas: ['compartilharQuadro'], concluidas: new Set(), grupoId: null,
    })[0];

    eq(monta(comQuadro).acao, { titulo: 'Abrir o quadro', destino: 'quadro', id: 42 },
        'com quadro conhecido, o card leva na tela DAQUELE quadro');
    eq(monta(semQuadro).acao, tipo('compartilharQuadro').acao,
        'sem quadro conhecido, cai na acao do tipo (a lista)');
    eq(monta(semQuadro).acao.id, undefined, 'e sem id nenhum');
}

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

console.log('\n=== 11. Painel do admin: as contas puras ===\n');
{
    // --- a linha do tempo dos quadros ---
    // O prazo de um quadro e o ULTIMO DIA COBERTO PELO ANTERIOR. O primeiro da lista nunca
    // e avaliado: nao existe anterior de onde tirar prazo.
    const quadros = [
        { mes: 7, ano: 2026, ultimoDia: '2026-07-31', publicadoEm: null, publicadoPor: null },
        { mes: 8, ano: 2026, ultimoDia: '2026-08-31', publicadoEm: new Date('2026-07-28T10:00:00Z'), publicadoPor: { nome: 'Andre' } },
        { mes: 9, ano: 2026, ultimoDia: '2026-09-30', publicadoEm: new Date('2026-09-04T10:00:00Z'), publicadoPor: { nome: 'Andre' } },
        { mes: 10, ano: 2026, ultimoDia: '2026-10-31', publicadoEm: null, publicadoPor: null },
    ];
    const linhas = Painel._internos.linhaDoTempoDosQuadros(quadros, 'quadroDesignacoes', '2026-01-01');
    const porRef = new Map(linhas.map(l => [l.referencia, l]));

    eq(linhas.length, 3, 'quatro quadros dao tres avaliacoes (o primeiro nao tem prazo)');
    eq(porRef.get('agosto de 2026').vencimentoISO, '2026-07-31', 'agosto vencia no fim de julho');
    eq(porRef.get('agosto de 2026').situacao, 'noPrazo', 'e saiu em 28/07: no prazo');
    eq(porRef.get('setembro de 2026').situacao, 'atrasado', 'setembro saiu em 04/09: atrasado');
    eq(porRef.get('setembro de 2026').diasDeAtraso, 4, 'quatro dias');
    eq(porRef.get('outubro de 2026').situacao, 'semRegistro',
        'publicado antes de a data existir nao vira "pontual" por omissao');
    eq(porRef.get('outubro de 2026').diasDeAtraso, null, 'e nao inventa dias de atraso');

    const recorte = Painel._internos.linhaDoTempoDosQuadros(quadros, 'quadroDesignacoes', '2026-09-01');
    eq(recorte.map(l => l.referencia), ['outubro de 2026'],
        'a janela corta pelo PRAZO, nao pela data de publicacao');
}
{
    // --- o corte por data de atribuicao ---
    const oc = (alvo) => Tarefas._internos.ocorrenciaDe(tipo('confirmacoes'), { alvoISO: alvo, titulo: 'x' });
    const contexto = { porTipo: { confirmacoes: ['2026-07-02', '2026-08-06', '2026-09-03'].map(oc) } };

    const veterano = {
        id: 1, nome: 'Veterano',
        tarefas: [{ tipo: 'confirmacoes', createdAt: new Date('2026-01-01T00:00:00Z') }],
        tarefasConcluidas: [{ tipo: 'confirmacoes', ocorrencia: '2026-07-02', concluidoEm: new Date('2026-07-01T12:00:00Z') }],
    };
    const novato = {
        id: 2, nome: 'Novato',
        tarefas: [{ tipo: 'confirmacoes', createdAt: new Date('2026-09-01T00:00:00Z') }],
        tarefasConcluidas: [],
    };
    const semNada = { id: 3, nome: 'SemNada', tarefas: [], tarefasConcluidas: [] };

    const d = Painel._internos.desempenhoManual([veterano, novato, semNada], contexto, '2026-06-01', '2026-09-30');
    const porNome = new Map(d.porPessoa.map(p => [p.nome, p]));

    eq(porNome.get('Veterano').previstas, 3, 'quem tinha a tarefa desde janeiro responde pelas tres');
    eq(porNome.get('Veterano').cumpridas, 1, 'e cumpriu uma');
    eq(porNome.get('Veterano').noPrazo, 1, 'no prazo');
    eq(porNome.get('Novato').previstas, 1,
        'quem recebeu a tarefa em setembro NAO carrega julho e agosto');
    ok(!porNome.has('SemNada'), 'quem nunca teve tarefa nao vira linha de 0%');
    eq(d.geral.previstas, 4, 'o geral soma so o que era de alguem');
}
{
    // --- o prazo vale ate o FIM do dia ---
    const noPrazo = Painel._internos.concluiuNoPrazo;
    ok(noPrazo(new Date('2026-07-01T23:30:00Z'), '2026-07-01'), 'concluir no proprio dia do prazo conta');
    ok(!noPrazo(new Date('2026-07-02T12:00:00Z'), '2026-07-01'), 'no dia seguinte, nao');
    ok(!noPrazo(null, '2026-07-01'), 'sem check nao ha prazo cumprido');
}

console.log(`\n${falhas === 0 ? 'TUDO OK' : `${falhas} FALHA(S)`}\n`);
process.exit(falhas === 0 ? 0 : 1);
