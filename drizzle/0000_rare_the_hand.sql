CREATE TABLE `catalog_artists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`image_url` text,
	`spotify_url` text,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `catalog_artists_name` ON `catalog_artists` (`name`);--> statement-breakpoint
CREATE TABLE `catalog_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`album_name` text,
	`image_url` text,
	`primary_artist_id` text,
	`primary_artist_name` text,
	`spotify_url` text,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	`received` integer NOT NULL,
	`inserted` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `plays` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`played_at` integer NOT NULL,
	`ms_played` integer,
	`track_name` text NOT NULL,
	`artist_name` text NOT NULL,
	`album_name` text,
	`track_id` text,
	`artist_id` text,
	`source` text NOT NULL,
	`reason_start` text,
	`reason_end` text,
	`shuffle` integer,
	`skipped` integer,
	`offline` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plays_dedupe` ON `plays` (`user_id`,`source`,`played_at`,`track_name`,`artist_name`);--> statement-breakpoint
CREATE INDEX `plays_user_time` ON `plays` (`user_id`,`played_at`);--> statement-breakpoint
CREATE INDEX `plays_user_artist` ON `plays` (`user_id`,`artist_name`);--> statement-breakpoint
CREATE TABLE `top_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`taken_on` text NOT NULL,
	`time_range` text NOT NULL,
	`kind` text NOT NULL,
	`rank` integer NOT NULL,
	`item_id` text NOT NULL,
	`name` text NOT NULL,
	`subtitle` text,
	`image_url` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `snapshots_unique` ON `top_snapshots` (`user_id`,`taken_on`,`time_range`,`kind`,`rank`);--> statement-breakpoint
CREATE INDEX `snapshots_lookup` ON `top_snapshots` (`user_id`,`kind`,`time_range`,`taken_on`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`last_play_sync_at` integer,
	`last_snapshot_on` text
);
