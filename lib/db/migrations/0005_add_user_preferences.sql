-- Add user preferences to users table
ALTER TABLE users ADD COLUMN hide_getting_started INTEGER DEFAULT 0;
