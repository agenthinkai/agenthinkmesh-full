CREATE TABLE `eval_inference_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`persona_id` varchar(64) NOT NULL,
	`provider` varchar(32) NOT NULL,
	`model` varchar(64) NOT NULL,
	`input_tokens` int,
	`output_tokens` int,
	`estimated_cost_usd` decimal(10,6),
	`latency_ms` int,
	`retry_count` int NOT NULL DEFAULT 0,
	`escalation_reason` varchar(64),
	`fallback_used` tinyint NOT NULL DEFAULT 0,
	`created_at` bigint NOT NULL,
	CONSTRAINT `eval_inference_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `eil_session_idx` ON `eval_inference_log` (`session_id`);--> statement-breakpoint
CREATE INDEX `eil_provider_idx` ON `eval_inference_log` (`provider`);--> statement-breakpoint
CREATE INDEX `eil_created_idx` ON `eval_inference_log` (`created_at`);