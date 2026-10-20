'use strict';

/**
 * Textos de compartilhamento da reuniao (os convites de Zoom).
 *
 * POR QUE ISTO VIVE NO BACKEND: o app mobile nao tem EAS Update configurado, entao
 * qualquer ajuste de texto feito no app so chega ao irmao com um BUILD NATIVO NOVO.
 * Aqui, mudar uma palavra, um link ou o negrito e um deploy normal do backend
 * (commit + push + webhook) e todo mundo ja recebe o texto novo na proxima vez que
 * abrir a folha de compartilhar.
 *
 * O app nao monta mais nada: ele pede a lista de opcoes pronta e so exibe. Ate a
 * LISTA e daqui, entao acrescentar uma quarta opcao amanha tambem nao pede build.
 */

// ---------------------------------------------------------------------------
// O nome da congregacao e os dados do Zoom vem da tabela Config (tela de Ajustes,
// admin geral): cada congregacao preenche os seus, sem deploy.
// ---------------------------------------------------------------------------

// Uma constante so, usada nos dois convites: o aviso tem que ser identico —
// e ja saiu diferente uma vez (faltava no meio de semana e estava sem negrito).
const AVISO_REDES_SOCIAIS = 'Essas informações, não devem ser compartilhadas nas redes sociais.';

const MESES = [
    '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const { FUSO } = require('./RegrasLembrete');

// Sentinela gravada pela web para marcar uma linha como excluida.
const SENTINELA_DELETADO = '__DELETADO__';

/**
 * Negrito do WhatsApp: *texto*.
 *
 * Os asteriscos precisam encostar em caractere que nao seja espaco, senao o
 * WhatsApp mostra o asterisco cru em vez de formatar. Por isso o trim antes.
 * Texto que ja contenha asterisco fica sem negrito: marcar por cima quebraria a
 * formatacao dele e o irmao veria simbolos soltos no meio da mensagem.
 */
function negrito(texto) {
    const t = String(texto == null ? '' : texto).trim();
    if (!t || t.includes('*')) return t;
    return `*${t}*`;
}

function limpo(valor) {
    if (!valor || valor === SENTINELA_DELETADO) return null;
    const t = String(valor).trim();
    return t && t !== '-' ? t : null;
}

/** Interpreta "dd/MM/yyyy". Devolve null para qualquer outro formato. */
function parseData(valor) {
    const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(valor == null ? '' : valor));
    if (!m) return null;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
}

const doisDigitos = (n) => String(n).padStart(2, '0');

/**
 * As datas que fecham a semana da programacao.
 *
 * Espelha `datasDaSemana` do mobile: o PDF importado so traz a data do meio de
 * semana; a segunda que abre e o domingo que fecha sao derivados dela.
 */
function datasDaSemana(semana) {
    const meio = parseData(semana && semana.dataReuniao);
    if (!meio) return { inicio: null, meio: null, fds: null };

    const fds = new Date(meio);
    fds.setDate(fds.getDate() + ((7 - meio.getDay()) % 7));

    const inicio = new Date(meio);
    inicio.setDate(inicio.getDate() - ((meio.getDay() + 6) % 7));

    return { inicio, meio, fds };
}

/**
 * "01-07 de junho" e, quando a semana atravessa o mes, "29 de junho - 05 de julho".
 * Sem data importada cai no rotulo textual que veio do PDF.
 */
function faixaPorExtenso(semana) {
    const { inicio, fds } = datasDaSemana(semana);
    if (!inicio || !fds) return String((semana && semana.faixaData) || '').trim();

    const mesInicio = (MESES[inicio.getMonth() + 1] || '').toLowerCase();
    const mesFds = (MESES[fds.getMonth() + 1] || '').toLowerCase();

    if (inicio.getMonth() === fds.getMonth()) {
        return `${doisDigitos(inicio.getDate())}-${doisDigitos(fds.getDate())} de ${mesInicio}`;
    }
    return `${doisDigitos(inicio.getDate())} de ${mesInicio} - ${doisDigitos(fds.getDate())} de ${mesFds}`;
}

