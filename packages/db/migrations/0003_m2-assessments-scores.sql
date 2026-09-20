CREATE TABLE `assessments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` integer NOT NULL,
	`instrument_id` text NOT NULL,
	`relevance` text NOT NULL,
	`sentiment` integer NOT NULL,
	`impact` integer NOT NULL,
	`direction` text,
	`summary` text NOT NULL,
	`rationale` text NOT NULL,
	`author` text NOT NULL,
	`model` text,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assessments_subject_author` ON `assessments` (`subject_type`,`subject_id`,`author`);--> statement-breakpoint
CREATE INDEX `assessments_instrument_created` ON `assessments` (`instrument_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `scores` (
	`instrument_id` text NOT NULL,
	`as_of` text NOT NULL,
	`score` real NOT NULL,
	`components_json` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`instrument_id`, `as_of`),
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
