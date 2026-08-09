-- 1. Add camera_delete_limit and camera_allow_delete_photo to the settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS camera_delete_limit INTEGER DEFAULT 5;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS camera_allow_delete_photo BOOLEAN DEFAULT TRUE;

-- Update existing settings row to set default value
UPDATE settings SET camera_delete_limit = 5 WHERE id = 1 AND camera_delete_limit IS NULL;
UPDATE settings SET camera_allow_delete_photo = TRUE WHERE id = 1 AND camera_allow_delete_photo IS NULL;

-- 2. Create camera_deletions table to track deletion counts per guest
CREATE TABLE IF NOT EXISTS camera_deletions (
  id BIGSERIAL PRIMARY KEY,
  guest_id TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security on camera_deletions
ALTER TABLE camera_deletions ENABLE ROW LEVEL SECURITY;
