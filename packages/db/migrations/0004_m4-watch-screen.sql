CREATE TABLE `screen_results` (
	`run_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`segment` text NOT NULL,
	`sector33` text,
	`price` real,
	`per` real,
	`forward_per` real,
	`pbr` real,
	`dividend_yield` real,
	`market_cap` real,
	`growth_years` integer,
	`rank` integer NOT NULL,
	PRIMARY KEY(`run_id`, `code`),
	FOREIGN KEY (`run_id`) REFERENCES `screen_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `screen_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`executed_at` text NOT NULL,
	`preset` text,
	`criteria_json` text NOT NULL,
	`universe_size` integer NOT NULL,
	`matched` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `universe` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`segment` text NOT NULL,
	`segment_raw` text NOT NULL,
	`sector33` text,
	`size` text,
	`listed_as_of` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `watches` (
	`instrument_id` text PRIMARY KEY NOT NULL,
	`added_at` text NOT NULL,
	`note` text,
	`source` text NOT NULL,
	`screen_run_id` integer,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
