CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`address` text,
	`credentials` text,
	`balances` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`last_sync` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_connections_user` ON `connections` (`user_id`);--> statement-breakpoint
CREATE TABLE `flows` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`amount` real NOT NULL,
	PRIMARY KEY(`user_id`, `day`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`finished_at` text NOT NULL,
	`updated` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `portfolios` (
	`user_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`profile` text DEFAULT 'balanced' NOT NULL,
	`sync_lock` text,
	`lock_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`value` real NOT NULL,
	`return_index` real NOT NULL,
	`flow` real DEFAULT 0 NOT NULL,
	`recorded_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `day`)
);
