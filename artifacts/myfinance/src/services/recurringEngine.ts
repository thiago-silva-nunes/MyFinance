/**
 * recurringEngine.ts
 * Motor de geração automática de transações pendentes para lançamentos recorrentes.
 */

import { supabase } from '@/lib/supabase';
import type { ScheduledTransaction, Transaction } from '../data/mockData';

// ─── Helpers de data ──────────────────────────────────────────────────────────

export function pad(n: number) { return String(n).padStart(2, '0'); }

/** Retorna YYYY-MM do mês atual */
export function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** Retorna YYYY-MM-DD de hoje */
export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Dado um scheduled_transaction e uma data de referência,
 * retorna o reference_month (YYYY-MM) que deveria ter uma transação pendente.
 * Retorna null se ainda não é hora de gerar (ex: start_date no futuro).
 */
export function getExpectedReferenceMonth(
  scheduled: ScheduledTransaction,
  asOf: Date = new Date(),
): string | null {
  // Parseia start_date como data local (evita problema de fuso com T00:00:00Z)
  const [sy, sm, sd] = scheduled.startDate.split('-').map(Number);

  const y = asOf.getFullYear();
  const m = asOf.getMonth() + 1;

  // Compare at month granularity (YYYY-MM strings), not day-level.
  // This means a recurring item starting on July 25 generates immediately
  // when the current month is July, even if today is July 17.
  const startYM = `${sy}-${pad(sm)}`;
  const asOfYM  = `${y}-${pad(m)}`;

  switch (scheduled.frequency) {
    case 'once':
      // Só gera uma vez — no mês do start_date, e somente quando esse mês já chegou.
      if (startYM > asOfYM) return null;
      return startYM;

    case 'monthly':
    case 'weekly':
    case 'daily':
      // Gera uma por mês. Elegível a partir do mês de início (não do dia).
      if (startYM > asOfYM) return null;
      return asOfYM;

    case 'yearly': {
      // Month-level check: if the recurrence month has arrived this year, generate for this year.
      // Otherwise fall back to previous year (if the recurrence has started).
      const thisYearOccYM = `${y}-${pad(sm)}`;
      if (startYM <= asOfYM && thisYearOccYM <= asOfYM) {
        return thisYearOccYM;
      }
      // Current month is before the occurrence month this year — use previous year
      const prevY = y - 1;
      const prevYearStartYM = `${sy}-${pad(sm)}`;
      const prevYearOccYM = `${prevY}-${pad(sm)}`;
      if (prevY >= sy && prevYearOccYM >= prevYearStartYM) {
        return prevYearOccYM;
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Calcula a data da transação (YYYY-MM-DD) para o reference_month alvo.
 * Mantém o mesmo dia do start_date, ajustando para o último dia do mês se necessário.
 */
export function getTransactionDateForPeriod(
  scheduled: ScheduledTransaction,
  referenceMonth: string,
): string {
  const [sy, sm, sd] = scheduled.startDate.split('-').map(Number);
  const [ry, rm] = referenceMonth.split('-').map(Number);

  if (scheduled.frequency === 'yearly') {
    // Para anual, a data é no mês do start_date no ano de referência
    const lastDayOfMonth = new Date(ry, sm, 0).getDate();
    const day = Math.min(sd, lastDayOfMonth);
    return `${ry}-${pad(sm)}-${pad(day)}`;
  }

  // Para monthly, weekly, daily, once: usa o mesmo dia do start_date no mês de referência
  const lastDayOfMonth = new Date(ry, rm, 0).getDate();
  const day = Math.min(sd, lastDayOfMonth);
  return `${ry}-${pad(rm)}-${pad(day)}`;
}

// ─── Funções principais ────────────────────────────────────────────────────────

/**
 * Verifica se já existe uma transação (qualquer status) vinculada a esta
 * recorrência para o reference_month alvo. Evita duplicação.
 */
export async function existsForPeriod(
  scheduledId: string,
  referenceMonth: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id')
    .eq('scheduled_id', scheduledId)
    .eq('reference_month', referenceMonth)
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

/**
 * Gera uma transação pendente para o período indicado se ainda não existir.
 * Retorna a transação criada ou null se já existia / falhou.
 */
export async function generatePendingIfNeeded(
  userId: string,
  scheduled: ScheduledTransaction,
  referenceMonth?: string,
): Promise<Transaction | null> {
  const asOf = new Date();
  const targetRefMonth = referenceMonth ?? getExpectedReferenceMonth(scheduled, asOf);
  if (!targetRefMonth) return null;

  // Deduplication: não gera se já existe transação para este período
  const exists = await existsForPeriod(scheduled.id, targetRefMonth);
  if (exists) return null;

  const txDate = getTransactionDateForPeriod(scheduled, targetRefMonth);

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      description: scheduled.description,
      amount: scheduled.amount,
      type: scheduled.type,
      category_id: scheduled.categoryId,
      date: txDate,
      status: 'pending',
      scheduled_id: scheduled.id,
      reference_month: targetRefMonth,
    })
    .select(
      'id, description, amount, type, category_id, subcategory_id, date, status, payment_method, notes, scheduled_id, card_id, bank_id, reference_month',
    )
    .single();

  if (error) {
    // 23505 = unique_violation — another process/tab already inserted this pending row.
    // Treat as "already exists" instead of a real error.
    if ((error as { code?: string }).code === '23505') return null;
    console.warn('[recurringEngine] Falha ao gerar transação pendente:', error);
    return null;
  }

  return {
    id: data.id,
    description: data.description,
    amount: Number(data.amount),
    type: data.type as 'income' | 'expense',
    categoryId: data.category_id,
    subcategoryId: data.subcategory_id ?? undefined,
    date: data.date,
    status: 'pending',
    scheduledId: data.scheduled_id,
    referenceMonth: data.reference_month ?? undefined,
  };
}

/**
 * Força a regeneração de uma transação pendente para o período atual,
 * mesmo que já exista uma paga (cria nova pendente apenas se não houver outra pendente).
 * Usado pelo botão "Regenerar" na tela de Recorrentes.
 *
 * Deduplication strategy:
 * - Queries explicitly for status='pending' with limit(1) — avoids maybeSingle() error
 *   when multiple rows (paid + pending) exist for the same period.
 * - Only inserts a new pending row when no pending row is found.
 */
export async function regeneratePendingForScheduled(
  userId: string,
  scheduled: ScheduledTransaction,
): Promise<Transaction | null> {
  const asOf = new Date();
  const targetRefMonth = getExpectedReferenceMonth(scheduled, asOf);
  if (!targetRefMonth) return null;

  // Check specifically for an existing PENDING row for this period.
  // Using limit(1) instead of maybeSingle() to safely handle multiple rows
  // (e.g. one paid + one pending) without throwing a "multiple rows" error.
  const { data: existingPending, error: checkErr } = await supabase
    .from('transactions')
    .select('id')
    .eq('scheduled_id', scheduled.id)
    .eq('reference_month', targetRefMonth)
    .eq('status', 'pending')
    .limit(1);

  if (checkErr) {
    console.warn('[recurringEngine] Erro ao verificar pendentes existentes:', checkErr);
    return null;
  }

  if (existingPending && existingPending.length > 0) {
    // Already has a pending transaction for this period — do not duplicate.
    return null;
  }

  // No pending found. Create a new one (even if a paid row already exists —
  // user explicitly wants to re-generate for this period).
  const txDate = getTransactionDateForPeriod(scheduled, targetRefMonth);

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      description: scheduled.description,
      amount: scheduled.amount,
      type: scheduled.type,
      category_id: scheduled.categoryId,
      date: txDate,
      status: 'pending',
      scheduled_id: scheduled.id,
      reference_month: targetRefMonth,
    })
    .select(
      'id, description, amount, type, category_id, subcategory_id, date, status, payment_method, notes, scheduled_id, card_id, bank_id, reference_month',
    )
    .single();

  if (error) {
    // 23505 = unique_violation — race condition: another process inserted a pending row
    // between our check and our insert. Treat as "already exists".
    if ((error as { code?: string }).code === '23505') return null;
    console.warn('[recurringEngine] Falha ao regenerar transação pendente:', error);
    return null;
  }

  return {
    id: data.id,
    description: data.description,
    amount: Number(data.amount),
    type: data.type as 'income' | 'expense',
    categoryId: data.category_id,
    subcategoryId: data.subcategory_id ?? undefined,
    date: data.date,
    status: 'pending',
    scheduledId: data.scheduled_id,
    referenceMonth: data.reference_month ?? undefined,
  };
}

/**
 * Varre todas as recorrências ativas e gera transações pendentes faltantes
 * para o período atual. Chamado no carregamento da tela e no início de cada mês.
 */
export async function generateAllPendingForCurrentPeriod(
  userId: string,
  scheduledList: ScheduledTransaction[],
): Promise<Transaction[]> {
  const generated: Transaction[] = [];
  const asOf = new Date();

  for (const scheduled of scheduledList) {
    if (!scheduled.active) continue;
    // 'once' só gera uma vez; as demais geram por período
    const tx = await generatePendingIfNeeded(userId, scheduled);
    if (tx) generated.push(tx);
  }

  // Marca mês já processado no localStorage (para evitar re-varredura desnecessária)
  const currentMonth = `${asOf.getFullYear()}-${pad(asOf.getMonth() + 1)}`;
  try {
    localStorage.setItem('myfinance_recurring_last_check', currentMonth);
  } catch {}

  return generated;
}

/**
 * Retorna true se a varredura automática já foi feita no mês corrente.
 */
export function alreadyCheckedThisMonth(): boolean {
  try {
    const last = localStorage.getItem('myfinance_recurring_last_check');
    return last === getCurrentYearMonth();
  } catch {
    return false;
  }
}

// ─── Utilidade para o painel de análise ───────────────────────────────────────

/**
 * Normaliza o valor de uma recorrência para custo mensal equivalente.
 */
export function monthlyEquivalent(scheduled: ScheduledTransaction): number {
  switch (scheduled.frequency) {
    case 'daily':   return scheduled.amount * 30;
    case 'weekly':  return scheduled.amount * (52 / 12);
    case 'monthly': return scheduled.amount;
    case 'yearly':  return scheduled.amount / 12;
    case 'once':    return scheduled.amount; // pontual — exibido à parte
    default:        return scheduled.amount;
  }
}
