# MyFinance

App de finanças pessoais (PWA) com React + Vite + Supabase.

## Como rodar

Adicione as secrets abaixo via painel de Secrets do Replit:

| Secret | Onde encontrar |
|--------|----------------|
| `VITE_SUPABASE_URL` | supabase.com → projeto → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | supabase.com → projeto → Settings → API |

Depois de adicionar os secrets, reinicie o workflow **artifacts/myfinance: web**.

Execute também `supabase/schema.sql` no SQL Editor do Supabase para criar as tabelas (inclui subcategorias e cartões de crédito).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7, Tailwind CSS v4, Shadcn/UI, Wouter, Recharts, Framer Motion
- Auth & DB: Supabase (Auth email/senha, PostgreSQL, RLS)
- PWA: vite-plugin-pwa (manifest, service worker, install banner)
- API: Express 5 (atualmente só `/health`)

## Where things live

- `artifacts/myfinance/src/` — app React
  - `pages/` — Dashboard, Transactions, Categories, Scheduled, Reports, Dre, Cards, CardDetail, Settings, Login, Signup
  - `components/` — Layout (sidebar + bottom nav + FAB), form dialogs (CategoryFormDialog, TransactionFormDialog, CardFormDialog, ScheduledFormDialog), InstallPWA
  - `context/AuthContext.tsx` — autenticação Supabase
  - `context/FinanceContext.tsx` — estado global (categories, subcategories, transactions, cards, invoices)
  - `services/dataService.ts` — camada de dados (Supabase); exporta `extractErrorMessage` para exibir erros descritivos
  - `data/mockData.ts` — tipos (Category, Subcategory, Transaction, CreditCard, Invoice) + dados de exemplo
  - `lib/supabase.ts` — cliente Supabase
- `supabase/schema.sql` — script SQL completo (categories, subcategories, transactions, scheduled_transactions, credit_cards, invoices, RLS, migration guard)

## Architecture decisions

- **Supabase em vez de localStorage**: dados persistem na nuvem e ficam acessíveis de qualquer dispositivo.
- **RLS (Row Level Security)**: cada usuário vê somente seus próprios dados via `auth.uid() = user_id`. Queries também passam `eq('user_id', user.id)` explicitamente como dupla proteção.
- **Subcategorias**: tabela `subcategories` referencia `categories`. Lançamentos têm `subcategory_id` nullable; ao excluir uma subcategoria o DB seta `null` (ON DELETE SET NULL).
- **FinanceContext assíncrono**: todos os métodos CRUD são async/await; a UI mostra loading spinner enquanto os dados carregam. `getSubcategories` falha silenciosamente (catch → []) se a tabela ainda não existir no DB.
- **DRE em árvore com 3 níveis**: grupo > categoria > subcategoria > lançamentos. Categorias sem subcategorias agrupam lançamentos direto (nível extra omitido).
- **Relatórios com filtro por subcategoria**: ao selecionar uma categoria que tenha subcategorias, o gráfico de pizza pode ser agrupado por subcategoria.
- **PWA instalável**: vite-plugin-pwa gera manifest + service worker; banner de instalação para Android/Chrome e instruções para iOS/Safari.
- **Bottom navigation mobile**: sidebar no desktop, bottom nav + FAB no mobile (< 768px).
- **Seed data**: mockData.ts não é mais carregado automaticamente — disponível via botão "Carregar dados de exemplo" em Configurações.
- **Mensagens de erro descritivas**: `extractErrorMessage()` em dataService.ts extrai `message`, `details`, `hint` e `code` do PostgrestError do Supabase.

## User preferences

_Populate as you build._

## Gotchas

- `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` devem ser prefixadas com `VITE_` para ficarem acessíveis ao Vite no client-side.
- O `packageManager` em `package.json` foi atualizado para `pnpm@10.26.1` (versão disponível no ambiente Replit).
- Datas são armazenadas como `date` (YYYY-MM-DD) no Supabase; o dataService faz a conversão de/para ISO string.
- O campo `dre_group` (obrigatório no DB) é definido automaticamente como `'receita'` ou `'despesa_variavel'` com base no `type` da categoria.
- `closing_day` e `due_day` em credit_cards são enviados como `Number()` para evitar violação de constraint quando form retorna string.
- `getSubcategories` usa `.catch(() => [])` no FinanceContext para que o app não quebre em DBs sem a tabela subcategories ainda.
