# MyFinance

App de finanças pessoais — controle de receitas, despesas, categorias e lançamentos recorrentes com sincronização na nuvem via Supabase.

## Run & Operate

- `pnpm --filter @workspace/myfinance run dev` — frontend React (Vite)
- `pnpm --filter @workspace/api-server run dev` — API server Express (porta 8080)
- `pnpm run typecheck` — typecheck completo
- `pnpm run build` — build de todos os pacotes

## Required Secrets

| Secret | Onde encontrar |
|--------|----------------|
| `VITE_SUPABASE_URL` | supabase.com → projeto → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | supabase.com → projeto → Settings → API |

Depois de adicionar os secrets, reinicie o workflow **artifacts/myfinance: web**.

Execute também `supabase/schema.sql` no SQL Editor do Supabase para criar as tabelas.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7, Tailwind CSS v4, Shadcn/UI, Wouter, Recharts, Framer Motion
- Auth & DB: Supabase (Auth email/senha, PostgreSQL, RLS)
- PWA: vite-plugin-pwa (manifest, service worker, install banner)
- API: Express 5 (atualmente só `/health`)

## Where things live

- `artifacts/myfinance/src/` — app React
  - `pages/` — Dashboard, Transactions, Categories, Scheduled, Reports, Settings, Login, Signup
  - `components/` — Layout (sidebar + bottom nav + FAB), form dialogs, InstallPWA
  - `context/AuthContext.tsx` — autenticação Supabase
  - `context/FinanceContext.tsx` — estado global dos dados financeiros
  - `services/dataService.ts` — camada de dados (Supabase)
  - `data/mockData.ts` — tipos + dados de exemplo (usados apenas pelo seed)
  - `lib/supabase.ts` — cliente Supabase
- `supabase/schema.sql` — script SQL com tabelas e RLS
- `artifacts/myfinance/public/icons/` — ícones PWA (192px e 512px)

## Architecture decisions

- **Supabase em vez de localStorage**: dados persistem na nuvem e ficam acessíveis de qualquer dispositivo.
- **RLS (Row Level Security)**: cada usuário vê somente seus próprios dados via `auth.uid() = user_id`.
- **FinanceContext assíncrono**: todos os métodos CRUD são async/await; a UI mostra loading spinner enquanto os dados carregam.
- **PWA instalável**: vite-plugin-pwa gera manifest + service worker; banner de instalação para Android/Chrome e instruções para iOS/Safari.
- **Bottom navigation mobile**: sidebar no desktop, bottom nav + FAB no mobile (< 768px).
- **Seed data**: mockData.ts não é mais carregado automaticamente — disponível via botão "Carregar dados de exemplo" em Configurações.

## User preferences

_Populate as you build._

## Gotchas

- `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` devem ser prefixadas com `VITE_` para ficarem acessíveis ao Vite no client-side.
- O `packageManager` em `package.json` foi atualizado para `pnpm@10.26.1` (versão disponível no ambiente Replit).
- Datas são armazenadas como `date` (YYYY-MM-DD) no Supabase; o dataService faz a conversão de/para ISO string.
- O campo `dre_group` (obrigatório no DB) é definido automaticamente como `'receita'` ou `'despesa_variavel'` com base no `type` da categoria.
