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
  const [sy, sm] = scheduled.startDate.split('-').map(Number);

  const y = asOf.getFullYear();
  const m = asOf.getMonth() + 1;

  const startYM = `${sy}-${pad(sm)}`;
  const asOfYM  = `${y}-${pad(m)}`;

  switch (scheduled.frequency) {
    case 'once':
      if (startYM > asOfYM) return null;
      return startYM;

    case 'monthly':
    case 'weekly':
    case 'daily':
      if (startYM > asOfYM) return null;
      return asOfYM;

    case 'yearly': {
      const thisYearOccYM = `${y}-${pad(sm)}`;
      if (startYM <= asOfYM && thisYearOccYM <= asOfYM) {
        return thisYearOccYM;
      }
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
    const lastDayOfMonth = new Date(ry, sm, 0).getDate();
    const day = Math.min(sd, lastDayOfMonth);
    return `${ry}-${pad(sm)}-${pad(day)}`;
  }

  const lastDayOfMonth = new Date(ry, rm, 0).getDate();
  const day = Math.min(sd, lastDayOfMonth);
  return `${ry}-${pad(rm)}-${pad(day)}`;
}

// ─── Backfill: todos os períodos pendentes ────────────────────────────────────

/**
 * Retorna todos os reference_month (YYYY-MM) que deveriam ter sido gerados
 * desde o início da recorrência até o período atual (asOf).
 * Limite de segurança: 36 períodos por chamada.
 */
export function getPendingPeriodsToGenerate(
  scheduled: ScheduledTransaction,
  asOf: Date = new Date(),
): string[] {
  const LIMIT = 36;
  const [sy, sm] = scheduled.startDate.split('-').map(Number);
  const asOfY = asOf.getFullYear();
  const asOfM = asOf.getMonth() + 1;

  const startYM = `${sy}-${pad(sm)}`;
  const asOfYM  = `${asOfY}-${pad(asOfM)}`;

  // Ainda não começou
  if (startYM > asOfYM) return [];

  switch (scheduled.frequency) {
    case 'once': {
      // Só um período — o mês do start_date
      return [startYM];
    }

    case 'monthly':
    case 'weekly':
    case 'daily': {
      // Um por mês, do mês de início até o atual.
      // Calcula o total de meses no intervalo para determinar o ponto de início correto.
      const totalMonths =
        (asOfY - sy) * 12 + (asOfM - sm) + 1; // +1 inclui o mês inicial

      // Se o intervalo excede o limite, começamos dos LIMIT meses mais recentes.
      let startY = sy, startM = sm;
      if (totalMonths > LIMIT) {
        console.warn(
          `[recurringEngine] Limite de ${LIMIT} períodos atingido para recorrência ${scheduled.id}. ` +
          `Gerando apenas os ${LIMIT} mais recentes.`,
        );
        // Retrocede LIMIT-1 meses a partir do mês atual
        const offset = LIMIT - 1;
        startM = asOfM - (offset % 12);
        startY = asOfY - Math.floor(offset / 12);
        if (startM <= 0) { startM += 12; startY -= 1; }
        // Garante que não vamos antes do start_date original
        const clampedStartYM = `${startY}-${pad(startM)}`;
        if (clampedStartYM < startYM) { startY = sy; startM = sm; }
      }

      const periods: string[] = [];
      let y = startY, m = startM;
      while (true) {
        const ym = `${y}-${pad(m)}`;
        if (ym > asOfYM) break;
        periods.push(ym);
        m++;
        if (m > 12) { m = 1; y++; }
      }
      return periods;
    }

    case 'yearly': {
      // Um por ano, no mês do start_date, do ano de início até o atual.
      // Se o intervalo excede o limite, começamos dos LIMIT anos mais recentes.
      const occurrenceYears: number[] = [];
      for (let year = sy; year <= asOfY; year++) {
        const ym = `${year}-${pad(sm)}`;
        if (ym > asOfYM) break;
        occurrenceYears.push(year);
      }

      if (occurrenceYears.length > LIMIT) {
        console.warn(
          `[recurringEngine] Limite de ${LIMIT} períodos atingido para recorrência ${scheduled.id}. ` +
          `Gerando apenas os ${LIMIT} mais recentes.`,
        );
        occurrenceYears.splice(0, occurrenceYears.length - LIMIT);
      }

      return occurrenceYears.map(year => `${year}-${pad(sm)}`);
    }

    default:
      return [];
  }
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
      subcategory_id: scheduled.subcategoryId ?? null,
      bank_id: scheduled.bankId ?? null,
      date: txDate,
      status: 'pending',
      scheduled_id: scheduled.id,
      reference_month: targetRefMonth,
      dre_group_override: scheduled.dreGroupOverride ?? null,
    })
    .select(
      'id, description, amount, type, category_id, subcategory_id, date, status, payment_method, notes, scheduled_id, card_id, bank_id, reference_month, dre_group_override',
    )
    .single();

  if (error) {
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
    bankId: (data as Record<string, unknown>).bank_id as string | undefined ?? undefined,
    date: data.date,
    status: 'pending',
    scheduledId: data.scheduled_id,
    referenceMonth: data.reference_month ?? undefined,
    dreGroupOverride: (data as Record<string, unknown>).dre_group_override as string | undefined ?? undefined,
  };
}

export type RegenerateResult = {
  transaction: Transaction | null;
  reason?: 'already_paid' | 'already_pending';
};

/**
 * Força a regeneração de uma transação pendente para o período atual.
 */
