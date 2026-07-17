-- ============================================================
-- schema_v6_transfers.sql
-- Tabela de transferências entre contas bancárias
-- Idempotente: pode ser rodado múltiplas vezes sem erros
-- Pré-requisito: schema_v4_banks.sql (tabela banks)
-- ============================================================

-- Criar tabela (idempotente via IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS transfers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_bank_id uuid NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  to_bank_id   uuid NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  amount       numeric(15, 2) NOT NULL CHECK (amount > 0),
  date         date NOT NULL,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transfers_different_banks CHECK (from_bank_id <> to_bank_id)
);

-- Habilitar RLS
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (idempotente: drop + create)
DROP POLICY IF EXISTS "Users can view own transfers"   ON transfers;
DROP POLICY IF EXISTS "Users can insert own transfers" ON transfers;
DROP POLICY IF EXISTS "Users can update own transfers" ON transfers;
DROP POLICY IF EXISTS "Users can delete own transfers" ON transfers;

CREATE POLICY "Users can view own transfers"
  ON transfers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transfers"
  ON transfers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transfers"
  ON transfers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transfers"
  ON transfers FOR DELETE
  USING (auth.uid() = user_id);

-- Índices de performance (idempotente)
CREATE INDEX IF NOT EXISTS idx_transfers_user_id      ON transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_bank_id ON transfers(from_bank_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_bank_id   ON transfers(to_bank_id);
CREATE INDEX IF NOT EXISTS idx_transfers_date         ON transfers(date DESC);

-- Recarregar schema do PostgREST para reconhecer a nova tabela imediatamente
NOTIFY pgrst, 'reload schema';
