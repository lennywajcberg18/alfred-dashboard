# Alfred — Dashboard Compartilhado

Dashboard completo com dados compartilhados em tempo real entre sócios.

## Setup Completo (10 minutos)

### 1. Criar banco de dados no Supabase (grátis)

1. Vá em **supabase.com** e crie uma conta
2. Clique em **"New Project"**
3. Dê o nome **alfred-db**, escolha uma senha e região (South America se disponível)
4. Espere criar (1-2 min)
5. Vá em **SQL Editor** (menu lateral)
6. Clique em **"New Query"**
7. Cole TODO o conteúdo do arquivo **supabase-schema.sql** deste projeto
8. Clique em **"Run"** (o botão verde)
9. Vá em **Settings > API** e copie:
   - **Project URL** (ex: https://xxxxx.supabase.co)
   - **anon public** key (a chave longa que começa com eyJ...)

### 2. Subir código no GitHub

1. Vá em **github.com/new** e crie o repo **alfred-dashboard**
2. Faça upload de TODOS os arquivos deste projeto (exceto .env.example)
3. Importante: o **package.json** deve estar na raiz do repo

### 3. Deploy no Vercel

1. Vá em **vercel.com** e logue com GitHub
2. Clique em **"Add New Project"**
3. Selecione **alfred-dashboard**
4. **ANTES de clicar Deploy**, vá em "Environment Variables" e adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` = a URL que copiou do Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = a chave anon que copiou
   - `ANTHROPIC_API_KEY` = sua key da Anthropic (opcional, para o Alfred AI)
5. Clique em **Deploy**

### 4. Pronto!

- Compartilhe o link com seus sócios
- Cada um entra com seu nome
- Todas as alterações sincronizam em tempo real
- O Activity Feed mostra quem fez o quê

## Como funciona

- **Dados compartilhados**: Tudo salva no Supabase (banco PostgreSQL)
- **Tempo real**: Quando alguém muda algo, todos veem instantaneamente
- **Login simples**: Cada sócio entra com seu nome (sem senha)
- **Activity Feed**: Mostra quem criou, moveu ou completou cada item
- **Alfred AI**: Assistente que enxerga todo o projeto (precisa de API key da Anthropic)

## Features

- Dashboard com métricas
- Ideas com votação
- Kanban com drag & drop
- Checklists
- Timeline / Roadmap
- Notas de Reunião
- Docs / Wiki
- Mind Map
- Métricas de velocidade
- Activity Feed (com nome de quem fez)
- Alfred AI integrado
- Templates de cards
- Modo Foco
- Sync em tempo real entre sócios
