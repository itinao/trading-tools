CREATE TABLE `disclosures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instrument_id` text NOT NULL,
	`disclosed_at` text NOT NULL,
	`title` text NOT NULL,
	`pdf_url` text NOT NULL,
	`category` text NOT NULL,
	`has_xbrl` integer NOT NULL,
	`source` text NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `disclosures_instrument_pdf` ON `disclosures` (`instrument_id`,`pdf_url`);--> statement-breakpoint
CREATE INDEX `disclosures_instrument_disclosed` ON `disclosures` (`instrument_id`,`disclosed_at`);--> statement-breakpoint
CREATE TABLE `financials` (
	`instrument_id` text NOT NULL,
	`period_type` text NOT NULL,
	`period_end` text NOT NULL,
	`source` text NOT NULL,
	`revenue` real,
	`operating_income` real,
	`net_income` real,
	`total_assets` real,
	`equity` real,
	`operating_cash_flow` real,
	`eps` real,
	`fetched_at` text NOT NULL,
	PRIMARY KEY(`instrument_id`, `period_type`, `period_end`, `source`),
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fundamentals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instrument_id` text NOT NULL,
	`as_of` text NOT NULL,
	`per` real,
	`forward_per` real,
	`pbr` real,
	`dividend_yield` real,
	`market_cap` real,
	`roe` real,
	`operating_margin` real,
	`revenue_growth` real,
	`debt_to_equity` real,
	`next_earnings_date` text,
	`source` text NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fundamentals_instrument_as_of_source` ON `fundamentals` (`instrument_id`,`as_of`,`source`);--> statement-breakpoint
CREATE TABLE `news_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instrument_id` text NOT NULL,
	`published_at` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`publisher` text,
	`source` text NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `news_items_instrument_url` ON `news_items` (`instrument_id`,`url`);--> statement-breakpoint
CREATE INDEX `news_items_instrument_published` ON `news_items` (`instrument_id`,`published_at`);