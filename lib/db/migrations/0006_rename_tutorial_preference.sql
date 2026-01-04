-- Rename hide_getting_started to hide_tutorials for generic tutorial hiding
-- SQLite doesn't support RENAME COLUMN directly in older versions, so we'll add a new column
-- and migrate the data

-- Add new column
ALTER TABLE users ADD COLUMN hide_tutorials INTEGER DEFAULT 0;

-- Copy data from old column to new column
UPDATE users SET hide_tutorials = hide_getting_started;
