<div align="center">

<img src="mobile/assets/icon.png" alt="Servir Mais" width="112" />

# Servir Mais

**Designações da congregação, no bolso de cada irmão.**

Quadros de designações, escala de dirigentes, programação da reunião, assistência,
carrinho e territórios — num app Android/iPhone e num painel web, no seu próprio servidor.

[![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-5E6A46.svg)](LICENSE)
[![Expo SDK 54](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo&logoColor=white)](https://docs.expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react&logoColor=black)](https://reactnative.dev)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-pronto-2496ED?logo=docker&logoColor=white)](docker-compose.prod.yml)

[**Instalar**](docs/INSTALACAO.md) · [**Gerar o app**](docs/APP.md) · [**Funcionalidades**](#-funcionalidades) · [**Perguntas frequentes**](#-perguntas-frequentes)

</div>

---

## ✨ Funcionalidades

<table>
<tr>
<td width="50%" valign="top">

### 📋 Designações
Quadros mensais de microfone, indicadores, áudio e vídeo e estacionamento, com
**preenchimento automático** que respeita funções, indisponibilidades e rodízio. Edição
célula a célula, publicação, histórico e PDF pronto para afixar.

</td>
<td width="50%" valign="top">

### 🙋 Minhas designações
Cada irmão abre o app e vê **só o que é dele**: quadro, reunião, dirigente de campo,
limpeza. Com **lembretes push** na antecedência que ele escolher.

</td>
</tr>
<tr>
<td valign="top">

### 📖 Reunião
Importe o **PDF da programação** e o app monta a semana. Exporte em PDF ou imagem,
compartilhe o **convite do Zoom** no WhatsApp e registre a **assistência** (presencial e
Zoom), com estatísticas e uma imagem pronta para o grupo.

</td>
<td valign="top">

### 🧭 Dirigentes de campo
Saídas de campo por dia e turno, escala mensal gerada pela disponibilidade de cada
dirigente, e PDF da escala.

</td>
</tr>
<tr>
<td valign="top">

### 🗺️ Território com GPS
Os territórios vêm direto do seu **Google My Maps**. O dirigente vê as quadras no mapa,
**marca pelo GPS onde parou** (funciona **sem internet** e envia sozinho depois), registra a
saída, mantém a lista **Não bater** e gera o **S-13** em PDF.

</td>
<td valign="top">

### 🛒 Carrinho, ✅ confirmações e tarefas
Pontos e turnos fixos do carrinho. Mensagem pronta no WhatsApp para confirmar as partes de
estudante. Tarefas atribuídas a cada responsável, com painel de prazos.

</td>
</tr>
<tr>
<td valign="top">

### 🔐 Acesso sob medida
Login com **Face ID ou digital**, **foto de perfil** e admin por área: quem cuida dos
dirigentes mexe só nos dirigentes. Quem tem a função **Áudio e vídeo** já opera a tela de
Reunião.

</td>
<td valign="top">

### 🎨 Feito para o dia a dia
Tema claro e escuro, **modo daltônico**, funciona em telas pequenas e foi desenhado para
quem não é técnico.

</td>
</tr>
</table>

## 🏗️ Como funciona

```mermaid
flowchart LR
  subgraph Celulares
    A[📱 App Android / iPhone<br/>Expo · React Native]
  end
  W[💻 Painel web<br/>React · Vite]
  subgraph Seu servidor
    API[⚙️ API<br/>Node.js · Express · Prisma]
    DB[(🗄️ PostgreSQL)]
  end
  A -- HTTPS --> API
  W -- HTTPS --> API
  API --> DB
  API -- lembretes --> PUSH[🔔 Expo Push]
```

| Pasta | O quê | Stack |
|---|---|---|
| [`backend/`](backend) | API, regras de designação, lembretes | Node 20, Express, Prisma, PostgreSQL |
| [`mobile/`](mobile) | App dos irmãos | Expo SDK 54, React Native 0.81, TypeScript, TanStack Query |
| [`frontend/`](frontend) | Painel web (opcional) | React 19, Vite |

Cada congregação roda a **sua** instalação: os dados ficam no seu servidor, e uma
instalação nova começa **vazia**, só com o usuário `admin`.

## 🚀 Começando

### Em produção, no seu servidor

```bash
git clone https://github.com/jricardoc/designacoes-jw.git
cd designacoes-jw
cp .env.example .env        # senhas, domínios e fuso
docker compose -f docker-compose.prod.yml up -d --build
```

Banco, API, painel web e HTTPS automático sobem juntos. O passo a passo completo — domínio,
EasyPanel, primeiro acesso e configuração inicial — está no
**[tutorial de instalação](docs/INSTALACAO.md)**.

Depois, gere o app apontando para a sua API: **[guia do app](docs/APP.md)**
(Android é grátis).

### Para desenvolver

```bash
docker compose up --build    # banco + API (3001) + painel web (5173)
cd mobile && npm install && cp .env.example .env && npx expo start
```

A senha do `admin` aparece no log da API no primeiro boot
(`docker compose logs backend | grep "Admin criado"`).

## ❓ Perguntas frequentes

<details>
<summary><b>Quanto custa?</b></summary>

O software é gratuito e de código aberto. Você paga só o servidor (uma VPS simples, a partir
de uns R$ 25/mês) e, se quiser, um domínio. Gerar o app Android é grátis; para iPhone é
preciso a conta de desenvolvedor da Apple (US$ 99/ano). Detalhes no [guia do app](docs/APP.md).
</details>

<details>
<summary><b>Preciso publicar na Play Store ou na App Store?</b></summary>

Não. No Android, você gera um APK e manda o link para os irmãos. No iPhone, a distribuição
interna (sem loja) existe, mas exige a conta paga da Apple; quem não tiver pode usar o painel
web pelo Safari.
</details>

<details>
<summary><b>Os dados da minha congregação ficam com quem?</b></summary>

Com você. Cada instalação tem o próprio servidor e o próprio banco; nada é enviado para este
repositório nem para terceiros (as notificações push passam pelo serviço do Expo, só com o
texto do lembrete).
</details>

<details>
<summary><b>Dá para usar só o painel web, sem app?</b></summary>

Dá. O painel web roda em qualquer navegador. O app acrescenta notificações, Face ID/digital e
o uso no dia a dia.
</details>

<details>
<summary><b>Como atualizo para uma versão nova?</b></summary>

`git pull` e suba de novo. O banco é atualizado sozinho no boot, sem perder dados. Veja
[Backup e atualização](docs/INSTALACAO.md#8-backup-e-atualização).
</details>

## 🤝 Contribuindo

Sugestões e correções são bem-vindas: abra uma *issue* ou um *pull request*. Antes de enviar,
rode as verificações:

```bash
cd mobile && npm run typecheck && npm run lint
cd backend && for f in scripts/verificar*.js; do node "$f" || exit 1; done
```

## 📄 Licença

[MIT](LICENSE) — use, modifique e distribua à vontade, mantendo o aviso de copyright.

<sub>Projeto pessoal e sem fins lucrativos, feito por voluntários. Não é um produto oficial
nem tem vínculo com a organização das Testemunhas de Jeová ou com o jw.org.</sub>
