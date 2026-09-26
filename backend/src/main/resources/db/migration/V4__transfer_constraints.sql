-- Deposit and transfer keys have different owners: receiver versus sender.
ALTER TABLE transactions DROP CONSTRAINT transactions_deposit_key;
CREATE UNIQUE INDEX transactions_deposit_key ON transactions (receiver_wallet_id, idempotency_key)
    WHERE type = 'DEPOSIT';
CREATE UNIQUE INDEX transactions_transfer_key ON transactions (sender_wallet_id, idempotency_key)
    WHERE type = 'TRANSFER';
ALTER TABLE transactions ADD CONSTRAINT transactions_transfer_check CHECK (type <> 'TRANSFER' OR (
    sender_wallet_id IS NOT NULL AND receiver_wallet_id IS NOT NULL
    AND sender_wallet_id <> receiver_wallet_id
    AND idempotency_key IS NOT NULL AND idempotency_key ~ '^[A-Za-z0-9_-]{1,128}$'
    AND amount <= 1000000.00));
