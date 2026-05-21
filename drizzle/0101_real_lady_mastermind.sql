CREATE TABLE `infra_sim_cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`asset_class` varchar(64) NOT NULL,
	`geography` varchar(64),
	`total_capex_gbp_m` decimal(12,2),
	`base_irr_pct` decimal(6,3),
	`fund_min_irr_pct` decimal(6,3),
	`ic_memo_text` longtext,
	`base_assumptions_json` text,
	`ic_decision` enum('APPROVE','CONDITIONAL','REJECT','PENDING') NOT NULL DEFAULT 'PENDING',
	`ic_vote_json` text,
	`status` enum('draft','running','complete','error') NOT NULL DEFAULT 'draft',
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `infra_sim_cases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `infra_sim_council_rounds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` int NOT NULL,
	`round_number` int NOT NULL,
	`round_type` varchar(32) NOT NULL,
	`votes_json` text NOT NULL,
	`arguments_json` longtext,
	`vote_migrations_json` text,
	`confidence_shifts_json` text,
	`created_at` bigint NOT NULL,
	CONSTRAINT `infra_sim_council_rounds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `infra_sim_council_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_id` int NOT NULL,
	`run_id` int,
	`user_id` int NOT NULL,
	`persona_set_key` varchar(64) NOT NULL DEFAULT 'infrastructure_global',
	`final_decision` enum('APPROVE','CONDITIONAL','REJECT','DEADLOCK'),
	`final_vote_json` text,
	`consensus_score` decimal(5,2),
	`debate_transcript_json` longtext,
	`persuasion_graph_json` text,
	`coalition_map_json` text,
	`minority_report_json` text,
	`unresolved_disagreements_json` text,
	`status` enum('running','complete','error') NOT NULL DEFAULT 'running',
	`created_at` bigint NOT NULL,
	`completed_at` bigint,
	CONSTRAINT `infra_sim_council_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `infra_sim_dimensions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_id` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`key` varchar(64) NOT NULL,
	`category` varchar(64),
	`values_json` text NOT NULL,
	`interaction_penalties_json` text,
	`governance_threshold` decimal(6,3),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` bigint NOT NULL,
	CONSTRAINT `infra_sim_dimensions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `infra_sim_monitoring_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`monitoring_object_id` int NOT NULL,
	`case_id` int NOT NULL,
	`event_type` varchar(64) NOT NULL,
	`event_title` varchar(255) NOT NULL,
	`event_description` text,
	`impacted_dimensions` varchar(512),
	`irr_impact_delta_pct` decimal(6,3),
	`thesis_impact` enum('POSITIVE','NEUTRAL','NEGATIVE','CRITICAL') NOT NULL DEFAULT 'NEUTRAL',
	`source_url` varchar(512),
	`processed_at` bigint,
	`created_at` bigint NOT NULL,
	CONSTRAINT `infra_sim_monitoring_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `infra_sim_monitoring_objects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_id` int NOT NULL,
	`user_id` int NOT NULL,
	`thesis_status` enum('GREEN','YELLOW','ORANGE','RED') NOT NULL DEFAULT 'GREEN',
	`approval_probability_pct` decimal(5,2),
	`decision_drift_score` decimal(5,2),
	`thesis_degradation_pct` decimal(5,2),
	`last_recomputed_at` bigint,
	`weekly_memo_json` text,
	`assumption_drift_json` text,
	`would_approve_today` tinyint DEFAULT 0,
	`alerts_json` text,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `infra_sim_monitoring_objects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `infra_sim_portfolio_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`source_case_id` int NOT NULL,
	`target_case_id` int NOT NULL,
	`dependency_type` varchar(64) NOT NULL,
	`dependency_strength` decimal(4,2) NOT NULL DEFAULT '1.00',
	`contagion_directional` tinyint NOT NULL DEFAULT 0,
	`notes` varchar(512),
	`created_at` bigint NOT NULL,
	CONSTRAINT `infra_sim_portfolio_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `infra_sim_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_id` int NOT NULL,
	`user_id` int NOT NULL,
	`target_count` int NOT NULL DEFAULT 10000,
	`completed_count` int NOT NULL DEFAULT 0,
	`approve_count` int NOT NULL DEFAULT 0,
	`conditional_count` int NOT NULL DEFAULT 0,
	`reject_count` int NOT NULL DEFAULT 0,
	`median_irr_pct` decimal(6,3),
	`p10_irr_pct` decimal(6,3),
	`p90_irr_pct` decimal(6,3),
	`top_failure_drivers_json` text,
	`approval_pathway_json` text,
	`sensitivity_json` text,
	`charts_json` text,
	`reproducibility_manifest_json` text,
	`governance_audit_json` text,
	`status` enum('queued','running','complete','error') NOT NULL DEFAULT 'queued',
	`error_message` varchar(512),
	`started_at` bigint,
	`completed_at` bigint,
	`created_at` bigint NOT NULL,
	CONSTRAINT `infra_sim_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `infra_sim_scenarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`scenario_index` int NOT NULL,
	`parameters_json` text NOT NULL,
	`irr_pct` decimal(6,3) NOT NULL,
	`decision` enum('APPROVE','CONDITIONAL','REJECT') NOT NULL,
	`blocker_score` decimal(6,3),
	`dominant_risk_category` varchar(64),
	`hard_no_triggers_json` text,
	`soft_no_triggers_json` text,
	`interaction_penalty_pct` decimal(6,3),
	`scenario_type` varchar(32),
	`created_at` bigint NOT NULL,
	CONSTRAINT `infra_sim_scenarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `isc_user_idx` ON `infra_sim_cases` (`user_id`);--> statement-breakpoint
