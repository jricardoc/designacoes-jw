# Designações JW — App Mobile (React Native + Expo)

Aplicativo mobile do **Quadro de Designações** da Congregação Norte de Itapuã.
Reimplementa todo o front-end web em React Native com Expo, consumindo a mesma
API (backend Express + Prisma + PostgreSQL) que já existe neste repositório.

## ✨ Funcionalidades

Tudo que o painel web oferece, adaptado para mobile:

- **Login** por nickname/senha com token JWT persistido com segurança
  (`expo-secure-store`).
- **Designações** — lista de quadros mensais, dashboard de estatísticas
  globais, criação de quadro (com preenchimento automático e regras), e
  **editor do quadro** com edição célula a célula (escolha de irmãos por função,
  destaque de _indisponível / designação seguida / já escalado no dia_),
  publicar/arquivar, excluir dia (com motivo), histórico de alterações e
  **exportar PDF** (layout idêntico ao do site, via `expo-print`).
- **Escala de Dirigentes** — lista de escalas, criação, editor com escolha de
  dirigente principal/substituto por saída de campo (respeitando
  disponibilidade e indisponibilidades) e **exportar PDF** idêntico ao web.
- **Reunião** — visualização da programação semanal importada (somente leitura).
- **Carrinho** — painel de agendamentos (dados de exemplo, igual ao web).
- **Conta** — editar nome, nickname e senha; administração de usuários
  (criar, promover/rebaixar admin, resetar senha, excluir) para administradores.
- **Configurações** — gerenciar irmãos (CRUD, funções, nível de áudio e vídeo,
  calendário de indisponibilidades, disponibilidade como dirigente) e resetar o
  banco de dados.

## 🧱 Stack & padrões

- **Expo SDK 54** + **Expo Router v6** (rotas por arquivos, New Architecture,
  React 19, React Native 0.81, Reanimated 4).
- **TypeScript** estrito com alias `@/*`.
- **TanStack Query (React Query)** para data-fetching, cache e mutations.
- **expo-secure-store** para o token (fallback `localStorage` no web).
- Camada de API tipada e isolada (`src/api`), hooks por domínio, design tokens
  centralizados (`src/theme`) e um kit de UI próprio (`src/components/ui`).

## 📂 Estrutura

```
mobile/
├─ app/                     # Rotas (Expo Router)
│  ├─ _layout.tsx           # Providers + guarda de autenticação
│  ├─ index.tsx             # Redireciona login/app
│  ├─ login.tsx
│  ├─ (tabs)/               # Abas: Designações, Dirigentes, Reunião, Carrinho, Conta
│  ├─ quadro/[id].tsx       # Editor do quadro de designações
│  ├─ escala/[id].tsx       # Editor da escala de dirigentes
│  ├─ config.tsx            # Configurações (irmãos + sistema)
│  └─ irmao.tsx             # Criar/editar irmão
└─ src/
   ├─ api/                  # client, types, queryKeys, hooks/
   ├─ components/           # ui/ (kit) + quadros/ dirigentes/ reuniao/ config/
   ├─ context/             # AuthContext
   ├─ lib/                  # queryClient
   ├─ theme/                # cores, espaçamentos, status
   └─ utils/                # regras de designação, datas, funções
```

## 🚀 Como rodar

### 1. Backend
Suba a API (na raiz do repositório):

```bash
docker compose up        # ou, dentro de /backend:  npm install && npm run dev
```

A API sobe na porta **3001**. Login padrão: **`admin` / `jw1010`**.

### 2. URL da API
Por padrão o app já aponta para a **API de produção** (Easypanel), configurada
em `expo.extra.apiUrl` no `app.json`:

```
https://api.designacoes.jricardodev.com.br
```

Não é preciso configurar nada para usar produção. Para apontar para outro
ambiente (ex.: API local), defina `EXPO_PUBLIC_API_URL` num `.env`:

```bash
cp .env.example .env
# ex.: EXPO_PUBLIC_API_URL=http://192.168.0.10:3001
```

> Celulares/emuladores **não** enxergam o `localhost` do PC. Para a API local
> use o IP da sua rede (no Windows: `ipconfig` → campo *IPv4 Address*).

### 3. Instalar e iniciar

```bash
cd mobile
npm install
npx expo start
```

Abra no **Expo Go** (escaneie o QR Code) ou pressione `a` (Android) / `i` (iOS).

## 🔌 Observações sobre a API

- O backend já permite requisições sem `Origin` (apps nativos) no CORS, então
  não é necessária configuração extra para o mobile.
- O cliente HTTP injeta automaticamente o header `Authorization: Bearer <token>`
  e trata erros do backend (`{ "error": "..." }`).
- Importação de reuniões via Excel permanece no painel web; no app a
  programação é exibida em modo leitura.

## 📦 Build (EAS)

O projeto já está vinculado ao EAS (`@ocaradocopytrade/servir-mais`) e o
`eas.json` tem três perfis. Cada perfil usa o *environment* correspondente no
EAS (onde está a variável `EXPO_PUBLIC_API_URL`).

```bash
# APK de teste (instala direto no celular)
eas build --platform android --profile preview

# Build de produção (AAB para a Play Store)
eas build --platform android --profile production
```

## 🔔 Notificações Push (Firebase / FCM)

O app já registra o dispositivo e obtém o **Expo Push Token** após o login
(`src/notifications/`). Para as notificações funcionarem em produção no Android,
configure o Firebase Cloud Messaging:

1. **Firebase → Adicionar app Android**
   - Console do Firebase → projeto *Servir Mais* → "Adicionar app" → Android.
   - Nome do pacote: **`com.norteitapua.designacoesjw`** (igual a `android.package`).
   - Baixe o **`google-services.json`** e salve em `mobile/google-services.json`.

2. **Referencie o arquivo no `app.json`** (dentro de `expo.android`):
   ```json
   "android": {
     "package": "com.norteitapua.designacoesjw",
     "googleServicesFile": "./google-services.json"
   }
   ```

3. **Chave de serviço FCM V1 para o EAS** (para o serviço de push do Expo enviar
   ao FCM):
   - Firebase → ⚙️ Configurações do projeto → **Contas de serviço** →
     "Gerar nova chave privada" → baixe o JSON.
   - Envie ao EAS:
     ```bash
     eas credentials        # Android → escolha "FCM V1" → faça upload do JSON
     ```

4. **Testar**: instale um build (`eas build -p android --profile preview`), abra o
   app e logue. O **Expo Push Token** aparece no console (`Expo Push Token: ...`).
   Cole esse token em https://expo.dev/notifications para enviar um teste.

> iOS exige conta paga do Apple Developer (chave APNs) — o EAS configura via
> `eas credentials`. O Firebase no plano Spark já cobre o FCM do Android.

### Enviar notificações pelo backend (próximo passo)
Para disparar notificações a partir do sistema, é preciso: (1) um endpoint no
backend para salvar o Expo Push Token de cada usuário e (2) chamar a API de push
do Expo (`https://exp.host/--/api/v2/push/send`). O app já tem o token pronto em
`usePushNotifications()` para enviar a esse endpoint quando ele existir.

## 🧪 Qualidade

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint (opcional)
```
