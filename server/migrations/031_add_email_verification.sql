-- Migration: Add email verification token expiration
-- This adds the expiration timestamp for email verification tokens

-- Add verification_token_expires_at column if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token) WHERE verification_token IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN users.verification_token IS 'Token for email verification, valid for 24 hours';
COMMENT ON COLUMN users.verification_token_expires_at IS 'Expiration timestamp for email verification token';
