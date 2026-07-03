# Deploy no EasyPanel

Guia de implantação do Quadro de Designações em produção. O projeto tem 3 serviços:
**PostgreSQL**, **backend** (Node/Express/Prisma) e **frontend** (build Vite servido estático).

## 1. Banco de Dados (PostgreSQL)

Crie um serviço PostgreSQL no EasyPanel e anote a connection string. Ela será o
`DATABASE_URL` do backend.

## 2. Backend (API)

- **Build**: use `backend/Dockerfile.prod` (aplica o schema com `prisma db push` no
  boot e sobe a API na porta `3001`).
- **Variáveis de ambiente** (todas configuradas no painel, nunca no código):

  | Variável | Obrigatória | Descrição |
  |----------|-------------|-----------|
  | `DATABASE_URL` | sim | Connection string do Postgres do passo 1 |
  | `JWT_SECRET` | **sim** | Segredo forte e aleatório. Sem ele o servidor **não inicia**. Gere com `openssl rand -hex 32` |
  | `FRONTEND_URL` | sim | URL pública do frontend (liberada no CORS) |
  | `PORT` | não | Padrão `3001` |
  | `JWT_EXPIRES_IN` | não | Padrão `7d` |
  | `ADMIN_SEED_PASSWORD` | não | Senha inicial do usuário `admin` criado no primeiro boot. **Troque no primeiro acesso.** |

> No primeiro boot, o backend cria automaticamente o usuário `admin` e os dados de
> seed. Faça login e troque a senha imediatamente.

## 3. Frontend (Web)

- **Build**: use `frontend/Dockerfile.prod` (multi-stage: build Vite + nginx) **ou**
  o `nixpacks.toml` (Caddy). Escolha **uma** estratégia — o repositório traz as duas
  mais um `nginx.conf` e um `Caddyfile`.
- **Variável de build** (o Vite embute no bundle em *build time*, não em runtime):

  | Variável | Descrição |
  |----------|-----------|
  | `VITE_API_URL` | URL pública do backend (ex.: `https://api.seudominio.com`) |

## 4. Segredos que NÃO vão para o Git

- `JWT_SECRET`, `DATABASE_URL` e senhas: apenas nas variáveis do EasyPanel.
- Mobile: `google-services.json` e a chave `*-firebase-adminsdk-*.json` são
  ignorados pelo `.gitignore` — forneça via EAS Secret no build do app.

## 5. Checklist pós-deploy

- [ ] Login com `admin` funciona e a senha foi trocada.
- [ ] `GET /health` do backend responde `{ "status": "ok" }`.
- [ ] O frontend chama a API correta (confira `VITE_API_URL` no build).
- [ ] `FRONTEND_URL` no backend bate com o domínio real (CORS).
