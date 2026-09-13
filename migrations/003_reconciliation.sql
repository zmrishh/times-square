ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_reconciled_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS last_reconciled_at timestamptz;
