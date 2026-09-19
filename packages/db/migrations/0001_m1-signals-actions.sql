CREATE TABLE `actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instrument_id` text NOT NULL,
	`signal_id` integer,
	`origin` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`signal_id`) REFERENCES `signals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `actions_signal_origin` ON `actions` (`signal_id`,`origin`);--> statement-breakpoint
CREATE INDEX `actions_status_created` ON `actions` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `actions_instrument_created` ON `actions` (`instrument_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instrument_id` text NOT NULL,
	`kind` text NOT NULL,
	`as_of` text NOT NULL,
	`severity` text NOT NULL,
	`value` real NOT NULL,
	`details_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signals_instrument_kind_as_of` ON `signals` (`instrument_id`,`kind`,`as_of`);--> statement-breakpoint
CREATE INDEX `signals_instrument_as_of` ON `signals` (`instrument_id`,`as_of`);