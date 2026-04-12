ALTER TABLE `deal_screenings` ADD `dealHash` varchar(64);--> statement-breakpoint
ALTER TABLE `deal_screenings` ADD `triageResult` text;--> statement-breakpoint
ALTER TABLE `deal_screenings` ADD `triageSkipped` boolean DEFAULT false NOT NULL;