# Quadro de Designações - JW 📋

Projeto profissional reestruturado para alta escalabilidade e organização.

## 🏗️ Arquitetura (Monorepo)

O projeto está dividido em serviços independentes:

*   **🖥️ Frontend (`/frontend`)**: React, Vite, CSS Modules. Responsável pela interface.
*   **⚙️ Backend (`/backend`)**: Node.js, Express, Prisma ORM. Responsável pela lógica de regras de negócio e validações.
*   **🗄️ Database**: PostgreSQL (via Docker). Banco de dados relacional robusto.

## 🚀 Como Rodar (Docker)

Esta é a forma recomendada, pois sobe todo o ambiente (Banco, Back e Front) com um comando.

1.  Abra o **Docker Desktop** no seu computador e aguarde iniciar.
2.  Abra o terminal na pasta deste projeto.
3.  Execute:

```bash
docker-compose up --build -d
```

4.  Acesse: http://localhost:5173

## 🛠️ Comandos Úteis

*   **Parar tudo**: `docker-compose down`
*   **Ver logs**: `docker-compose logs -f`
*   **Reiniciar**: `docker-compose restart`
