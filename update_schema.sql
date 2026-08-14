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

-- 3. Create guest_voices table to store voice recordings of guests
CREATE TABLE IF NOT EXISTS guest_voices (
  id BIGSERIAL PRIMARY KEY,
  guest_id TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security on guest_voices
ALTER TABLE guest_voices ENABLE ROW LEVEL SECURITY;

-- 4. Add guest_id column to wishes table to separate duplicate names
ALTER TABLE wishes ADD COLUMN IF NOT EXISTS guest_id TEXT;

-- 5. Add is_visible column to guest_voices table for voice-only wishes moderation
ALTER TABLE guest_voices ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE;
