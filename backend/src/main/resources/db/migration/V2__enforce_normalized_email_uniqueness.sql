-- Keep email identity case-insensitive, including writes outside registration.
CREATE UNIQUE INDEX users_email_normalized_key ON users (LOWER(BTRIM(email)));