/** Tema entre aspas curvas, sem duplicar as que ja vierem da programacao. */
function temaEntreAspas(tema) {
    if (/^["“”']/.test(tema)) return tema;
    return `“${tema}”`;
}

/**
 * "Congregação Vila Nova" (como a tela de Ajustes guarda) -> "Vila Nova": o
 * convite ja diz "A Congregação ..." e repetiria a palavra.
 */
function nomeCongregacao(subtitulo) {
    return String(subtitulo || '').trim().replace(/^congrega[çc][ãa]o\s+/i, '');
}

function abertura(congregacao) {
    const nome = nomeCongregacao(congregacao);
    return negrito(nome
        ? `A Congregação ${nome} convida você para uma reunião Zoom`
        : 'A congregação convida você para uma reunião Zoom');
}

/** Reuniao com link ou ID do Zoom preenchido: sem os dois, o convite nao leva a lugar nenhum. */
const temZoom = (zoom) => !!(zoom && (limpo(zoom.link) || limpo(zoom.id)));

// ---------------------------------------------------------------------------
// Os textos
// ---------------------------------------------------------------------------

/**
 * Convite da reuniao do meio de semana.
 *
 * Em negrito: a linha de abertura e a linha da semana (data + leitura) — que e a
 * informacao que o irmao procura quando bate o olho na mensagem.
 */
function conviteMeioSemana(semana, zoom = {}, nossaCongregacao = '') {
    const faixa = faixaPorExtenso(semana);
    const leitura = limpo(semana && semana.leituraSemanal);
    const linhaSemana = leitura ? `${faixa} - ${leitura}` : faixa;

    return [
        abertura(nossaCongregacao),
        negrito(linhaSemana),
        limpo(zoom.salaAberta) && `Sala aberta: ${zoom.salaAberta}`,
        limpo(zoom.link),
        limpo(zoom.id) && `ID da reunião: ${zoom.id}`,
        limpo(zoom.senha) && `Senha de acesso: ${zoom.senha}`,
        negrito(AVISO_REDES_SOCIAIS),
        '"Uma boa Reunião a todos"',
    ].filter(Boolean).join('\n\n');
}

/**
 * Convite da reuniao de fim de semana.
 *
 * Em negrito: a abertura e os VALORES de orador, tema, congregacao e data. Os
 * rotulos ("Orador:") ficam sem marcacao — negrito na linha inteira deixa o
 * bloco pesado e some com o destaque, que e justamente o nome e o tema.
 */
function conviteFimDeSemana(semana, zoom = {}, nossaCongregacao = '') {
    const orador = limpo(semana && semana.fds_orador);
    const tema = limpo(semana && semana.fds_tema);
    const congregacao = limpo(semana && semana.fds_congregacao);
    const { fds } = datasDaSemana(semana);
    const faixa = faixaPorExtenso(semana).toUpperCase();
    const linhaData = fds ? `${faixa} DE ${fds.getFullYear()}` : faixa;

    const blocos = [abertura(nossaCongregacao)];
    if (orador) blocos.push(`Orador: ${negrito(orador)}`);
    if (tema) blocos.push(`Tema: ${negrito(temaEntreAspas(tema))}`);
    if (congregacao) blocos.push(`Congregação: ${negrito(congregacao)}`);
    const acesso = [
        limpo(zoom.id) && `ID da reunião: ${zoom.id}`,
        limpo(zoom.senha) && `Senha de acesso: ${zoom.senha}`,
    ].filter(Boolean).join('\n');
    blocos.push(
        negrito(linhaData),
        limpo(zoom.salaAberta) && `Abertura da sala: ${zoom.salaAberta}`,
        limpo(zoom.link) && `Entrar na reunião Zoom\n${zoom.link}`,
        acesso,
        negrito(AVISO_REDES_SOCIAIS),
        'Uma boa reunião a todos.'
    );

    return blocos.filter(Boolean).join('\n\n');
}

/**
 * As opcoes de texto que a folha de compartilhar do app exibe, na ordem.
 *
 * `id` e o que o app usa como key; `icone` e um nome do Ionicons. Acrescentar uma
 * opcao aqui a faz aparecer no app sem build novo.
 *
 * `config` e a linha da tabela Config. O convite de uma reuniao so aparece depois que o
 * Zoom dela e preenchido em Ajustes — numa instalacao nova, a lista sai vazia.
 */
function montarOpcoes(semana, config) {
    const zoom = (config && config.zoom) || {};
    const nossaCongregacao = config && config.subtitulo;
    const opcoes = [];
    if (temZoom(zoom.meio)) {
        opcoes.push({
            id: 'zoom-meio',
            titulo: 'Zoom — meio de semana',
            descricao: 'Convite em texto com o link e a leitura da semana',
            icone: 'videocam-outline',
            texto: conviteMeioSemana(semana, zoom.meio, nossaCongregacao),
        });
    }
    if (temZoom(zoom.fds)) {
        opcoes.push({
            id: 'zoom-fds',
            titulo: 'Zoom — fim de semana',
            descricao: 'Convite em texto com orador, tema e link',
            icone: 'videocam-outline',
            texto: conviteFimDeSemana(semana, zoom.fds, nossaCongregacao),
        });
    }
    return opcoes;
}

// ---------------------------------------------------------------------------
// Confirmacao de designacao: a mensagem curta que se manda para o irmao que tem
// parte na semana, para saber se esta tudo certo.
// ---------------------------------------------------------------------------

/** Como a mensagem comeca. Mudar o texto aqui e um deploy, nao um build do app. */
const TEXTO_CONFIRMACAO = (saudacao, nome) =>
    `${saudacao} ${nome}! Tudo certinho com a sua designação?`;

// A hora do servidor e UTC; quem manda e o relogio da congregacao. Mesmo criterio de
// LembreteDesignacoesService, que ja formata datas nesse fuso pelo mesmo motivo.
const FORMATADOR_HORA = new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO,
    hour: '2-digit',
    hour12: false,
});

