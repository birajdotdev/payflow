#!/usr/bin/env bash
set -euo pipefail
if [[ $# != 1 || -z "$1" ]]; then
  echo 'Usage: scripts/provision-demo-admin.sh existing-active-user@example.com' >&2
  exit 2
fi
# Operator-only access to the local PostgreSQL container; no public HTTP endpoint,
# default account/password, or application startup elevation.
docker exec -i "${PAYFLOW_POSTGRES_CONTAINER:-payflow-postgres}" sh -c \
  'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v "email=$1"' sh "$1" <<'SQL'
BEGIN;
SELECT pg_advisory_xact_lock(72419001);
CREATE FUNCTION pg_temp.provision_admin(target_email text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE target users%ROWTYPE;
BEGIN
    SELECT * INTO target FROM users WHERE lower(trim(email)) = lower(trim(target_email));
    IF target.id IS NULL THEN RAISE EXCEPTION 'Register the account first'; END IF;
    PERFORM 1 FROM wallets WHERE user_id = target.id FOR UPDATE;
    SELECT * INTO target FROM users WHERE id = target.id FOR UPDATE;
    IF target.status <> 'ACTIVE' OR target.role NOT IN ('USER', 'ADMIN') THEN
        RAISE EXCEPTION 'Only an active USER or existing ADMIN can be provisioned';
    END IF;
    IF target.role = 'ADMIN' THEN RETURN 'Already ADMIN; no change'; END IF;
    UPDATE users SET role = 'ADMIN', updated_at = CURRENT_TIMESTAMP WHERE id = target.id;
    UPDATE login_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = target.id AND revoked_at IS NULL;
    RETURN 'ADMIN provisioned; sign in again';
END;
$$;
SELECT pg_temp.provision_admin(:'email');
COMMIT;
SQL
