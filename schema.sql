-- Suggested migration for an existing users table.
-- Adjust table/constraint names to match the production database.

ALTER TABLE users
  ADD COLUMN first_name VARCHAR(120),
  ADD COLUMN last_name VARCHAR(120),
  ADD COLUMN phone VARCHAR(30),
  ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
SET
  first_name = COALESCE(first_name, ''),
  last_name = COALESCE(last_name, ''),
  phone = COALESCE(phone, '');

-- After backfilling real values, make these required:
-- ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;
-- ALTER TABLE users ALTER COLUMN last_name SET NOT NULL;
-- ALTER TABLE users ALTER COLUMN phone SET NOT NULL;

CREATE TABLE phone_otps (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR(30) NOT NULL,
  code_hash VARCHAR(128) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
