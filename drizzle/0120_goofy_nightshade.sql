CREATE TABLE `diaspora_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`diagnosis_date` bigint NOT NULL,
	`idea_health_score` int NOT NULL,
	`gap1` varchar(512),
	`gap2` varchar(512),
	`gap3` varchar(512),
	`language` varchar(10) NOT NULL DEFAULT 'zh',
	`bu_source` varchar(64) NOT NULL DEFAULT 'diaspora',
	`idea_snippet` varchar(500),
	`created_at` bigint NOT NULL,
	CONSTRAINT `diaspora_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `legal_audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`audit_id` varchar(64) NOT NULL,
	`filename` varchar(512) NOT NULL,
	`contract_type` varchar(64) NOT NULL DEFAULT 'Other',
	`contract_title` varchar(512) NOT NULL DEFAULT '',
	`overall_health_score` int NOT NULL DEFAULT 0,
	`critical_count` int NOT NULL DEFAULT 0,
	`warning_count` int NOT NULL DEFAULT 0,
	`clear_count` int NOT NULL DEFAULT 0,
	`result_json` text NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `legal_audits_id` PRIMARY KEY(`id`),
	CONSTRAINT `legal_audits_audit_id_unique` UNIQUE(`audit_id`)
);
--> statement-breakpoint
ALTER TABLE `orchestration_units` MODIFY COLUMN `price_usd` decimal(14,8) NOT NULL DEFAULT '0.00000000';--> statement-breakpoint
ALTER TABLE `orchestration_units` MODIFY COLUMN `tiers_used` text;--> statement-breakpoint
ALTER TABLE `orchestration_units` ADD `model` varchar(128);--> statement-breakpoint
ALTER TABLE `orchestration_units` ADD `provider` varchar(64);--> statement-breakpoint
ALTER TABLE `orchestration_units` ADD `retry_number` int;--> statement-breakpoint
ALTER TABLE `orchestration_units` ADD `attempts_count` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `orchestration_units` ADD `escalation_reason` text;--> statement-breakpoint
ALTER TABLE `orchestration_units` DROP COLUMN `attempts`;