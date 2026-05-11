CREATE TABLE `arabic_refinement_policy` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(64) NOT NULL,
	`dialect_llm_fallback_threshold` int NOT NULL DEFAULT 40,
	`encoding_issues_review_cutoff` int NOT NULL DEFAULT 3,
	`pii_severity_overrides` text,
	`llm_fallback_enabled` boolean NOT NULL DEFAULT true,
	`audit_storage_adapter` varchar(20) NOT NULL DEFAULT 'local',
	`signing_private_key` text,
	`signing_public_key` text,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `arabic_refinement_policy_id` PRIMARY KEY(`id`),
	CONSTRAINT `arabic_refinement_policy_tenant_id_unique` UNIQUE(`tenant_id`)
);
