CREATE TABLE IF NOT EXISTS refund_attributions (
  payment_id text PRIMARY KEY REFERENCES payments(id),
  refunded_cash integer NOT NULL CHECK (refunded_cash>0),
  refunded_principal integer NOT NULL CHECK (refunded_principal>=0 AND refunded_principal<=refunded_cash),
  evidence_reference text NOT NULL,
  actor text NOT NULL REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE refund_attributions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON refund_attributions FROM PUBLIC;
