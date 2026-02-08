-- Migration: Add quality profile configurations table
-- This stores which Bookshelf quality profiles are enabled and their display order

CREATE TABLE IF NOT EXISTS `quality_profile_configs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `profile_id` integer NOT NULL,
  `profile_name` text NOT NULL,
  `enabled` integer DEFAULT 1 NOT NULL,
  `order_index` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE UNIQUE INDEX `quality_profile_configs_profile_id_unique` ON `quality_profile_configs` (`profile_id`);
CREATE INDEX `quality_profile_configs_order_index_idx` ON `quality_profile_configs` (`order_index`);
