CREATE TABLE `aros_accuracy_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshot_date` varchar(10) NOT NULL,
	`response_rate_predicted` decimal(5,4),
	`response_rate_actual` decimal(5,4),
	`meeting_rate_predicted` decimal(5,4),
	`meeting_rate_actual` decimal(5,4),
	`proposal_rate_predicted` decimal(5,4),
	`proposal_rate_actual` decimal(5,4),
	`customer_rate_predicted` decimal(5,4),
	`customer_rate_actual` decimal(5,4),
	`dt_accuracy_avg` decimal(5,4),
	`dt_sample_size` int NOT NULL DEFAULT 0,
	`hv_accuracy_avg` decimal(5,4),
	`hv_sample_size` int NOT NULL DEFAULT 0,
	`revenue_forecasted_total` int NOT NULL DEFAULT 0,
	`revenue_actual_total` int NOT NULL DEFAULT 0,
	`revenue_forecast_accuracy` decimal(5,4),
	`total_companies` int NOT NULL DEFAULT 0,
	`total_outcome_ledger_entries` int NOT NULL DEFAULT 0,
	`total_calibration_records` int NOT NULL DEFAULT 0,
	`created_at` bigint NOT NULL,
	CONSTRAINT `aros_accuracy_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aros_decision_twins_v2` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_id` int NOT NULL,
	`primary_objective` varchar(300) NOT NULL,
	`secondary_objective` varchar(300),
	`strategic_decision` varchar(400) NOT NULL,
	`hidden_variable` varchar(300) NOT NULL,
	`hidden_variable_confidence` decimal(5,4) NOT NULL DEFAULT '0',
	`monitoring_signals` text,
	`estimated_decision_timeline` varchar(100),
	`estimated_acv_usd` int NOT NULL DEFAULT 0,
	`urgency_score` int NOT NULL DEFAULT 0,
	`recommended_engagement_path` varchar(500),
	`prediction_accuracy` decimal(5,4),
	`last_validated_at` bigint,
	`validation_notes` text,
	`version` int NOT NULL DEFAULT 2,
	`generated_by` varchar(50) NOT NULL DEFAULT 'atlas_phase5',
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `aros_decision_twins_v2_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aros_hidden_variables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_id` int NOT NULL,
	`decision_twin_v2_id` int,
	`hidden_variable` varchar(300) NOT NULL,
	`hidden_variable_type` enum('REGULATORY_DELAY','AI_GOVERNANCE_FAILURE','CAPITAL_ALLOCATION_ERROR','DATA_SOVEREIGNTY_CONSTRAINT','COMPETITIVE_RESPONSE','INFRASTRUCTURE_BOTTLENECK','TALENT_SHORTAGE','EXECUTION_RISK','MARKET_TIMING','OTHER') NOT NULL DEFAULT 'OTHER',
	`confidence` decimal(5,4) NOT NULL DEFAULT '0.5',
	`monitoring_signal` varchar(400),
	`review_date` bigint,
	`actual_outcome` text,
	`prediction_correct` boolean,
	`validated_at` bigint,
	`accuracy_delta` decimal(5,4),
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `aros_hidden_variables_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aros_monitoring_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_id` int NOT NULL,
	`event_type` enum('MA_ACTIVITY','AI_INITIATIVE','DATA_CENTER_INVESTMENT','DIGITAL_TRANSFORMATION','INFRASTRUCTURE_PROJECT','REGULATORY_CHANGE','CAPITAL_ALLOCATION','LEADERSHIP_CHANGE','EARNINGS_SIGNAL','PARTNERSHIP','OTHER') NOT NULL DEFAULT 'OTHER',
	`event_title` varchar(300) NOT NULL,
	`event_summary` text,
	`source_url` varchar(500),
	`detected_at` bigint NOT NULL,
	`opportunity_score_delta` int NOT NULL DEFAULT 0,
	`urgency_score_delta` int NOT NULL DEFAULT 0,
	`acv_delta` int NOT NULL DEFAULT 0,
	`processed` boolean NOT NULL DEFAULT false,
	`processed_at` bigint,
	`dt_updated` boolean NOT NULL DEFAULT false,
	`ol_updated` boolean NOT NULL DEFAULT false,
	`created_at` bigint NOT NULL,
	CONSTRAINT `aros_monitoring_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aros_outcome_ledger_v2` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_id` int NOT NULL,
	`decision_twin_v2_id` int,
	`hidden_variable_id` int,
	`hidden_variable` varchar(300),
	`hidden_variable_confidence` decimal(5,4),
	`assumptions` text,
	`monitoring_signals` text,
	`calibration_baseline` text,
	`review_date` bigint,
	`opportunity_score_at_t0` int NOT NULL DEFAULT 0,
	`acv_at_t0` int NOT NULL DEFAULT 0,
	`urgency_at_t0` int NOT NULL DEFAULT 0,
	`outcome_status` enum('PENDING','RESPONSE_RECEIVED','MEETING_HELD','PROPOSAL_SENT','CUSTOMER_WON','CUSTOMER_LOST','NO_ENGAGEMENT') NOT NULL DEFAULT 'PENDING',
	`outcome_notes` text,
	`outcome_date` bigint,
	`dt_accuracy` decimal(5,4),
	`hv_accuracy` decimal(5,4),
	`revenue_forecasted` int NOT NULL DEFAULT 0,
	`revenue_actual` int NOT NULL DEFAULT 0,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `aros_outcome_ledger_v2_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `aros_as_date_idx` ON `aros_accuracy_snapshots` (`snapshot_date`);--> statement-breakpoint
CREATE INDEX `aros_dt_v2_company_idx` ON `aros_decision_twins_v2` (`company_id`);--> statement-breakpoint
CREATE INDEX `aros_dt_v2_urgency_idx` ON `aros_decision_twins_v2` (`urgency_score`);--> statement-breakpoint
CREATE INDEX `aros_hv_company_idx` ON `aros_hidden_variables` (`company_id`);--> statement-breakpoint
CREATE INDEX `aros_hv_type_idx` ON `aros_hidden_variables` (`hidden_variable_type`);--> statement-breakpoint
CREATE INDEX `aros_hv_review_idx` ON `aros_hidden_variables` (`review_date`);--> statement-breakpoint
CREATE INDEX `aros_me_company_idx` ON `aros_monitoring_events` (`company_id`);--> statement-breakpoint
CREATE INDEX `aros_me_type_idx` ON `aros_monitoring_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `aros_me_detected_idx` ON `aros_monitoring_events` (`detected_at`);--> statement-breakpoint
CREATE INDEX `aros_me_processed_idx` ON `aros_monitoring_events` (`processed`);--> statement-breakpoint
CREATE INDEX `aros_ol_v2_company_idx` ON `aros_outcome_ledger_v2` (`company_id`);--> statement-breakpoint
CREATE INDEX `aros_ol_v2_status_idx` ON `aros_outcome_ledger_v2` (`outcome_status`);--> statement-breakpoint
CREATE INDEX `aros_ol_v2_review_idx` ON `aros_outcome_ledger_v2` (`review_date`);