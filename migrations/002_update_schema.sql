-- Add missing columns to bots table
ALTER TABLE bots ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS platform VARCHAR(50);
ALTER TABLE bots ADD COLUMN IF NOT EXISTS api_token TEXT;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Drop old columns
ALTER TABLE bots DROP COLUMN IF EXISTS token;
ALTER TABLE bots DROP COLUMN IF EXISTS status;

-- Add foreign key constraint
ALTER TABLE bots DROP CONSTRAINT IF EXISTS bots_user_id_fkey;
ALTER TABLE bots ADD CONSTRAINT bots_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create bot_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS bot_messages (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  message_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  trigger_keywords TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_bot_id ON bot_messages(bot_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Add updated_at column to users if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
