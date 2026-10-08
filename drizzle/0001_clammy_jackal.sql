CREATE TABLE `nft_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`brand_id` text,
	`credentials` text,
	`expires_at` integer DEFAULT 0 NOT NULL,
	`retry_after` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `snapshots` ADD `valuation_basis` text DEFAULT 'coins-v1' NOT NULL;