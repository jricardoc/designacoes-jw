# Servir Mais — App Mobile (React Native + Expo)

Aplicativo mobile do **Servir Mais**, em React Native com Expo, consumindo a API
(backend Express + Prisma + PostgreSQL) deste repositório.

> **Para gerar o app da sua congregação, siga o [guia do app](../docs/APP.md).**

## ✨ Funcionalidades

Tudo que o painel web oferece, adaptado para mobile:

- **Login** por nickname/senha com token JWT persistido com segurança
  (`expo-secure-store`), e entrada com **Face ID / digital** (`expo-local-authentication`).
- **Foto de perfil** (galeria ou câmera), guardada no banco pela API.
- **Designações** — lista de quadros mensais, dashboard de estatísticas
  globais, criação de quadro (com preenchimento automático e regras), e
  **editor do quadro** com edição célula a célula (escolha de irmãos por função,
  destaque de _indisponível / designação seguida / já escalado no dia_),
  publicar/arquivar, excluir dia (com motivo), histórico de alterações e
  **exportar PDF** (layout idêntico ao do site, via `expo-print`).
- **Escala de Dirigentes** — lista de escalas, criação, editor com escolha do
  dirigente de cada saída de campo (respeitando disponibilidade e
  indisponibilidades), excluir dia ou semana e **exportar PDF** idêntico ao web.
- **Reunião** — importação do PDF da programação, PDF/imagem da semana, convites de
  Zoom e **assistência** (registro, estatísticas e imagem para o WhatsApp). Quem tem a
  função Áudio e Vídeo opera esta tela sem precisar da área "Reuniões".
- **Carrinho** — pontos, turnos fixos semanais e publicadores.
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

```bash
cd mobile
npm install
cp .env.example .env   # aponte EXPO_PUBLIC_API_URL para a sua API
npx expo start
```

Toda a configuração por congregação (nome do app, identificador, API, conta do Expo) vem do
`mobile/.env`, lido pelo `app.config.js`. Detalhes, build do APK, iPhone e notificações push
estão no [guia do app](../docs/APP.md).

## 🧪 Qualidade

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
```
