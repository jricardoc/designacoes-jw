# Gerando o app para a sua congregação

O app de celular é feito com [Expo](https://expo.dev) (React Native). Cada congregação gera
o **seu** app, apontando para a **sua** API. Nada aqui exige conta paga para Android.

## Resumo: o que é pago e o que é grátis

| Plataforma | Para instalar nos celulares, sem loja | Custo |
|---|---|---|
| **Android** | Gerar um **APK** e mandar o arquivo (WhatsApp, link). | **Grátis.** Conta do Expo gratuita (15 builds Android/mês) ou build local no seu PC. Não precisa de conta Google. |
| **iPhone** | A Apple não deixa instalar app fora da App Store sem conta de desenvolvedor. | **Apple Developer Program, US$ 99/ano.** Veja as [alternativas](#iphone-ios). |
| Google Play (opcional) | Publicar na loja. | US$ 25, uma vez. |

## Pré-requisitos

- [Node.js](https://nodejs.org) 20 ou mais novo.
- A API já no ar, com HTTPS ([tutorial de instalação](INSTALACAO.md)).
- Uma conta gratuita em [expo.dev](https://expo.dev/signup).

## 1. Configure o `mobile/.env`

```bash
cd mobile
npm install
cp .env.example .env
```

Abra o `.env` e preencha:

| Variável | Exemplo | Para quê |
|---|---|---|
| `APP_NAME` | `Servir Mais` | O nome embaixo do ícone. |
| `APP_ID` | `com.vilanova.servirmais` | Identificador único do app. Use algo seu, só minúsculas, números e pontos. **Não mude depois de distribuir:** para o celular, outro identificador é outro app. |
| `EXPO_PUBLIC_API_URL` | `https://api.vilanova.com.br` | Endereço da sua API. |
| `EXPO_OWNER` | `seu-usuario-expo` | Sua conta (ou organização) no expo.dev. |
| `EAS_PROJECT_ID` | `1a2b3c...` | Id do projeto no expo.dev (passo 2). |

## 2. Crie o projeto no Expo

```bash
npx eas-cli login
npx eas-cli init
```

O `init` cria o projeto na sua conta e mostra o **project ID**. Como a configuração do app é
dinâmica (`app.config.js`), ele não consegue gravar sozinho: copie o id para `EAS_PROJECT_ID`
no `.env`, e o seu usuário para `EXPO_OWNER`.

## 3. Gere o APK (Android)

**Na nuvem do Expo (mais fácil):**

```bash
npx eas-cli build --platform android --profile preview
```

No fim, aparece um link e um QR code para baixar o `.apk`. Mande esse link para os irmãos:
no Android, é só abrir e permitir "instalar apps de fontes desconhecidas".

> No plano gratuito, os builds entram numa fila de baixa prioridade e podem levar de alguns
> minutos a mais de uma hora. O limite atual é de 15 builds Android por mês.

**No seu computador (sem fila, sem limite):** precisa do Android SDK (ou do Docker).

```bash
npx eas-cli build --platform android --profile preview --local
```

### Atualizar o app depois

Mudou algo no código do app? Gere um build novo. Se a mudança for nativa (biblioteca nova,
permissão, chave), suba também a `version` no `mobile/app.json`: ela é a versão de runtime
(`runtimeVersion: appVersion`), e é ela que impede uma atualização pelo ar de chegar a um build
que não tem o código nativo dela. Para o Android aceitar como atualização
(e não como outro app), duas coisas precisam ser iguais entre as versões: o `APP_ID` e a
**chave de assinatura**, que o Expo guarda para você no projeto (`eas credentials`).

## iPhone (iOS)

A Apple só permite instalar apps fora da App Store com uma conta do
[Apple Developer Program](https://developer.apple.com/programs/) (US$ 99/ano). Com ela:

```bash
npx eas-cli device:create      # cadastra os iPhones (até 100 por ano), pelo link que ele gera
npx eas-cli build --platform ios --profile preview
```

Também dá para distribuir pelo TestFlight (até 10 mil testadores, sem cadastrar aparelho).

**Sem conta paga**, as alternativas são:
- **O painel web no Safari.** Funciona em qualquer iPhone: abra o endereço e use *Compartilhar →
  Adicionar à Tela de Início*. Não tem Face ID nem notificação push.
- **Uma conta Apple gratuita + um Mac com Xcode** instala o app só no seu próprio iPhone, e ele
  expira a cada 7 dias. Serve para testar, não para distribuir.

## Mapa do território (Google Maps)

A tela de território mostra as quadras num mapa de verdade, com a sua localização e os pontos
marcados pelo GPS. O mapa é o Google Maps, e ele pede uma **chave** por plataforma:

| Variável no `mobile/.env` | Sem ela |
|---|---|
| `GOOGLE_MAPS_ANDROID_KEY` | O Android mostra o território sem o mapa (onde paramos, Não bater e "Como chegar" continuam). |
| `GOOGLE_MAPS_IOS_KEY` | O iPhone usa o mapa da Apple. |

Como criar (o uso no celular é gratuito e ilimitado, mas o Google pede uma conta de faturamento
com cartão):

1. No [Google Cloud Console](https://console.cloud.google.com), crie um projeto e ative o
   faturamento.
2. Em *APIs e serviços → Biblioteca*, ative **Maps SDK for Android** e **Maps SDK for iOS**.
3. Em *Credenciais → Criar credencial → Chave de API*, crie uma chave para cada plataforma e
   restrinja: a do Android ao seu `APP_ID` + impressão digital SHA-1 da assinatura
   (`npx eas-cli credentials` mostra), a do iOS ao seu `APP_ID`.
4. Ponha as chaves no `mobile/.env` e gere um build novo.

A marcação por GPS **funciona sem internet**: o ponto fica guardado no celular e sobe sozinho
quando a conexão volta. Para abrir territórios sem sinal, o app guarda uma cópia de todos eles
a cada 6 horas.

## Notificações push (opcional)

Os lembretes de designação chegam por push. No iPhone funcionam com a conta paga da Apple
(o `eas build` configura). No **Android** é preciso o Firebase (gratuito):

1. No [console do Firebase](https://console.firebase.google.com), crie um projeto e adicione
   um app **Android** com o **mesmo** `APP_ID`.
2. Baixe o `google-services.json` e salve em `mobile/google-services.json`. Ele é detectado
   sozinho e não vai para o Git.
3. Em *Configurações do projeto → Contas de serviço*, gere uma **chave privada** (JSON) e envie
   ao Expo: `npx eas-cli credentials` → Android → *Google Service Account* → *FCM V1*.
4. Gere um build novo.

Sem o Firebase, o app funciona normalmente, só não recebe notificações no Android.

## Links de download sempre no build mais novo

`seusite/download/android` e o botão de instalar de `seusite/download/ios` passam pela API
(`/download/android` e `/download/ios`), que redireciona para o último build de **preview**
guardado no banco. Quem guarda é o próprio EAS, avisando a API a cada build:

1. Gere um segredo (`openssl rand -hex 32`) e coloque em `EAS_WEBHOOK_SECRET` nas variáveis da API.
2. Cadastre o webhook no Expo com o mesmo segredo:

   ```bash
   cd mobile
   npx eas-cli webhook:create --event BUILD --url https://SUA_API/webhooks/eas --secret SEU_SEGREDO
   ```

Pronto: cada build de preview que termina vira o link daquela plataforma. Build de
desenvolvimento, com erro ou cancelado não mexe no link. No `frontend/Caddyfile`, troque
`api.servirmais.site` pelo endereço da sua API.

## Rodar em modo de desenvolvimento

```bash
npx expo start
```

Para testar com a API rodando no seu computador, use o IP da rede no `.env`
(`EXPO_PUBLIC_API_URL=http://192.168.0.10:3001`): o celular não enxerga o `localhost` do PC.
Algumas partes (Face ID, digital, foto) só funcionam num build de desenvolvimento
(`npx eas-cli build --profile development`), não no Expo Go.

## Mudar o app de conta do Expo

Dá para levar o projeto para outra conta sem perder nada:

- **Transferir (recomendado):** no expo.dev, *Project settings → General → Transfer project*.
  Você precisa ser dono ou admin das duas contas. O project ID continua o mesmo; depois, só
  troque `EXPO_OWNER` no `.env`.
- **Recriar:** rode `npx eas-cli init` logado na conta nova e troque `EXPO_OWNER` e
  `EAS_PROJECT_ID`. Antes, baixe a chave de assinatura do Android no projeto antigo
  (`npx eas-cli credentials` → Android → *Download keystore*) e envie no novo. Sem a mesma
  chave, o app novo não instala por cima do antigo: cada irmão teria de desinstalar e instalar
  de novo. Recrie também as variáveis de ambiente e a chave do Firebase no projeto novo.

## Verificações de qualidade

```bash
npm run typecheck
npm run lint
```
