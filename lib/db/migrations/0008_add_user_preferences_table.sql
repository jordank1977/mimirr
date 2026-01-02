-- Migration: Add user_preferences table for storing personalized recommendation data
-- This table stores pre-calculated user preferences based on their request history
-- Preferences are time-weighted (recent requests matter more) and updated when new requests are created

CREATE TABLE `user_preferences` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `genre_weights` text NOT NULL,           -- JSON: {"Fiction": 0.85, "Fantasy": 0.72, ...}
  `author_preferences` text NOT NULL,      -- JSON: [{"name": "J.K. Rowling", "weight": 0.9}, ...]
  `top_genres` text NOT NULL,              -- JSON: ["Fiction", "Fantasy", "Science Fiction"]
  `top_authors` text NOT NULL,             -- JSON: ["J.K. Rowling", "Brandon Sanderson", ...]
  `total_requests` integer DEFAULT 0 NOT NULL,
  `last_request_date` integer,             -- Unix timestamp of most recent request
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `user_preferences_user_id_unique` ON `user_preferences` (`user_id`);
