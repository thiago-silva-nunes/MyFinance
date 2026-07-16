---
name: Invoice recalc error isolation
description: How to handle ensureInvoice/recalcInvoiceTotal failures without bubbling up as user-visible errors
---

## Rule
The insert/update of `transactions` rows is the **critical** step. `ensureInvoice` and `recalcInvoiceTotal` called after it are **non-critical** — wrap them in individual `try/catch` blocks and log with `console.warn`. Never rethrow.

## Why
A race condition, network error, or RLS issue in the invoice step used to propagate all the way to the UI toast, showing "Erro ao salvar transação" even though the transactions were already successfully committed. User would see an error but the data was fine on reload.

## How to apply
In `dataService.ts`, for `addInstallments`, `addTransaction`, and `updateTransaction`:
- Complete the Supabase `.insert()` / `.update()` on `transactions` first and throw on its error.
- Then wrap each `ensureInvoice` + `recalcInvoiceTotal` call in `try { ... } catch(e) { console.warn(..., e); }`.
- In `FinanceContext`, wrap each `dataService.*` call in `try { ... } finally { await refreshData(); }` so the transaction list always updates even when invoice steps fail.
