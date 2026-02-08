-- Add polling tracking fields to requests table
ALTER TABLE requests ADD COLUMN completed_at INTEGER;
ALTER TABLE requests ADD COLUMN last_polled_at INTEGER;
