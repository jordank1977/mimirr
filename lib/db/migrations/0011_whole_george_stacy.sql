CREATE TABLE `library_books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`foreign_book_id` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_books_foreign_book_id_unique` ON `library_books` (`foreign_book_id`);