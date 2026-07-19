# MyFinance

A personal finance web app (in Brazilian Portuguese) for managing transactions, bank accounts, credit cards, invoices, budgets, and recurring entries. Built with React + Vite + Tailwind CSS + Supabase.

## Stack

- **Frontend**: React 19, Vite 7, Tailwind CSS 4, shadcn/ui components
- **Routing**: Wouter
- **State / data fetching**: TanStack Query
- **Database**: Supabase (PostgreSQL)
- **PWA**: vite-plugin-pwa with service worker

## Running the app

The main app is the `artifacts/myfinance` artifact. Its workflow (`artifacts/myfinance: web`) runs:

```
pnpm --filter @workspace/myfinance run dev
```

After installing dependencies (`pnpm install` from the workspace root), the workflow starts automatically.

## Required secrets

The app needs two Replit Secrets to connect to Supabase. Add them via the padlock icon in the sidebar:

| Secret | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | supabase.com → your project → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | supabase.com → your project → Settings → API |

After adding the secrets, restart the workflow. The app will show a "Configuração necessária" screen until both are provided.

## Database schema

Run the SQL files in Supabase's SQL Editor in this order:

1. `artifacts/myfinance/supabase/schema.sql` (base schema — not present, check Supabase directly)
2. `artifacts/myfinance/supabase/schema_v3_budgets.sql` (budgets table)
3. `artifacts/myfinance/supabase/schema_v6_transfers.sql` (transfers)

## Monorepo structure

```
artifacts/myfinance/   ← main React app
artifacts/api-server/  ← API server (currently unused by the frontend)
lib/                   ← shared libraries (api-client-react, api-spec, api-zod, db)
```

## User preferences

- Keep the Portuguese (pt-BR) language throughout the app.
