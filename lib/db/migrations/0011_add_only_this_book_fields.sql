-- Migration: Add Only This Book monitoring fields
-- This migration adds the necessary columns to support tracking foreign identifiers and monitoring options

-- Add new columns to requests table
ALTER TABLE requests 
ADD COLUMN foreign_book_id TEXT;

ALTER TABLE requests 
ADD COLUMN foreign_author_id TEXT;

ALTER TABLE requests 
ADD COLUMN monitoring_option TEXT;

-- Add indexes for better query performance
CREATE INDEX idx_requests_foreign_book_id ON requests(foreign_book_id);
CREATE INDEX idx_requests_monitoring_option ON requests(monitoring_option);
