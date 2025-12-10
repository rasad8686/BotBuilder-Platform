-- Migration: Add language column to bots table
-- Supports 50+ languages for multi-language bot responses

-- Add language column with default 'en' (English)
ALTER TABLE bots ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';

-- Create index for faster language-based queries
CREATE INDEX IF NOT EXISTS idx_bots_language ON bots(language);

-- Comment for documentation
COMMENT ON COLUMN bots.language IS 'Bot response language code (e.g., en, tr, az, ru, ka). Use "auto" for auto-detection.';
