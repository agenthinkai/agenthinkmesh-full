CREATE TABLE `founder_agent_evaluations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`idea_id` int NOT NULL,
	`pitch_id` int NOT NULL,
	`status` enum('queued','running','completed','failed') NOT NULL DEFAULT 'queued',
	`classification` varchar(20),
	`classification_score` int,
	`execution_score` int,
	`market_score` int,
	`final_score` int,
	`strengths` text,
	`concerns` text,
	`flags` text,
	`agent_disagreements` text,
	`recommended_action` varchar(100),
	`duration_ms` int,
	`error_message` varchar(500),
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `founder_agent_evaluations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `founder_agent_ideas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`domain` varchar(100) NOT NULL,
	`sub_sector` varchar(100) NOT NULL,
	`description` varchar(500) NOT NULL,
	`target_region` varchar(100) NOT NULL,
	`founder_name` varchar(100) NOT NULL,
	`funding_stage` varchar(50) NOT NULL,
	`funding_ask` varchar(50) NOT NULL,
	`idea_fingerprint` varchar(64) NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `founder_agent_ideas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `founder_agent_insights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`high_score_patterns` text NOT NULL,
	`low_score_patterns` text NOT NULL,
	`failure_reasons` text NOT NULL,
	`domain_comparison` text NOT NULL,
	`improvement_suggestions` text NOT NULL,
	`ideal_pitch_structure` text NOT NULL,
	`raw_json` longtext NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `founder_agent_insights_id` PRIMARY KEY(`id`),
	CONSTRAINT `founder_agent_insights_run_id_unique` UNIQUE(`run_id`)
);
--> statement-breakpoint
CREATE TABLE `founder_agent_pitches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`idea_id` int NOT NULL,
	`problem` text NOT NULL,
	`solution` text NOT NULL,
	`target_market` text NOT NULL,
	`business_model` text NOT NULL,
	`competitive_advantage` text NOT NULL,
	`key_risk` text NOT NULL,
	`funding_ask` varchar(50) NOT NULL,
	`summary_3s` text NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `founder_agent_pitches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `founder_agent_research` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`domain` varchar(100) NOT NULL,
	`query` varchar(300) NOT NULL,
	`result_summary` text NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `founder_agent_research_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `founder_agent_run_costs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`total_searches` int NOT NULL DEFAULT 0,
	`total_llm_calls` int NOT NULL DEFAULT 0,
	`estimated_tokens` int NOT NULL DEFAULT 0,
	`estimated_cost_usd` decimal(10,4) NOT NULL DEFAULT '0.0000',
	`created_at` bigint NOT NULL,
	CONSTRAINT `founder_agent_run_costs_id` PRIMARY KEY(`id`),
	CONSTRAINT `founder_agent_run_costs_run_id_unique` UNIQUE(`run_id`)
);
--> statement-breakpoint
CREATE TABLE `founder_agent_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_date` varchar(20) NOT NULL,
	`status` enum('pending','generating','researching','pitching','evaluating','extracting','completed','paused','failed') NOT NULL DEFAULT 'pending',
	`total_ideas` int NOT NULL DEFAULT 0,
	`completed` int NOT NULL DEFAULT 0,
	`queued` int NOT NULL DEFAULT 0,
	`running` int NOT NULL DEFAULT 0,
	`total_searches` int NOT NULL DEFAULT 0,
	`total_llm_calls` int NOT NULL DEFAULT 0,
	`estimated_tokens` int NOT NULL DEFAULT 0,
	`estimated_cost_usd` decimal(10,4) NOT NULL DEFAULT '0.0000',
	`started_at` bigint,
	`completed_at` bigint,
	`created_at` bigint NOT NULL,
	CONSTRAINT `founder_agent_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `fae_run_idx` ON `founder_agent_evaluations` (`run_id`);--> statement-breakpoint
CREATE INDEX `fae_idea_idx` ON `founder_agent_evaluations` (`idea_id`);--> statement-breakpoint
CREATE INDEX `fae_status_idx` ON `founder_agent_evaluations` (`status`);--> statement-breakpoint
CREATE INDEX `fae_final_idx` ON `founder_agent_evaluations` (`final_score`);--> statement-breakpoint
CREATE INDEX `fai_run_idx` ON `founder_agent_ideas` (`run_id`);--> statement-breakpoint
CREATE INDEX `fai_domain_idx` ON `founder_agent_ideas` (`domain`);--> statement-breakpoint
CREATE INDEX `fai_fingerprint_idx` ON `founder_agent_ideas` (`idea_fingerprint`);--> statement-breakpoint
CREATE INDEX `fain_run_idx` ON `founder_agent_insights` (`run_id`);--> statement-breakpoint
CREATE INDEX `fap_run_idx` ON `founder_agent_pitches` (`run_id`);--> statement-breakpoint
CREATE INDEX `fap_idea_idx` ON `founder_agent_pitches` (`idea_id`);--> statement-breakpoint
CREATE INDEX `farres_run_idx` ON `founder_agent_research` (`run_id`);--> statement-breakpoint
CREATE INDEX `farres_domain_idx` ON `founder_agent_research` (`domain`);--> statement-breakpoint
CREATE INDEX `farc_run_idx` ON `founder_agent_run_costs` (`run_id`);--> statement-breakpoint
CREATE INDEX `far_run_date_idx` ON `founder_agent_runs` (`run_date`);--> statement-breakpoint
CREATE INDEX `far_status_idx` ON `founder_agent_runs` (`status`);