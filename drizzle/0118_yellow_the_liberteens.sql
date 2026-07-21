CREATE TABLE `atlas_editorial_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brief_draft_id` int NOT NULL,
	`company_id` int,
	`company_name` varchar(255) NOT NULL,
	`is_opening_compelling` tinyint NOT NULL DEFAULT 0,
	`is_hidden_variable_unique` tinyint NOT NULL DEFAULT 0,
	`has_marketing_language` tinyint NOT NULL DEFAULT 0,
	`would_ceo_forward` tinyint NOT NULL DEFAULT 0,
	`weak_or_generic_notes` text,
	`editorial_score` int NOT NULL DEFAULT 0,
	`recommendation` varchar(20) NOT NULL DEFAULT 'REGENERATE',
	`generated_at` bigint NOT NULL,
	`reviewer_notes` text,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `atlas_editorial_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_pricing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tier` varchar(10) NOT NULL,
	`input_price_per_million` decimal(12,6) NOT NULL,
	`output_price_per_million` decimal(12,6) NOT NULL,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `model_pricing_id` PRIMARY KEY(`id`),
	CONSTRAINT `model_pricing_tier_unique` UNIQUE(`tier`)
);
--> statement-breakpoint
CREATE TABLE `orchestration_units` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflow_type` varchar(80) NOT NULL,
	`workflow_id` varchar(120),
	`user_id` varchar(120),
	`tier` varchar(10) NOT NULL DEFAULT 'SMALL',
	`input_tokens` int NOT NULL DEFAULT 0,
	`output_tokens` int NOT NULL DEFAULT 0,
	`token_cost_usd` decimal(14,8) NOT NULL DEFAULT '0.00000000',
	`human_gate_cost_usd` decimal(14,8) NOT NULL DEFAULT '0.00000000',
	`dispute_cost_usd` decimal(14,8) NOT NULL DEFAULT '0.00000000',
	`residency_cac_usd` decimal(14,8) NOT NULL DEFAULT '0.00000000',
	`liability_reserve_usd` decimal(14,8) NOT NULL DEFAULT '0.00000000',
	`loaded_cost_usd` decimal(14,8) NOT NULL DEFAULT '0.00000000',
	`price_usd` decimal(12,6) NOT NULL DEFAULT '0.000000',
	`latency_ms` int,
	`attempts` int NOT NULL DEFAULT 1,
	`final_tier` varchar(10),
	`cap_breach` tinyint NOT NULL DEFAULT 0,
	`escalated` tinyint NOT NULL DEFAULT 0,
	`validation_passed` tinyint NOT NULL DEFAULT 1,
	`created_at` bigint NOT NULL,
	CONSTRAINT `orchestration_units_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_pricebook` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflow_type` varchar(80) NOT NULL,
	`price_usd` decimal(12,6) NOT NULL,
	`liability_reserve_pct` decimal(8,6) NOT NULL DEFAULT '0.030000',
	`human_gate_cost_per_minute` decimal(8,6) NOT NULL DEFAULT '0.500000',
	`human_gate_minutes` decimal(8,4) NOT NULL DEFAULT '0.0000',
	`residency_cac_per_ou_usd` decimal(12,6) NOT NULL DEFAULT '0.004000',
	`dispute_rate` decimal(8,6) NOT NULL DEFAULT '0.050000',
	`is_enterprise` tinyint NOT NULL DEFAULT 0,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `workflow_pricebook_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflow_pricebook_workflow_type_unique` UNIQUE(`workflow_type`)
);
