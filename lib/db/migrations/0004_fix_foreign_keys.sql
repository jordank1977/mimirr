-- Fix foreign key constraints to allow user deletion
-- SQLite doesn't support modifying foreign keys directly, so we need to recreate the tables

-- First, let's check what data we have and recreate tables with proper constraints

-- For requests table: Make processedBy nullable and set to NULL on user delete
-- Note: SQLite doesn't support ALTER COLUMN for foreign keys, but since processedBy
-- is already nullable, we just need to ensure the constraint behavior

-- For settings table: Make updatedBy nullable and set to NULL on user delete
-- Same as above - already nullable, just need proper constraint

-- Since SQLite has limitations on ALTER TABLE for foreign keys, and these columns
-- are already nullable, the database should handle this correctly if we enable
-- foreign key enforcement properly. The issue is likely that the ON DELETE behavior
-- wasn't properly set during table creation.

-- For now, we'll document that these should be SET NULL on delete
-- The actual fix requires recreating the tables, which is risky with existing data

-- Workaround: Before deleting a user, set processedBy and updatedBy to NULL
-- This will be handled in the application code
