ALTER TABLE transactions ADD COLUMN original_payment_id UUID REFERENCES transactions(id);
CREATE UNIQUE INDEX transactions_original_payment_key ON transactions(original_payment_id)
    WHERE original_payment_id IS NOT NULL;
CREATE UNIQUE INDEX transactions_refund_key ON transactions(sender_wallet_id, idempotency_key) WHERE type = 'REFUND';
ALTER TABLE transactions ADD CONSTRAINT transactions_refund_check CHECK (
    (type = 'REFUND' AND original_payment_id IS NOT NULL AND status = 'SUCCESS'
        AND sender_wallet_id IS NOT NULL AND receiver_wallet_id IS NOT NULL
        AND sender_wallet_id <> receiver_wallet_id AND idempotency_key IS NOT NULL
        AND idempotency_key ~ '^[A-Za-z0-9_-]{1,128}$' AND amount <= 1000000.00)
    OR (type <> 'REFUND' AND original_payment_id IS NULL)
);
CREATE FUNCTION validate_full_refund() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.type = 'REFUND' AND NOT EXISTS (
        SELECT 1 FROM transactions p WHERE p.id = NEW.original_payment_id
        AND p.type = 'MERCHANT_PAYMENT' AND p.status = 'SUCCESS'
        AND p.amount = NEW.amount AND p.currency = NEW.currency
        AND p.receiver_wallet_id = NEW.sender_wallet_id AND p.sender_wallet_id = NEW.receiver_wallet_id
    ) THEN
        RAISE EXCEPTION 'Refund must reverse a successful merchant payment exactly' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER transactions_full_refund BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION validate_full_refund();
