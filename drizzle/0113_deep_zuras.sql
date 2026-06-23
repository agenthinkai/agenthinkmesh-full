CREATE TABLE `aros_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor` varchar(128) NOT NULL,
	`action` varchar(128) NOT NULL,
	`entity_type` varchar(64) NOT NULL,
	`entity_id` varchar(64),
	`payload` text,
	`ip_address` varchar(64),
	`created_at` bigint NOT NULL,
	CONSTRAINT `aros_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aros_calibration` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` varchar(64),
	`metric` varchar(64) NOT NULL,
	`predicted_rate` decimal(5,4) NOT NULL,
	`actual_rate` decimal(5,4),
	`sample_size` int NOT NULL DEFAULT 0,
	`observed_at` bigint,
	`notes` text,
	`created_at` bigint NOT NULL,
	CONSTRAINT `aros_calibration_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aros_companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_name` varchar(255) NOT NULL,
	`sector` varchar(64) NOT NULL,
	`country` varchar(64) NOT NULL,
	`hq_city` varchar(100),
	`revenue_usd_bn` decimal(10,2),
	`employees` int,
	`ceo_name` varchar(200),
	`ceo_email` varchar(320),
	`ceo_linkedin` varchar(512),
	`opportunity_score` int NOT NULL DEFAULT 0,
	`agenthink_fit_score` int NOT NULL DEFAULT 0,
	`decision_complexity_score` int NOT NULL DEFAULT 0,
	`key_decision_domain` varchar(128),
	`active_strategic_initiative` text,
	`ai_transformation_signal` text,
	`opportunity_type` varchar(128),
	`decision_twin` text,
	`executive_dossier` text,
	`universe_rank` int,
	`run_id` varchar(64),
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `aros_companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aros_discovery_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` varchar(64) NOT NULL,
	`triggered_by` int NOT NULL,
	`status` enum('pending','running','complete','failed') NOT NULL DEFAULT 'pending',
	`sectors` text NOT NULL,
	`geographies` text NOT NULL,
	`target_count` int NOT NULL DEFAULT 100,
	`completed_count` int NOT NULL DEFAULT 0,
	`total_tokens_used` int NOT NULL DEFAULT 0,
	`total_cost_usd` decimal(10,6) NOT NULL DEFAULT '0',
	`started_at` bigint,
	`completed_at` bigint,
	`duration_ms` int,
	`error_message` text,
	`created_at` bigint NOT NULL,
	CONSTRAINT `aros_discovery_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `aros_discovery_runs_run_id_unique` UNIQUE(`run_id`)
);
--> statement-breakpoint
CREATE TABLE `aros_outreach_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_id` int NOT NULL,
	`run_id` varchar(64),
	`email_subject` varchar(512),
	`email_body` text,
	`executive_brief` text,
	`sdr_teaser` text,
	`target_name` varchar(200),
	`target_email` varchar(320),
	`target_title` varchar(200),
	`estimated_deal_size_usd` int NOT NULL DEFAULT 25000,
	`priority` enum('IMMEDIATE','HIGH','MEDIUM','LOW') NOT NULL DEFAULT 'HIGH',
	`approval_status` enum('PENDING_CEO_REVIEW','APPROVED','REJECTED','SENT','BOUNCED') NOT NULL DEFAULT 'PENDING_CEO_REVIEW',
	`approved_by` int,
	`approved_at` bigint,
	`rejection_reason` text,
	`sent_at` bigint,
	`opened_at` bigint,
	`replied_at` bigint,
	`tracking_token` varchar(64),
	`tokens_used` int NOT NULL DEFAULT 0,
	`cost_usd` decimal(10,6) NOT NULL DEFAULT '0',
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `aros_outreach_queue_id` PRIMARY KEY(`id`),
	CONSTRAINT `aros_outreach_queue_tracking_token_unique` UNIQUE(`tracking_token`)
);
--> statement-breakpoint
CREATE TABLE `aros_pipeline` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_id` int NOT NULL,
	`outreach_id` int,
	`stage` enum('RESEARCHED','OUTREACH_SENT','RESPONSE_RECEIVED','MEETING_BOOKED','MEETING_HELD','PROPOSAL_SENT','NEGOTIATION','CUSTOMER','CHURNED','DISQUALIFIED') NOT NULL DEFAULT 'RESEARCHED',
	`researched_at` bigint,
	`outreach_sent_at` bigint,
	`response_received_at` bigint,
	`meeting_booked_at` bigint,
	`meeting_held_at` bigint,
	`proposal_sent_at` bigint,
	`customer_at` bigint,
	`deal_value_usd` int NOT NULL DEFAULT 25000,
	`deal_type` enum('pilot','platform','enterprise') NOT NULL DEFAULT 'pilot',
	`meeting_calendar_link` varchar(512),
	`meeting_notes` text,
	`proposal_url` varchar(512),
	`proposal_text` text,
	`assigned_to` int,
	`notes` text,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `aros_pipeline_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aros_token_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` varchar(64),
	`company_id` int,
	`workflow` enum('company_research','decision_detection','outreach_generation','council_deliberation','proposal_generation','calibration','attribution') NOT NULL,
	`model` varchar(64) NOT NULL DEFAULT 'gpt-4o-mini',
	`input_tokens` int NOT NULL DEFAULT 0,
	`output_tokens` int NOT NULL DEFAULT 0,
	`total_tokens` int NOT NULL DEFAULT 0,
	`cost_usd` decimal(10,8) NOT NULL DEFAULT '0',
	`triggered_by` int,
	`created_at` bigint NOT NULL,
	CONSTRAINT `aros_token_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pilot_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pilot_id` int NOT NULL,
	`event_type` enum('EVALUATION_RUN','REPORT_VIEWED','REPORT_SHARED','DEMO_VIEWED','PDF_EXPORTED','LOGIN') NOT NULL,
	`deal_id` varchar(100),
	`council_mode` varchar(100),
	`metadata` text,
	`created_at` bigint NOT NULL,
	CONSTRAINT `pilot_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pilots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`demo_request_id` int,
	`org_name` varchar(300) NOT NULL,
	`contact_name` varchar(200) NOT NULL,
	`contact_email` varchar(300) NOT NULL,
	`contact_title` varchar(200),
	`pilot_slug` varchar(100) NOT NULL,
	`council_mode` varchar(100) NOT NULL DEFAULT 'infrastructure',
	`max_evaluations` int NOT NULL DEFAULT 10,
	`status` enum('INVITED','ACTIVE','COMPLETED','CONVERTED','CHURNED') NOT NULL DEFAULT 'INVITED',
	`access_token_hash` varchar(64),
	`invited_at` bigint NOT NULL,
	`activated_at` bigint,
	`completed_at` bigint,
	`converted_at` bigint,
	`expires_at` bigint,
	`notes` text,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `pilots_id` PRIMARY KEY(`id`),
	CONSTRAINT `pilots_pilot_slug_unique` UNIQUE(`pilot_slug`)
);
--> statement-breakpoint
CREATE INDEX `aros_al_actor_idx` ON `aros_audit_log` (`actor`);--> statement-breakpoint
CREATE INDEX `aros_al_action_idx` ON `aros_audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `aros_al_entity_idx` ON `aros_audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `aros_al_created_idx` ON `aros_audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `aros_cal_run_idx` ON `aros_calibration` (`run_id`);--> statement-breakpoint
CREATE INDEX `aros_cal_metric_idx` ON `aros_calibration` (`metric`);--> statement-breakpoint
CREATE INDEX `aros_co_sector_idx` ON `aros_companies` (`sector`);--> statement-breakpoint
CREATE INDEX `aros_co_country_idx` ON `aros_companies` (`country`);--> statement-breakpoint
CREATE INDEX `aros_co_score_idx` ON `aros_companies` (`opportunity_score`);--> statement-breakpoint
CREATE INDEX `aros_co_run_idx` ON `aros_companies` (`run_id`);--> statement-breakpoint
CREATE INDEX `aros_run_status_idx` ON `aros_discovery_runs` (`status`);--> statement-breakpoint
CREATE INDEX `aros_run_user_idx` ON `aros_discovery_runs` (`triggered_by`);--> statement-breakpoint
CREATE INDEX `aros_oq_company_idx` ON `aros_outreach_queue` (`company_id`);--> statement-breakpoint
CREATE INDEX `aros_oq_status_idx` ON `aros_outreach_queue` (`approval_status`);--> statement-breakpoint
CREATE INDEX `aros_oq_priority_idx` ON `aros_outreach_queue` (`priority`);--> statement-breakpoint
CREATE INDEX `aros_oq_run_idx` ON `aros_outreach_queue` (`run_id`);--> statement-breakpoint
CREATE INDEX `aros_pipeline_company_idx` ON `aros_pipeline` (`company_id`);--> statement-breakpoint
CREATE INDEX `aros_pipeline_stage_idx` ON `aros_pipeline` (`stage`);--> statement-breakpoint
CREATE INDEX `aros_pipeline_outreach_idx` ON `aros_pipeline` (`outreach_id`);--> statement-breakpoint
CREATE INDEX `aros_tl_run_idx` ON `aros_token_ledger` (`run_id`);--> statement-breakpoint
CREATE INDEX `aros_tl_workflow_idx` ON `aros_token_ledger` (`workflow`);--> statement-breakpoint
CREATE INDEX `aros_tl_company_idx` ON `aros_token_ledger` (`company_id`);--> statement-breakpoint
CREATE INDEX `aros_tl_created_idx` ON `aros_token_ledger` (`created_at`);--> statement-breakpoint
CREATE INDEX `pu_pilot_idx` ON `pilot_usage` (`pilot_id`);--> statement-breakpoint
CREATE INDEX `pu_event_idx` ON `pilot_usage` (`event_type`);--> statement-breakpoint
CREATE INDEX `pu_created_idx` ON `pilot_usage` (`created_at`);--> statement-breakpoint
CREATE INDEX `pilot_slug_idx` ON `pilots` (`pilot_slug`);--> statement-breakpoint
CREATE INDEX `pilot_status_idx` ON `pilots` (`status`);--> statement-breakpoint
CREATE INDEX `pilot_email_idx` ON `pilots` (`contact_email`);--> statement-breakpoint
CREATE INDEX `pilot_demo_idx` ON `pilots` (`demo_request_id`);