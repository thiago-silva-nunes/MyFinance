-- ============================================================================
-- schema_v9_balance_adjustment.sql
-- Adds is_balance_adjustment column to transactions.
-- Idempotent: safe to run multiple times.
-- Run this in Supabase SQL Editor AFTER schema.sql.
-- ============================================================================

-- 1. Add column (if not already present)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS is_balance_adjustment BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Back-fill: mark existing transactions created via the balance-adjustment
--    feature. Those were created with the auto-generated category named "Ajustes"
--    belonging to the current user. We identify them by joining on that category name.
UPDATE transactions t
SET    is_balance_adjustment = TRUE
FROM   categories c
WHERE  t.category_id = c.id
  AND  c.name = 'Ajustes'
  AND  t.is_balance_adjustment = FALSE;

-- Report how many rows were updated (visible in the SQL Editor output)
SELECT COUNT(*) AS adjusted_rows_updated
FROM   transactions
WHERE  is_balance_adjustment = TRUE;
