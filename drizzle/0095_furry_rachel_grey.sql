CREATE TABLE `deal_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source_type` enum('seeded_test','manual','pattern_match','public_signal') NOT NULL,
	`raw_input` text NOT NULL,
	`company_name` varchar(255) NOT NULL,
	`sector` varchar(100),
	`region` varchar(100),
	`source_label` varchar(100),
	`triage_score` decimal(5,2),
	`triage_reasoning` text,
	`full_eval_id` int,
	`status` enum('sourced','triaged','promoted','screened','ignored') NOT NULL DEFAULT 'sourced',
	`created_at` bigint NOT NULL,
	CONSTRAINT `deal_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `dfl_status_idx` ON `deal_sources` (`status`);--> statement-breakpoint
CREATE INDEX `dfl_sector_idx` ON `deal_sources` (`sector`);--> statement-breakpoint
CREATE INDEX `dfl_source_idx` ON `deal_sources` (`source_type`);--> statement-breakpoint
CREATE INDEX `dfl_created_idx` ON `deal_sources` (`created_at`);