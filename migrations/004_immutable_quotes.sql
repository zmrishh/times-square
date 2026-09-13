CREATE OR REPLACE FUNCTION protect_quote_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.account_id, NEW.brand_id, NEW.creative_id, NEW.slot_id,
         NEW.slot_version, NEW.existing, NEW.target, NEW.due, NEW.rules,
         NEW.mode, NEW.product_id, NEW.business_id, NEW.customer_email,
         NEW.expires_at, NEW.cutoff_at, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.account_id, OLD.brand_id, OLD.creative_id, OLD.slot_id,
         OLD.slot_version, OLD.existing, OLD.target, OLD.due, OLD.rules,
         OLD.mode, OLD.product_id, OLD.business_id, OLD.customer_email,
         OLD.expires_at, OLD.cutoff_at, OLD.created_at) THEN
    RAISE EXCEPTION 'Purchased quote snapshots are immutable';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS orders_snapshot_immutable ON orders;
CREATE TRIGGER orders_snapshot_immutable BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION protect_quote_snapshot();
