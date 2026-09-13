-- Additive and repeatable: retain every order, payment and original quote.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS failure_code text;
