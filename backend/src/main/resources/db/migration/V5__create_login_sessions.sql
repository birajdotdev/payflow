CREATE TABLE login_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,
    absolute_expires_at TIMESTAMPTZ NOT NULL,
    idle_expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    CHECK (absolute_expires_at > created_at),
    CHECK (idle_expires_at > created_at AND idle_expires_at <= absolute_expires_at)
);
CREATE INDEX login_sessions_user_id_idx ON login_sessions(user_id);
CREATE TABLE refresh_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,
    session_id UUID NOT NULL UNIQUE REFERENCES login_sessions(id) ON DELETE CASCADE,
    CHECK (token_hash ~ '^[0-9a-f]{64}$')
);
