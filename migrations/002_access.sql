-- Browser-facing Supabase REST access is denied. All data access goes through
-- authenticated Next.js handlers; ownership/role checks occur there.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['settings','accounts','sessions','challenges','drafts','assets','brands','creatives','slots','totals','orders','payments','allocations','history','webhook_events','refunds','disputes','jobs','audit','analytics','rate_limits','reports'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon',t);
    END IF;
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated',t);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit entries are immutable'; END $$;
DROP TRIGGER IF EXISTS immutable_audit ON audit;
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE OR REPLACE FUNCTION reject_creative_data_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.data IS DISTINCT FROM NEW.data OR OLD.brand_id IS DISTINCT FROM NEW.brand_id THEN
   RAISE EXCEPTION 'Creative data is immutable; submit a new version';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS immutable_creative ON creatives;
CREATE TRIGGER immutable_creative BEFORE UPDATE ON creatives FOR EACH ROW EXECUTE FUNCTION reject_creative_data_mutation();
