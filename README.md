# Alfred — AI Router Platform Dashboard

Dashboard completo para gerenciar o projeto Alfred.

## Deploy no Vercel (5 minutos)

### 1. Criar repositório no GitHub
- Vá em github.com/new
- Crie um repo chamado `alfred-dashboard`
- Faça upload de todos os arquivos deste projeto

### 2. Conectar no Vercel
- Vá em vercel.com e faça login com GitHub
- Clique em "Add New Project"
- Selecione o repositório `alfred-dashboard`
- Clique em "Deploy"

### 3. Configurar a IA (opcional)
Para o Alfred AI funcionar, adicione sua API key:
- No Vercel, vá em Settings > Environment Variables
- Adicione: `ANTHROPIC_API_KEY` = sua key da Anthropic
- Faça redeploy

### Rodar localmente
```bash
npm install
cp .env.example .env.local
# Edite .env.local com sua API key
npm run dev
```

Acesse http://localhost:3000

## Features
- Dashboard com métricas
- Kanban com drag & drop
- Ideas com votação
- Checklists
- Timeline / Roadmap
- Notas de Reunião
- Docs / Wiki
- Mind Map
- Métricas de velocidade
- Activity Feed
- Alfred AI integrado
- Templates de cards
- Modo Foco
