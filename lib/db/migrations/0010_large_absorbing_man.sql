CREATE TABLE `notification_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discord_enabled` integer DEFAULT false NOT NULL,
	`discord_webhook_url` text,
	`discord_bot_username` text DEFAULT 'Mimirr',
	`discord_bot_avatar_url` text,
	`notify_request_approved` integer DEFAULT true NOT NULL,
	`notify_request_declined` integer DEFAULT true NOT NULL,
	`notify_request_available` integer DEFAULT true NOT NULL,
	`notify_request_submitted` integer DEFAULT true NOT NULL,
	`notify_bookshelf_error` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`link` text,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quality_profile_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`profile_name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`order_index` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quality_profile_configs_profile_id_unique` ON `quality_profile_configs` (`profile_id`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`genre_weights` text NOT NULL,
	`author_preferences` text NOT NULL,
	`top_genres` text NOT NULL,
	`top_authors` text NOT NULL,
	`top_moods` text NOT NULL,
	`top_paces` text NOT NULL,
	`total_requests` integer DEFAULT 0 NOT NULL,
	`last_request_date` integer,
	`recommended_popular_books` text,
	`recommended_new_books` text,
	`recommended_author_books` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_preferences_user_id_unique` ON `user_preferences` (`user_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`book_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`quality_profile_id` integer NOT NULL,
	`bookshelf_id` integer,
	`requested_at` integer DEFAULT (unixepoch()) NOT NULL,
	`processed_at` integer,
	`processed_by` integer,
	`notes` text,
	`completed_at` integer,
	`last_polled_at` integer,
	`foreign_book_id` text,
	`foreign_author_id` text,
	`monitoring_option` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_requests`("id", "user_id", "book_id", "status", "quality_profile_id", "bookshelf_id", "requested_at", "processed_at", "processed_by", "notes", "completed_at", "last_polled_at", "foreign_book_id", "foreign_author_id", "monitoring_option") SELECT "id", "user_id", "book_id", "status", "quality_profile_id", "bookshelf_id", "requested_at", "processed_at", "processed_by", "notes", "completed_at", "last_polled_at", "foreign_book_id", "foreign_author_id", "monitoring_option" FROM `requests`;--> statement-breakpoint
DROP TABLE `requests`;--> statement-breakpoint
ALTER TABLE `__new_requests` RENAME TO `requests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `book_cache` ADD `moods` text;--> statement-breakpoint
ALTER TABLE `book_cache` ADD `paces` text;