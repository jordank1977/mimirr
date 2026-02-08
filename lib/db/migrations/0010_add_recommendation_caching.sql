-- Migration: Add recommendation caching columns to user_preferences table
-- These columns store pre-generated book IDs for the three recommendation sections
-- This ensures recommendations stay stable until new requests are made

ALTER TABLE `user_preferences` ADD COLUMN `recommended_popular_books` text;
ALTER TABLE `user_preferences` ADD COLUMN `recommended_new_books` text;
ALTER TABLE `user_preferences` ADD COLUMN `recommended_author_books` text;
