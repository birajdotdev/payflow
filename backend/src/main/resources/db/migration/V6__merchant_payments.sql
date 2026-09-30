CREATE TABLE merchants (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id),
    wallet_id UUID NOT NULL UNIQUE REFERENCES wallets(id),
    business_name VARCHAR(100) NOT NULL CHECK (length(trim(business_name)) > 0),
    contact_email VARCHAR(255) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE payment_requests (
    id UUID PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    amount DECIMAL(19, 2) NOT NULL CHECK (amount > 0 AND amount <= 1000000.00),
    currency VARCHAR(3) NOT NULL CHECK (currency = 'NPR'),
    description VARCHAR(255),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CHECK (expires_at > created_at)
);
CREATE INDEX payment_requests_merchant_created_idx ON payment_requests (merchant_id, created_at DESC, id DESC);

ALTER TABLE transactions ADD COLUMN payment_request_id UUID REFERENCES payment_requests(id);
CREATE UNIQUE INDEX transactions_payment_request_key ON transactions (payment_request_id)
    WHERE payment_request_id IS NOT NULL;
CREATE UNIQUE INDEX transactions_merchant_payment_key ON transactions (sender_wallet_id, idempotency_key)
    WHERE type = 'MERCHANT_PAYMENT';
ALTER TABLE transactions ADD CONSTRAINT transactions_merchant_payment_check CHECK (
    (type = 'MERCHANT_PAYMENT' AND payment_request_id IS NOT NULL
        AND sender_wallet_id IS NOT NULL AND receiver_wallet_id IS NOT NULL
        AND sender_wallet_id <> receiver_wallet_id AND status = 'SUCCESS'
        AND idempotency_key IS NOT NULL AND idempotency_key ~ '^[A-Za-z0-9_-]{1,128}$'
        AND amount <= 1000000.00)
    OR (type <> 'MERCHANT_PAYMENT' AND payment_request_id IS NULL)
);
