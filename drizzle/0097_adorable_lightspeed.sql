CREATE TABLE `council_language_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`language` varchar(64) NOT NULL,
	`email` varchar(255),
	`created_at` bigint NOT NULL,
	CONSTRAINT `council_language_signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cls_lang_idx` ON `council_language_signals` (`language`);--> statement-breakpoint
CREATE INDEX `cls_created_idx` ON `council_language_signals` (`created_at`);