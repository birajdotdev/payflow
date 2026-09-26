CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    reference VARCHAR(44) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('DEPOSIT', 'TRANSFER', 'MERCHANT_PAYMENT', 'REFUND')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
    sender_wallet_id UUID REFERENCES wallets(id),
    receiver_wallet_id UUID REFERENCES wallets(id),
    amount DECIMAL(19, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL CHECK (currency = 'NPR'),
    description VARCHAR(255),
    idempotency_key VARCHAR(128),
    balance_after DECIMAL(19, 2) CHECK (balance_after >= 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT transactions_wallet_check CHECK (sender_wallet_id IS NOT NULL OR receiver_wallet_id IS NOT NULL),
    CONSTRAINT transactions_deposit_check CHECK (type <> 'DEPOSIT' OR (
        sender_wallet_id IS NULL AND receiver_wallet_id IS NOT NULL
        AND idempotency_key IS NOT NULL AND idempotency_key ~ '^[A-Za-z0-9_-]{1,128}$'
        AND balance_after IS NOT NULL AND amount <= 100000.00 AND balance_after <= 1000000.00)),
    CONSTRAINT transactions_deposit_key UNIQUE (receiver_wallet_id, type, idempotency_key)
);

CREATE INDEX transactions_sender_created_idx ON transactions (sender_wallet_id, created_at DESC);
CREATE INDEX transactions_receiver_created_idx ON transactions (receiver_wallet_id, created_at DESC);
