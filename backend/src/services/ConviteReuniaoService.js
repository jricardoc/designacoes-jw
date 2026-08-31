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
// O que muda com mais frequencia fica todo junto aqui em cima.
// (Se um dia isto precisar ser editavel pela tela, o caminho e mover para a
//  tabela Config; por enquanto um deploy resolve e nao ha tela para manter.)
// ---------------------------------------------------------------------------

const NOME_CONGREGACAO = 'Norte de Itapuã';

const ZOOM_MEIO_SEMANA = {
    link: 'https://jworg.zoom.us/j/84981240952',
    id: '849 8124 0952',
    senha: 'jw1010',
    salaAberta: '19:00',
};

const ZOOM_FIM_DE_SEMANA = {
    link: 'https://jworg.zoom.us/j/84423800527',
    id: '844 2380 0527',
    senha: 'jw1010',
    salaAberta: '08:30',
};

// Uma constante so, usada nos dois convites: o aviso tem que ser identico —
// e ja saiu diferente uma vez (faltava no meio de semana e estava sem negrito).
const AVISO_REDES_SOCIAIS = 'Essas informações, não devem ser compartilhadas nas redes sociais.';

const MESES = [
    '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

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

// ---------------------------------------------------------------------------
// Os textos
// ---------------------------------------------------------------------------

/**
 * Convite da reuniao do meio de semana.
 *
 * Em negrito: a linha de abertura e a linha da semana (data + leitura) — que e a
 * informacao que o irmao procura quando bate o olho na mensagem.
 */
function conviteMeioSemana(semana) {
    const faixa = faixaPorExtenso(semana);
    const leitura = limpo(semana && semana.leituraSemanal);
    const linhaSemana = leitura ? `${faixa} - ${leitura}` : faixa;

    return [
        negrito(`A Congregação ${NOME_CONGREGACAO} convida você para uma reunião Zoom`),
        negrito(linhaSemana),
        `Sala aberta: ${ZOOM_MEIO_SEMANA.salaAberta}`,
        ZOOM_MEIO_SEMANA.link,
        `ID da reunião: ${ZOOM_MEIO_SEMANA.id}`,
        `Senha de acesso: ${ZOOM_MEIO_SEMANA.senha}`,
        negrito(AVISO_REDES_SOCIAIS),
        '"Uma boa Reunião a todos"',
    ].join('\n\n');
}

/**
 * Convite da reuniao de fim de semana.
 *
 * Em negrito: a abertura e os VALORES de orador, tema, congregacao e data. Os
 * rotulos ("Orador:") ficam sem marcacao — negrito na linha inteira deixa o
 * bloco pesado e some com o destaque, que e justamente o nome e o tema.
 */
function conviteFimDeSemana(semana) {
    const orador = limpo(semana && semana.fds_orador);
    const tema = limpo(semana && semana.fds_tema);
    const congregacao = limpo(semana && semana.fds_congregacao);
    const { fds } = datasDaSemana(semana);
    const faixa = faixaPorExtenso(semana).toUpperCase();
    const linhaData = fds ? `${faixa} DE ${fds.getFullYear()}` : faixa;

    const blocos = [
        negrito(`A Congregação ${NOME_CONGREGACAO} convida você para uma reunião Zoom`),
    ];
    if (orador) blocos.push(`Orador: ${negrito(orador)}`);
    if (tema) blocos.push(`Tema: ${negrito(temaEntreAspas(tema))}`);
    if (congregacao) blocos.push(`Congregação: ${negrito(congregacao)}`);
    blocos.push(
        negrito(linhaData),
        `Abertura da sala: ${ZOOM_FIM_DE_SEMANA.salaAberta}`,
        `Entrar na reunião Zoom\n${ZOOM_FIM_DE_SEMANA.link}`,
        `ID da reunião: ${ZOOM_FIM_DE_SEMANA.id}\nSenha de acesso: ${ZOOM_FIM_DE_SEMANA.senha}`,
        negrito(AVISO_REDES_SOCIAIS),
        'Uma boa reunião a todos.'
    );

    return blocos.join('\n\n');
}

/**
 * As opcoes de texto que a folha de compartilhar do app exibe, na ordem.
 *
 * `id` e o que o app usa como key; `icone` e um nome do Ionicons. Acrescentar uma
 * opcao aqui a faz aparecer no app sem build novo.
 */
function montarOpcoes(semana) {
    return [
        {
            id: 'zoom-meio',
            titulo: 'Zoom — meio de semana',
            descricao: 'Convite em texto com o link e a leitura da semana',
            icone: 'videocam-outline',
            texto: conviteMeioSemana(semana),
        },
        {
            id: 'zoom-fds',
            titulo: 'Zoom — fim de semana',
            descricao: 'Convite em texto com orador, tema e link',
            icone: 'videocam-outline',
            texto: conviteFimDeSemana(semana),
        },
    ];
}

// ---------------------------------------------------------------------------
// Confirmacao de designacao: a mensagem curta que se manda para o irmao que tem
// parte na semana, para saber se esta tudo certo.
// ---------------------------------------------------------------------------

/** Como a mensagem comeca. Mudar o texto aqui e um deploy, nao um build do app. */
const TEXTO_CONFIRMACAO = (saudacao, nome) =>
    `${saudacao} ${nome}! Tudo certinho com a sua designação?`;

const FUSO_CONGREGACAO = 'America/Bahia';

// A hora do servidor e UTC; quem manda e o relogio da congregacao. Mesmo criterio de
// LembreteDesignacoesService, que ja formata datas nesse fuso pelo mesmo motivo.
const FORMATADOR_HORA = new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO_CONGREGACAO,
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
// com varias Marias nao identifica ninguem. Com dois nomes, "Maria Eduarda" resolve.
const NOMES_COMPOSTOS = new Set([
    'maria', 'ana', 'jose', 'joao', 'luiz', 'luis', 'antonio', 'carlos', 'pedro', 'paulo',
]);

const semAcento = (texto) =>
    String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * O nome como se fala com a pessoa: o primeiro nome, e o segundo junto quando o primeiro e
 * daqueles que pedem companhia. O arquivo importado traz o nome inteiro ("Maria Eduarda dos
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
        negrito, faixaPorExtenso, datasDaSemana, temaEntreAspas, limpo,
        saudacaoDaHora, nomeDeTratamento,
    },
};