export async function regeneratePendingForScheduled(
  userId: string,
  scheduled: ScheduledTransaction,
): Promise<RegenerateResult> {
  const asOf = new Date();
  const targetRefMonth = getExpectedReferenceMonth(scheduled, asOf);
  if (!targetRefMonth) return { transaction: null };

  const { data: existing, error: checkErr } = await supabase
    .from('transactions')
    .select('id, status')
    .eq('scheduled_id', scheduled.id)
    .eq('reference_month', targetRefMonth)
    .limit(2);

  if (checkErr) {
    console.warn('[recurringEngine] Erro ao verificar transações existentes:', checkErr);
    return { transaction: null };
  }

  if (existing && existing.length > 0) {
    const hasPaid    = existing.some(r => r.status === 'paid');
    const hasPending = existing.some(r => r.status === 'pending');
    if (hasPaid) return { transaction: null, reason: 'already_paid' };
    if (hasPending) return { transaction: null, reason: 'already_pending' };
  }

  const txDate = getTransactionDateForPeriod(scheduled, targetRefMonth);

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      description: scheduled.description,
      amount: scheduled.amount,
      type: scheduled.type,
      category_id: scheduled.categoryId,
      subcategory_id: scheduled.subcategoryId ?? null,
      bank_id: scheduled.bankId ?? null,
      date: txDate,
      status: 'pending',
      scheduled_id: scheduled.id,
      reference_month: targetRefMonth,
      dre_group_override: scheduled.dreGroupOverride ?? null,
    })
    .select(
      'id, description, amount, type, category_id, subcategory_id, date, status, payment_method, notes, scheduled_id, card_id, bank_id, reference_month, dre_group_override',
    )
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return { transaction: null, reason: 'already_pending' };
    }
    console.warn('[recurringEngine] Falha ao regenerar transação pendente:', error);
    return { transaction: null };
  }

  const tx: Transaction = {
    id: data.id,
    description: data.description,
    amount: Number(data.amount),
    type: data.type as 'income' | 'expense',
    categoryId: data.category_id,
    subcategoryId: data.subcategory_id ?? undefined,
    bankId: (data as Record<string, unknown>).bank_id as string | undefined ?? undefined,
    date: data.date,
    status: 'pending',
    scheduledId: data.scheduled_id,
    referenceMonth: data.reference_month ?? undefined,
    dreGroupOverride: (data as Record<string, unknown>).dre_group_override as string | undefined ?? undefined,
  };
  return { transaction: tx };
}

/**
 * Retorna as transações pendentes vinculadas a recorrências ativas cujas datas
 * já passaram (atrasadas), ordenadas da mais antiga para a mais nova.
 */
export function getOverdueTransactions(
  scheduledList: ScheduledTransaction[],
  transactions: Transaction[],
): Transaction[] {
  const today = getTodayStr();
  const activeScheduledIds = new Set(
    scheduledList.filter(s => s.active).map(s => s.id),
  );

  return transactions
    .filter(
      t =>
        t.status === 'pending' &&
        t.scheduledId != null &&
        activeScheduledIds.has(t.scheduledId) &&
        t.date < today,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Insere uma única transação pendente no banco.
 */
async function insertPendingTransaction(
  userId: string,
  scheduled: ScheduledTransaction,
  referenceMonth: string,
): Promise<Transaction | null> {
  const txDate = getTransactionDateForPeriod(scheduled, referenceMonth);

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      description: scheduled.description,
      amount: scheduled.amount,
      type: scheduled.type,
      category_id: scheduled.categoryId,
      subcategory_id: scheduled.subcategoryId ?? null,
      bank_id: scheduled.bankId ?? null,
      date: txDate,
      status: 'pending',
      scheduled_id: scheduled.id,
      reference_month: referenceMonth,
      dre_group_override: scheduled.dreGroupOverride ?? null,
    })
    .select(
      'id, description, amount, type, category_id, subcategory_id, date, status, payment_method, notes, scheduled_id, card_id, bank_id, reference_month, dre_group_override',
    )
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') return null;
    console.warn('[recurringEngine] Falha ao inserir pendente:', error);
    return null;
  }

  return {
    id: data.id,
    description: data.description,
    amount: Number(data.amount),
    type: data.type as 'income' | 'expense',
    categoryId: data.category_id,
    subcategoryId: data.subcategory_id ?? undefined,
    bankId: (data as Record<string, unknown>).bank_id as string | undefined ?? undefined,
    date: data.date,
    status: 'pending',
    scheduledId: data.scheduled_id,
    referenceMonth: data.reference_month ?? undefined,
    dreGroupOverride: (data as Record<string, unknown>).dre_group_override as string | undefined ?? undefined,
  };
}

/**
 * Varre todas as recorrências ativas e gera transações pendentes faltantes
 * para TODOS os períodos desde o início (backfill completo).
 * Performance: uma query por recorrência traz todos os reference_month já
 * existentes; a checagem de duplicação é feita em memória.
 */
export async function generateAllPendingForCurrentPeriod(
  userId: string,
  scheduledList: ScheduledTransaction[],
): Promise<Transaction[]> {
  const generated: Transaction[] = [];
  const asOf = new Date();

  for (const scheduled of scheduledList) {
    if (!scheduled.active) continue;

    const periods = getPendingPeriodsToGenerate(scheduled, asOf);
    if (periods.length === 0) continue;

    // Busca todos os reference_month já existentes para esta recorrência (uma única query)
    const { data: existing } = await supabase
      .from('transactions')
      .select('reference_month')
      .eq('scheduled_id', scheduled.id)
      .in('reference_month', periods);

    const existingSet = new Set((existing ?? []).map(r => r.reference_month as string));

    for (const period of periods) {
      if (existingSet.has(period)) continue;
      const tx = await insertPendingTransaction(userId, scheduled, period);
      if (tx) generated.push(tx);
    }
  }

  return generated;
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
    case 'once':    return scheduled.amount;
    default:        return scheduled.amount;
  }
}
