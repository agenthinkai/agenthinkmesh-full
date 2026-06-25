CREATE TABLE `atlas_constitution_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`constitution_version_id` int NOT NULL,
	`review_period_start` bigint NOT NULL,
	`review_period_end` bigint NOT NULL,
	`calibrated_outcome_count` int NOT NULL DEFAULT 0,
	`constitution_performance` text,
	`calibration_improvements` text,
	`hidden_variable_performance` text,
	`decision_twin_accuracy` text,
	`executive_engagement_trends` text,
	`suggested_amendments` text,
	`principles_improved` text,
	`principles_reduced` text,
	`recurring_failure_patterns` text,
	`status` enum('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
	`created_at` bigint NOT NULL,
	CONSTRAINT `atlas_constitution_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `atlas_constitution_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`version` varchar(32) NOT NULL,
	`effective_date` bigint NOT NULL,
	`description` text NOT NULL,
	`created_by` varchar(200) NOT NULL DEFAULT 'system',
	`status` enum('ACTIVE','RETIRED') NOT NULL DEFAULT 'ACTIVE',
	`checksum` varchar(64) NOT NULL,
	`executive_response_rate` decimal(5,4) DEFAULT '0',
	`meeting_rate` decimal(5,4) DEFAULT '0',
	`proposal_rate` decimal(5,4) DEFAULT '0',
	`customer_rate` decimal(5,4) DEFAULT '0',
	`decision_twin_accuracy` decimal(5,4) DEFAULT '0',
	`hidden_variable_accuracy` decimal(5,4) DEFAULT '0',
	`revenue_forecast_accuracy` decimal(5,4) DEFAULT '0',
	`outcome_ledger_accuracy` decimal(5,4) DEFAULT '0',
	`total_briefs_sent` int NOT NULL DEFAULT 0,
	`total_responses` int NOT NULL DEFAULT 0,
	`total_meetings` int NOT NULL DEFAULT 0,
	`total_proposals` int NOT NULL DEFAULT 0,
	`total_customers` int NOT NULL DEFAULT 0,
	`created_at` bigint NOT NULL,
	CONSTRAINT `atlas_constitution_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `atlas_constitution_versions_version_unique` UNIQUE(`version`)
);
--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `dt_constitution_version` varchar(32) DEFAULT '1.0';--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `dt_prompt_version` varchar(32) DEFAULT '1.0';--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `dt_hidden_variable_version` varchar(32) DEFAULT '1.0';--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `dt_calibration_snapshot` varchar(64);--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `dt_evidence_manifest_hash` varchar(64);--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `dt_generated_at` bigint;--> statement-breakpoint
ALTER TABLE `aros_outreach_queue` ADD `constitution_version` varchar(32) DEFAULT '1.0';--> statement-breakpoint
ALTER TABLE `aros_outreach_queue` ADD `decision_twin_version` varchar(32) DEFAULT '1.0';--> statement-breakpoint
ALTER TABLE `aros_outreach_queue` ADD `hidden_variable_engine_version` varchar(32) DEFAULT '1.0';--> statement-breakpoint
ALTER TABLE `aros_outreach_queue` ADD `calibration_engine_version` varchar(32) DEFAULT '1.0';--> statement-breakpoint
ALTER TABLE `aros_outreach_queue` ADD `llm_model_version` varchar(128);--> statement-breakpoint
ALTER TABLE `aros_outreach_queue` ADD `generation_timestamp` bigint;--> statement-breakpoint
CREATE INDEX `acr_version_idx` ON `atlas_constitution_reviews` (`constitution_version_id`);--> statement-breakpoint
CREATE INDEX `acr_created_idx` ON `atlas_constitution_reviews` (`created_at`);--> statement-breakpoint
CREATE INDEX `acv_status_idx` ON `atlas_constitution_versions` (`status`);--> statement-breakpoint
CREATE INDEX `acv_version_idx` ON `atlas_constitution_versions` (`version`);