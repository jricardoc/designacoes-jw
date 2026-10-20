# Servir Mais — painel web

Versão para o navegador (React + Vite), opcional. Consome a mesma API do app.

```bash
npm install
VITE_API_URL=http://localhost:3001 npm run dev
```

Em produção, `Dockerfile.prod` gera o build e serve com nginx; `VITE_API_URL` é gravado no
build. Veja o [tutorial de instalação](../docs/INSTALACAO.md).
