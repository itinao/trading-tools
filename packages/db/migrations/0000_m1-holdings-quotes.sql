CREATE TABLE `holding_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`as_of` text NOT NULL,
	`file_name` text NOT NULL,
	`imported_at` text NOT NULL,
	`row_count` integer NOT NULL,
	`skipped_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `holding_snapshots_source_as_of` ON `holding_snapshots` (`source`,`as_of`);--> statement-breakpoint
CREATE TABLE `holdings` (
	`snapshot_id` integer NOT NULL,
	`instrument_id` text NOT NULL,
	`account` text NOT NULL,
	`quantity` integer NOT NULL,
	`average_cost` real NOT NULL,
	`price_at_snapshot` real NOT NULL,
	`market_value` integer NOT NULL,
	`unrealized_pnl` integer NOT NULL,
	`unrealized_pnl_pct` real NOT NULL,
	PRIMARY KEY(`snapshot_id`, `instrument_id`, `account`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `holding_snapshots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `instruments` (
	`id` text PRIMARY KEY NOT NULL,
	`market` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instrument_id` text NOT NULL,
	`as_of` text NOT NULL,
	`price` real NOT NULL,
	`previous_close` real,
	`source` text NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_instrument_as_of_source` ON `quotes` (`instrument_id`,`as_of`,`source`);--> statement-breakpoint
CREATE INDEX `quotes_instrument_as_of` ON `quotes` (`instrument_id`,`as_of`);