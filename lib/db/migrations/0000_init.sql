CREATE TABLE `book_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text,
	`cover_image` text,
	`description` text,
	`isbn` text,
	`isbn13` text,
	`published_date` text,
	`publisher` text,
	`page_count` integer,
	`genres` text,
	`rating` text,
	`metadata` text,
	`cached_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_accessed_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE `requests` (
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
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`category` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_by` integer,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_unique` ON `settings` (`key`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`genre_weights` text NOT NULL,
	`author_preferences` text NOT NULL,
	`top_genres` text NOT NULL,
	`top_authors` text NOT NULL,
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
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text,
	`avatar` text,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
INSERT INTO notification_settings (id) VALUES (1);
