CREATE TABLE status_audits (
    id UUID PRIMARY KEY,
    actor_id UUID NOT NULL REFERENCES users(id),
    resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('ACCOUNT', 'WALLET')),
    target_id UUID NOT NULL,
    previous_state VARCHAR(20) NOT NULL,
    new_state VARCHAR(20) NOT NULL,
    reason VARCHAR(500) NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ NOT NULL,
    CHECK (previous_state <> new_state),
    CHECK ((resource_type = 'ACCOUNT' AND previous_state IN ('ACTIVE', 'SUSPENDED') AND new_state IN ('ACTIVE', 'SUSPENDED'))
        OR (resource_type = 'WALLET' AND previous_state IN ('ACTIVE', 'FROZEN') AND new_state IN ('ACTIVE', 'FROZEN')))
);
CREATE INDEX status_audits_target_history ON status_audits(resource_type, target_id, created_at DESC, id DESC);
CREATE FUNCTION validate_status_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Status audits are immutable'; END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.actor_id AND role = 'ADMIN' AND status = 'ACTIVE') THEN
        RAISE EXCEPTION 'Audit actor must be an active administrator';
    END IF;
    IF NEW.resource_type = 'ACCOUNT' THEN
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.target_id AND status = NEW.new_state) THEN
            RAISE EXCEPTION 'Invalid account audit target';
        END IF;
    ELSE
        IF NOT EXISTS (SELECT 1 FROM wallets WHERE id = NEW.target_id AND status = NEW.new_state) THEN
            RAISE EXCEPTION 'Invalid wallet audit target';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER status_audits_integrity BEFORE INSERT OR UPDATE OR DELETE ON status_audits
    FOR EACH ROW EXECUTE FUNCTION validate_status_audit();
