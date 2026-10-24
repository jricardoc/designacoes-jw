import type { Icone } from "@/components/ministerio/kit";
import type { Ambiente } from "@/utils/ambiente";
import type { Regra } from "./passos";

/**
 * "O que há de novo": o que entrou no app, ambiente por ambiente. Só o que é novo de verdade;
 * correção e ajuste não entram. Ao acrescentar uma leva, trocar `VERSAO_NOVIDADES`: a tela volta a
 * abrir sozinha uma vez para cada um.
 */
export const VERSAO_NOVIDADES = "2026-10";

export interface Novidade {
  icone: Icone;
  titulo: string;
  texto: string;
  /** Só para quem usa aquilo (as mesmas regras do tutorial). */
  se?: Regra;
}

export interface SecaoNovidades {
  /** "app" é o que vale no app todo; "admin", o de quem cuida do app. */
  chave: Ambiente | "app" | "admin";
  nome: string;
  se?: Regra;
  itens: Novidade[];
}

export const NOVIDADES: SecaoNovidades[] = [
  {
    chave: "app",
    nome: "No app todo",
    itens: [
      { icone: "apps", titulo: "Quatro ambientes", texto: "Servir Mais, Ministério, Território e Estudo pessoal, cada um com a sua barra e as suas cores. Troque pela marca no topo." },
      { icone: "play-circle", titulo: "Abre onde você parou", texto: "O app volta no último ambiente usado, com a abertura e o desbloqueio na cara dele." },
      { icone: "cloud-offline", titulo: "Funciona sem internet", texto: "Abre sem sinal e mostra o que você viu por último. O que você marca no campo sobe sozinho quando a internet volta." },
      { icone: "sync", titulo: "Telas sempre em dia", texto: "Ao voltar para o app ou quando o sinal volta, a tela se atualiza sozinha." },
      { icone: "finger-print", titulo: "Face ID ou digital", texto: "Entre sem digitar a senha. Para ligar, vá em Conta." },
      { icone: "person-circle", titulo: "Foto de perfil", texto: "Ela aparece na barra, no menu e nos grupos." },
      { icone: "cloud-download", titulo: "Atualização pelo ar", texto: "Quando sai versão nova, aparece a faixa para atualizar. Em Ajustes dá para procurar na hora." },
      { icone: "school", titulo: "Tutorial", texto: "Um tour por cada ambiente, para refazer quando quiser em Ajustes." },
    ],
  },
  {
    chave: "servir",
    nome: "Servir Mais",
    itens: [
      { icone: "checkmark-done", titulo: "Confirme a sua parte", texto: "A parte de estudante tem Confirmo e Não posso. Quem cuida das confirmações é avisado na hora." },
      { icone: "paper-plane", titulo: "Relatório de campo pelo app", texto: "Envie o relatório do mês pelo + do meio da barra. Quem cuida dos quadros e da reunião também cria e importa por ali." },
      { icone: "timer", titulo: "Cronômetro no Início", texto: "Contando no Ministério? O cronômetro aparece no Início, com pausar e parar.", se: "pioneiro" },
      { icone: "people", titulo: "Grupos de campo", texto: "O dirigente vê o grupo, anota o relatório de cada um e pede pelo WhatsApp. O secretário vê o total da congregação.", se: "verGrupos" },
      { icone: "id-card", titulo: "Ficha do irmão", texto: "Em Grupos, toque no nome: relatório de 12 meses, reuniões pelo Zoom e designações.", se: "verGrupos" },
      { icone: "stats-chart", titulo: "Assistência por mês", texto: "Na Reunião: a contagem de cada mês, com filtros, quem assistiu pelo Zoom e a imagem pronta para o grupo." },
      { icone: "videocam", titulo: "Relatórios do Zoom", texto: "Participantes, resumo e transcrição de cada reunião, e a importação do relatório de uso.", se: "gerenciar:reunioes" },
      { icone: "ribbon", titulo: "Etiqueta de pioneiro", texto: "Pioneiro regular ou auxiliar aparece com etiqueta e foto no Início e nos grupos." },
    ],
  },
  {
    chave: "ministerio",
    nome: "Ministério",
    se: "pioneiro",
    itens: [
      { icone: "leaf", titulo: "Um ambiente para o pioneiro", texto: "Horas, contatos e agenda num app dentro do app. Entre pela marca no topo do menu." },
      { icone: "timer", titulo: "Cronômetro", texto: "Fica no servidor: continua contando com o app fechado e até sem internet." },
      { icone: "trophy", titulo: "Meta do mês", texto: "50 h para o regular e 30 h para o auxiliar, com o anel do quanto falta." },
      { icone: "people", titulo: "Revisitas e estudos", texto: "Na lista e no mapa, com GPS, a linha do tempo de cada um e aviso uma hora antes da visita marcada." },
      { icone: "cloud-upload", titulo: "Contatos sem internet", texto: "Contato novo e visita anotados sem sinal sobem sozinhos quando a internet volta." },
      { icone: "calendar", titulo: "Agenda", texto: "O mês com as visitas, os seus planos de saída e os dos outros pioneiros, e o calendário assinado no celular." },
      { icone: "medal", titulo: "Progresso", texto: "Os meses e o ano de serviço, com emblemas e a quilometragem das viagens." },
      { icone: "share-social", titulo: "Compartilhar contatos", texto: "Mande um ou vários em imagem ou pelo WhatsApp, com o link do mapa." },
      { icone: "send", titulo: "Relatório direto para o grupo", texto: "Mande o relatório do mês pelo Ministério e ele já cai no grupo de campo." },
    ],
  },
  {
    chave: "territorio",
    nome: "Território",
    itens: [
      { icone: "map", titulo: "Um ambiente para os mapas", texto: "Mapa em tela cheia, lista por áreas, saídas e gerenciar. Entre pelo menu." },
      { icone: "layers", titulo: "Mapas do My Maps", texto: "Os territórios vêm do Google My Maps, com as áreas coloridas e o limite da congregação." },
      { icone: "location", titulo: "Onde paramos", texto: "O dirigente marca pelo GPS onde parou, até sem internet. Todos veem o ponto e como chegar até ele." },
      { icone: "navigate", titulo: "Você está aqui", texto: "O GPS mostra em qual território você está." },
      { icone: "hand-left", titulo: "Saída, Não bater e histórico", texto: "Registre a saída, anote as casas que não querem visita e veja quando cada território foi trabalhado." },
      { icone: "share-social", titulo: "Compartilhar o mapa", texto: "Mande o mapa do território para quem vai trabalhar nele." },
      { icone: "document-text", titulo: "S-13 em PDF", texto: "O registro de designação de território pronto para imprimir.", se: "gerenciar:territorios" },
      { icone: "notifications", titulo: "Território designado", texto: "Aparece em Minhas designações, com aviso no celular." },
    ],
  },
  {
    chave: "estudo",
    nome: "Estudo pessoal",
    itens: [
      { icone: "book", titulo: "Um ambiente para o seu estudo", texto: "A leitura da Bíblia e o estudo pessoal, com o que vem do jw.org e da Biblioteca On-line." },
      { icone: "list", titulo: "Programas de leitura", texto: "O do jw.org (a Bíblia em um ano, por assunto ou pelos marcadores), o Comece sua leitura, o da reunião e a leitura livre." },
      { icone: "open", titulo: "Ler no JW Library", texto: "O Ler abre o trecho no JW Library e, na volta, pergunta se você terminou." },
      { icone: "flame", titulo: "Regularidade", texto: "A semana de leitura e de estudo, e o Onde parei com os 66 livros." },
      { icone: "bulb", titulo: "Sessão de estudo", texto: "A lista do que estudar e a sessão com o passo a passo: orar, ler, pesquisar, meditar e pôr em prática." },
      { icone: "alarm", titulo: "Rotina com aviso", texto: "Monte os horários, receba o aviso no celular e use o plano B quando o dia apertar." },
    ],
  },
  {
    chave: "admin",
    nome: "Para quem cuida do app",
    se: "adminGeral",
    itens: [
      { icone: "bug", titulo: "Erros do app", texto: "Em Ajustes, o que quebrou no celular de cada um, para conferir uma versão antes de liberar." },
      { icone: "flask", titulo: "Canal de teste", texto: "Em Ajustes, receba as versões novas antes de todo mundo." },
    ],
  },
];