CREATE INDEX `isc_status_idx` ON `infra_sim_cases` (`status`);--> statement-breakpoint
CREATE INDEX `isc_created_idx` ON `infra_sim_cases` (`created_at`);--> statement-breakpoint
CREATE INDEX `iscr_session_idx` ON `infra_sim_council_rounds` (`session_id`);--> statement-breakpoint
CREATE INDEX `iscr_round_idx` ON `infra_sim_council_rounds` (`round_number`);--> statement-breakpoint
CREATE INDEX `iscs_case_idx` ON `infra_sim_council_sessions` (`case_id`);--> statement-breakpoint
CREATE INDEX `iscs_user_idx` ON `infra_sim_council_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `iscs_status_idx` ON `infra_sim_council_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `isd_case_idx` ON `infra_sim_dimensions` (`case_id`);--> statement-breakpoint
CREATE INDEX `isme_monitor_idx` ON `infra_sim_monitoring_events` (`monitoring_object_id`);--> statement-breakpoint
CREATE INDEX `isme_case_idx` ON `infra_sim_monitoring_events` (`case_id`);--> statement-breakpoint
CREATE INDEX `isme_type_idx` ON `infra_sim_monitoring_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `isme_created_idx` ON `infra_sim_monitoring_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `ismo_case_idx` ON `infra_sim_monitoring_objects` (`case_id`);--> statement-breakpoint
CREATE INDEX `ismo_user_idx` ON `infra_sim_monitoring_objects` (`user_id`);--> statement-breakpoint
CREATE INDEX `ismo_status_idx` ON `infra_sim_monitoring_objects` (`thesis_status`);--> statement-breakpoint
CREATE INDEX `ismo_active_idx` ON `infra_sim_monitoring_objects` (`is_active`);--> statement-breakpoint
CREATE INDEX `ispl_source_idx` ON `infra_sim_portfolio_links` (`source_case_id`);--> statement-breakpoint
CREATE INDEX `ispl_target_idx` ON `infra_sim_portfolio_links` (`target_case_id`);--> statement-breakpoint
CREATE INDEX `ispl_user_idx` ON `infra_sim_portfolio_links` (`user_id`);--> statement-breakpoint
CREATE INDEX `isr_case_idx` ON `infra_sim_runs` (`case_id`);--> statement-breakpoint
CREATE INDEX `isr_user_idx` ON `infra_sim_runs` (`user_id`);--> statement-breakpoint
CREATE INDEX `isr_status_idx` ON `infra_sim_runs` (`status`);--> statement-breakpoint
CREATE INDEX `isr_created_idx` ON `infra_sim_runs` (`created_at`);--> statement-breakpoint
CREATE INDEX `iss_run_idx` ON `infra_sim_scenarios` (`run_id`);--> statement-breakpoint
CREATE INDEX `iss_decision_idx` ON `infra_sim_scenarios` (`decision`);