/** "Bom dia" ate 11:59, "Boa tarde" ate 17:59, "Boa noite" dai em diante. */
function saudacaoDaHora(agora = new Date()) {
    const hora = Number(FORMATADOR_HORA.format(agora));
    if (!Number.isFinite(hora)) return 'Olá';
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
}

// Primeiros nomes que quase nunca vem sozinhos: cumprimentar so "Maria" numa congregacao
// com varias Marias nao identifica ninguem. Com dois nomes, "Maria Fernanda" resolve.
const NOMES_COMPOSTOS = new Set([
    'maria', 'ana', 'jose', 'joao', 'luiz', 'luis', 'antonio', 'carlos', 'pedro', 'paulo',
]);

const semAcento = (texto) =>
    String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * O nome como se fala com a pessoa: o primeiro nome, e o segundo junto quando o primeiro e
 * daqueles que pedem companhia. O arquivo importado traz o nome inteiro ("Maria Fernanda dos
 * S. Gomes de Araujo"), que numa mensagem direta soa como formulario.
 */
function nomeDeTratamento(nomeCompleto) {
    const partes = String(nomeCompleto || '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '';
    if (partes.length === 1) return partes[0];
    return NOMES_COMPOSTOS.has(semAcento(partes[0]))
        ? `${partes[0]} ${partes[1]}`
        : partes[0];
}

/**
 * A mensagem pronta para um irmao/irma com parte na semana.
 *
 * @param {string} nomeCompleto  nome como esta na programacao importada
 * @param {Date} [agora]         injetavel para o teste fixar o relogio
 * @returns {string|null} null quando nao ha nome
 */
function textoConfirmacaoDesignacao(nomeCompleto, agora = new Date(), designacao = null) {
    const nome = nomeDeTratamento(nomeCompleto);
    if (!nome) return null;

    const abertura = TEXTO_CONFIRMACAO(saudacaoDaHora(agora), nome);

    // A designacao em NEGRITO, depois de uma linha em branco.
    //
    // Sem ela a mensagem perguntava "tudo certo com a sua designacao?" sem dizer QUAL — e do
    // outro lado o irmao muitas vezes tem mais de uma na semana, ou nem lembra de cabeca. O
    // negrito e o do WhatsApp (asteriscos), o mesmo que os convites de Zoom ja usam.
    const detalhe = String(designacao || '').trim();
    if (!detalhe) return abertura;

    return `${abertura}

${negrito(detalhe)}`;
}

module.exports = {
    montarOpcoes,
    conviteMeioSemana,
    conviteFimDeSemana,
    textoConfirmacaoDesignacao,
    _internos: {
        negrito, faixaPorExtenso, datasDaSemana, temaEntreAspas, limpo, nomeCongregacao,
        saudacaoDaHora, nomeDeTratamento,
    },
};
