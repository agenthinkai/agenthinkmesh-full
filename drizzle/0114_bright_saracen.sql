CREATE TABLE `aros_funnel_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshot_date` varchar(10) NOT NULL,
	`universe_count` int NOT NULL DEFAULT 0,
	`active_count` int NOT NULL DEFAULT 0,
	`high_priority_count` int NOT NULL DEFAULT 0,
	`outreach_candidate_count` int NOT NULL DEFAULT 0,
	`outreach_sent_count` int NOT NULL DEFAULT 0,
	`response_count` int NOT NULL DEFAULT 0,
	`meeting_count` int NOT NULL DEFAULT 0,
	`proposal_count` int NOT NULL DEFAULT 0,
	`customer_count` int NOT NULL DEFAULT 0,
	`total_tokens_used` int NOT NULL DEFAULT 0,
	`total_cost_usd` decimal(10,4) NOT NULL DEFAULT '0',
	`revenue_generated_usd` int NOT NULL DEFAULT 0,
	`token_roi` decimal(12,2) NOT NULL DEFAULT '0',
	`created_at` bigint NOT NULL,
	CONSTRAINT `aros_funnel_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aros_monitoring_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_id` int NOT NULL,
	`funnel_tier` enum('UNIVERSE','ACTIVE','HIGH_PRIORITY','OUTREACH_CANDIDATE') NOT NULL DEFAULT 'UNIVERSE',
	`monitoring_frequency_days` int NOT NULL DEFAULT 30,
	`last_monitored_at` bigint,
	`next_monitor_at` bigint,
	`last_run_id` varchar(64),
	`last_signal_count` int NOT NULL DEFAULT 0,
	`consecutive_no_signal_runs` int NOT NULL DEFAULT 0,
	`status` enum('active','paused','error') NOT NULL DEFAULT 'active',
	`error_message` text,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `aros_monitoring_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `aros_monitoring_jobs_company_id_unique` UNIQUE(`company_id`)
);
--> statement-breakpoint
CREATE TABLE `aros_opportunity_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_id` int NOT NULL,
	`signal_type` enum('AI_TRANSFORMATION','MA_ACTIVITY','CAPITAL_ALLOCATION','DATA_MODERNIZATION','REGULATORY_CHANGE','LEADERSHIP_CHANGE','EARNINGS_PRESSURE','STRATEGIC_PARTNERSHIP','TECHNOLOGY_INVESTMENT','WORKFORCE_RESTRUCTURING') NOT NULL,
	`signal_title` varchar(512) NOT NULL,
	`signal_evidence` text NOT NULL,
	`source_url` varchar(1024),
	`source_date` bigint,
	`urgency_score` int NOT NULL DEFAULT 0,
	`acv_estimate_usd` int NOT NULL DEFAULT 0,
	`confidence_score` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`detected_by_run_id` varchar(64),
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `aros_opportunity_signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `aros_fs_date_idx` ON `aros_funnel_snapshots` (`snapshot_date`);--> statement-breakpoint
CREATE INDEX `aros_job_tier_idx` ON `aros_monitoring_jobs` (`funnel_tier`);--> statement-breakpoint
CREATE INDEX `aros_job_next_run_idx` ON `aros_monitoring_jobs` (`next_monitor_at`);--> statement-breakpoint
CREATE INDEX `aros_job_status_idx` ON `aros_monitoring_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `aros_signal_company_idx` ON `aros_opportunity_signals` (`company_id`);--> statement-breakpoint
CREATE INDEX `aros_signal_type_idx` ON `aros_opportunity_signals` (`signal_type`);--> statement-breakpoint
CREATE INDEX `aros_signal_urgency_idx` ON `aros_opportunity_signals` (`urgency_score`);--> statement-breakpoint
CREATE INDEX `aros_signal_active_idx` ON `aros_opportunity_signals` (`is_active`);