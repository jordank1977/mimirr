-- Add quality_profile_id column to requests table
ALTER TABLE requests ADD COLUMN quality_profile_id INTEGER NOT NULL DEFAULT 1;

-- Drop the old type column
ALTER TABLE requests DROP COLUMN type;
