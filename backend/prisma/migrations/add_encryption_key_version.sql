-- Migration: Add encryption_key_version to users table
-- Purpose: Support encryption key rotation without data loss

BEGIN;

-- Add encryption_key_version column with default value 1
ALTER TABLE users 
ADD COLUMN encryption_key_version INTEGER NOT NULL DEFAULT 1;

-- Create index for efficient querying by key version
CREATE INDEX idx_users_encryption_key_version 
ON users(encryption_key_version);

-- Add comment explaining the field
COMMENT ON COLUMN users.encryption_key_version IS 
'Version of the encryption key used to encrypt sensitive fields (tin, nin, etc). Incremented during key rotation.';

COMMIT;
