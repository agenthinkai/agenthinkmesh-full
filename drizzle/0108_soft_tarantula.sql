CREATE TABLE `cfa_preference_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cfa_session_id` int NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`persona_id` varchar(64) NOT NULL,
	`persona_name` varchar(128),
	`council_mode` varchar(32) NOT NULL,
	`score_in_character` decimal(4,3) NOT NULL,
	`score_rule_fidelity` decimal(4,3) NOT NULL,
	`score_evidence_grounding` decimal(4,3) NOT NULL,
	`score_confidence_calib` decimal(4,3) NOT NULL,
	`fidelity_score` decimal(4,3) NOT NULL,
	`violated_rules_json` text NOT NULL,
	`changed` tinyint NOT NULL DEFAULT 0,
	`critique` varchar(512),
	`original_vote_json` longtext NOT NULL,
	`revised_vote_json` longtext NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `cfa_preference_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cfa_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`deal_id` varchar(64),
	`user_id` int,
	`council_mode` varchar(32) NOT NULL,
	`average_fidelity_score` decimal(5,4) NOT NULL,
	`total_personas_audited` int NOT NULL DEFAULT 10,
	`total_changed` int NOT NULL DEFAULT 0,
	`preference_records_json` longtext NOT NULL,
	`status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
	`duration_ms` int,
	`created_at` bigint NOT NULL,
	CONSTRAINT `cfa_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `cfa_sessions_session_id_unique` UNIQUE(`session_id`)
);
--> statement-breakpoint
CREATE INDEX `cpr_session_idx` ON `cfa_preference_records` (`session_id`);--> statement-breakpoint
CREATE INDEX `cpr_persona_idx` ON `cfa_preference_records` (`persona_id`);--> statement-breakpoint
CREATE INDEX `cpr_changed_idx` ON `cfa_preference_records` (`changed`);--> statement-breakpoint
CREATE INDEX `cpr_created_idx` ON `cfa_preference_records` (`created_at`);--> statement-breakpoint
CREATE INDEX `cfa_session_idx` ON `cfa_sessions` (`session_id`);--> statement-breakpoint
CREATE INDEX `cfa_deal_idx` ON `cfa_sessions` (`deal_id`);--> statement-breakpoint
CREATE INDEX `cfa_user_idx` ON `cfa_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `cfa_created_idx` ON `cfa_sessions` (`created_at`);
