CREATE TABLE `outcome_factors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`outcome_session_id` int NOT NULL,
	`factor_type` enum('FINANCIAL','TECHNICAL','CONSTRUCTION','REGULATORY','COMMERCIAL','ESG') NOT NULL,
	`factor_description` text NOT NULL,
	`was_predicted` tinyint NOT NULL DEFAULT 0,
	`predicted_by_persona` varchar(64),
	`created_at` bigint NOT NULL,
	CONSTRAINT `outcome_factors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outcome_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deal_id` varchar(64) NOT NULL,
	`council_run_id` varchar(64),
	`council_mode` varchar(32) NOT NULL,
	`original_verdict` varchar(32) NOT NULL,
	`consensus_score` decimal(5,4),
	`confidence_level` decimal(5,4),
	`decision_date` bigint NOT NULL,
	`outcome_status` enum('UNKNOWN','IN_PROGRESS','SUCCEEDED','FAILED','ABANDONED','RESTRUCTURED') NOT NULL DEFAULT 'UNKNOWN',
	`outcome_date` bigint,
	`outcome_notes` text,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `outcome_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `of_session_idx` ON `outcome_factors` (`outcome_session_id`);--> statement-breakpoint
CREATE INDEX `of_type_idx` ON `outcome_factors` (`factor_type`);--> statement-breakpoint
CREATE INDEX `of_predicted_idx` ON `outcome_factors` (`was_predicted`);--> statement-breakpoint
CREATE INDEX `os_deal_id_idx` ON `outcome_sessions` (`deal_id`);--> statement-breakpoint
CREATE INDEX `os_council_mode_idx` ON `outcome_sessions` (`council_mode`);--> statement-breakpoint
CREATE INDEX `os_status_idx` ON `outcome_sessions` (`outcome_status`);--> statement-breakpoint
CREATE INDEX `os_decision_date_idx` ON `outcome_sessions` (`decision_date`);