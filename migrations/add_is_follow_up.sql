-- Add is_follow_up column to contact_history table
ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS is_follow_up BOOLEAN DEFAULT FALSE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_contact_history_is_follow_up ON contact_history(is_follow_up) WHERE is_follow_up = TRUE;
