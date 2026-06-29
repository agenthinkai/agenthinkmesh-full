CREATE TABLE `atlas_brief_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_id` int,
	`company_name` varchar(255) NOT NULL,
	`executive_name` varchar(255),
	`executive_title` varchar(255),
	`executive_email` varchar(255),
	`strategic_decision` text,
	`hidden_variable` text,
	`sss` int DEFAULT 0,
	`esi` int DEFAULT 0,
	`evidence_confidence` int DEFAULT 0,
	`triple_gate_sss` int DEFAULT 0,
	`triple_gate_esi` int DEFAULT 0,
	`triple_gate_conf` int DEFAULT 0,
	`brief_content` text,
	`editor_status` varchar(20) NOT NULL DEFAULT 'DRAFT',
	`version` int NOT NULL DEFAULT 1,
	`parent_version_id` int,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	`approved_at` bigint,
	`promoted_at` bigint,
	`outreach_queue_id` int,
	`traceability_token` varchar(64),
	`constitution_version` varchar(32),
	`generated_by` varchar(64) DEFAULT 'atlas_editor',
	CONSTRAINT `atlas_brief_drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `atlas_conversation_timeline` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_id` int,
	`executive_memory_id` int,
	`company_name` varchar(255) NOT NULL,
	`executive_name` varchar(255) NOT NULL,
	`event_type` varchar(64) NOT NULL,
	`event_date` bigint NOT NULL,
	`summary` text,
	`detail` text,
	`outreach_queue_id` int,
	`sss` int,
	`esi` int,
	`constitution_version` varchar(32),
	`created_at` bigint NOT NULL,
	CONSTRAINT `atlas_conversation_timeline_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `atlas_executive_memory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_id` int,
	`company_name` varchar(255) NOT NULL,
	`executive_name` varchar(255) NOT NULL,
	`executive_email` varchar(255),
	`role` varchar(128),
	`first_contact_date` bigint,
	`last_contact_date` bigint,
	`total_briefs_delivered` int DEFAULT 0,
	`total_replies` int DEFAULT 0,
	`meetings` int DEFAULT 0,
	`proposals` int DEFAULT 0,
	`customers` int DEFAULT 0,
	`interests` text,
	`objections` text,
	`preferred_topics` text,
	`preferred_communication_style` varchar(128),
	`response_pattern` text,
	`relationship_score` int DEFAULT 0,
	`next_recommended_action` text,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `atlas_executive_memory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `atlas_learning_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_date` bigint NOT NULL,
	`trigger_type` varchar(64) NOT NULL,
	`company_id` int,
	`company_name` varchar(255),
	`executive_name` varchar(255),
	`sector` varchar(128),
	`subject_line_effectiveness` varchar(32),
	`hidden_variable_effectiveness` varchar(32),
	`decision_framing_effectiveness` varchar(32),
	`executive_response_pattern` text,
	`industry_response_pattern` text,
	`constitution_effectiveness` varchar(32),
	`what_worked` text,
	`what_failed` text,
	`recommended_improvements` text,
	`raw_llm_analysis` text,
	`constitution_version` varchar(32),
	`created_at` bigint NOT NULL,
	CONSTRAINT `atlas_learning_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `atlas_org_intelligence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_id` int NOT NULL,
	`company_name` varchar(255) NOT NULL,
	`decision_history` text,
	`hidden_variable_history` text,
	`executive_changes` text,
	`ai_initiatives` text,
	`capital_allocation_decisions` text,
	`ma_activity` text,
	`regulatory_events` text,
	`previous_atlas_observations` text,
	`previous_atlas_predictions` text,
	`outcome_history` text,
	`last_updated` bigint NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `atlas_org_intelligence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `atlas_significance_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brief_generation_threshold` int NOT NULL DEFAULT 85,
	`auto_reject_below` int NOT NULL DEFAULT 40,
	`notify_on_level_4` int NOT NULL DEFAULT 1,
	`weight_economic_impact` int NOT NULL DEFAULT 25,
	`weight_irreversibility` int NOT NULL DEFAULT 20,
	`weight_time_criticality` int NOT NULL DEFAULT 15,
	`weight_hidden_variable_strength` int NOT NULL DEFAULT 20,
	`weight_executive_relevance` int NOT NULL DEFAULT 10,
	`weight_novelty` int NOT NULL DEFAULT 10,
	`updated_at` bigint NOT NULL,
	`updated_by` varchar(128),
	CONSTRAINT `atlas_significance_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `sss` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `esi` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `decision_level` varchar(16);--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `sss_economic_impact` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `sss_irreversibility` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `sss_time_criticality` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `sss_hidden_variable_strength` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `sss_executive_relevance` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `sss_novelty` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `quality_gate_actionable` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `quality_gate_evidence_based` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `quality_gate_differentiated` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `quality_gate_board_relevant` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `quality_gate_passed` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `sss_rationale` text;--> statement-breakpoint
ALTER TABLE `aros_companies` ADD `sss_calculated_at` bigint;--> statement-breakpoint
ALTER TABLE `aros_outreach_queue` ADD `sss` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `aros_outreach_queue` ADD `esi` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `aros_outreach_queue` ADD `decision_level` varchar(16);--> statement-breakpoint
ALTER TABLE `aros_outreach_queue` ADD `quality_gate_passed` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `aros_outreach_queue` ADD `atlas_queue` varchar(20) DEFAULT 'MONITOR';--> statement-breakpoint
CREATE INDEX `aros_oq_sss_idx` ON `aros_outreach_queue` (`sss`);--> statement-breakpoint
CREATE INDEX `aros_oq_decision_level_idx` ON `aros_outreach_queue` (`decision_level`);