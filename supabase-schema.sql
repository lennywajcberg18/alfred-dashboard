-- =============================================
-- ALFRED DASHBOARD - Supabase Schema
-- =============================================
-- Execute este SQL no Supabase SQL Editor
-- (Supabase Dashboard > SQL Editor > New Query)
-- =============================================

-- Tabela principal: armazena o estado do board como JSON
create table if not exists boards (
  id text primary key default 'main',
  data jsonb not null default '{}',
  updated_at timestamp with time zone default now()
);

-- Tabela de membros do time
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  created_at timestamp with time zone default now()
);

-- Inserir o board inicial
insert into boards (id, data) values ('main', '{
  "ideas": [
    {"id":"i1","title":"Roteamento inteligente de prompts","desc":"IA analisa o prompt e escolhe o melhor modelo","status":"exploring","votes":3,"tags":["core"],"date":"2026-03-10"},
    {"id":"i2","title":"GPT-4o mini para contexto","desc":"Modelo barato faz análise inicial antes de rotear","status":"exploring","votes":2,"tags":["backend"],"date":"2026-03-11"},
    {"id":"i3","title":"Marketplace de modelos","desc":"Usuários votam em novos modelos para integrar","status":"validated","votes":5,"tags":["produto"],"date":"2026-03-09"},
    {"id":"i4","title":"API pública para devs","desc":"Desenvolvedores usam o roteamento via API","status":"planned","votes":4,"tags":["dev"],"date":"2026-03-08"}
  ],
  "columns": [
    {"id":"backlog","title":"Backlog","cards":[
      {"id":"c1","title":"Definir critérios de roteamento","priority":"alta","checklist":[{"id":"ck1","text":"Mapear categorias","done":true},{"id":"ck2","text":"Benchmark modelos","done":false},{"id":"ck3","text":"Matriz de decisão","done":false}],"tags":["core"],"ideaId":"i1","created":"2026-03-10","due":"2026-03-20"}
    ]},
    {"id":"doing","title":"Em progresso","cards":[
      {"id":"c2","title":"Landing page Alfred","priority":"alta","checklist":[{"id":"ck4","text":"Design Figma","done":true},{"id":"ck5","text":"Front-end","done":true},{"id":"ck6","text":"Waitlist","done":false}],"tags":["frontend"],"ideaId":null,"created":"2026-03-08","due":"2026-03-15"}
    ]},
    {"id":"review","title":"Revisão","cards":[]},
    {"id":"done","title":"Concluído","cards":[
      {"id":"c3","title":"Pesquisa de mercado","priority":"media","checklist":[{"id":"ck7","text":"Analisar concorrentes","done":true},{"id":"ck8","text":"Entrevistar usuários","done":true}],"tags":["research"],"ideaId":"i4","created":"2026-03-05","due":"2026-03-10","completed":"2026-03-10"}
    ]}
  ],
  "notes": [
    {"id":"n1","title":"Kickoff — MVP","date":"2026-03-08","content":"Foco no roteamento de texto. Imagens e áudio v2.\n\nPrioridades:\n- Landing + waitlist\n- Motor de roteamento\n- Dashboard métricas"}
  ],
  "docs": [
    {"id":"d1","title":"Arquitetura do Roteador","content":"O roteador recebe o prompt, extrai contexto via GPT-4o mini, classifica a intenção e seleciona o modelo ideal.","tags":["tech","arquitetura"],"updated":"2026-03-10"}
  ],
  "activity": [
    {"id":"a1","type":"card_created","label":"Pesquisa de mercado","ts":"2026-03-05"},
    {"id":"a2","type":"card_done","label":"Pesquisa de mercado","ts":"2026-03-10"},
    {"id":"a3","type":"idea_created","label":"Marketplace de modelos","ts":"2026-03-09"}
  ]
}') on conflict (id) do nothing;

-- Habilitar Realtime para a tabela boards
alter publication supabase_realtime add table boards;

-- Políticas de acesso (permite leitura e escrita para todos autenticados ou anon)
alter table boards enable row level security;
create policy "Allow all access to boards" on boards for all using (true) with check (true);

alter table members enable row level security;
create policy "Allow all access to members" on members for all using (true) with check (true);
