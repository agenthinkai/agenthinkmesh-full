ALTER TABLE `fleet_config` ADD `last_run_cost_usd` decimal(10,4) DEFAULT '0.0000' NOT NULL;--> statement-breakpoint
ALTER TABLE `fleet_config` ADD `total_cost_usd` decimal(10,4) DEFAULT '0.0000' NOT NULL;--> statement-breakpoint
ALTER TABLE `founder_agent_evaluations` ADD `tokens_input` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `founder_agent_evaluations` ADD `tokens_output` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `founder_agent_evaluations` ADD `tokens_total` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `founder_agent_evaluations` ADD `cost_usd` decimal(10,6) DEFAULT '0.000000' NOT NULL;--> statement-breakpoint
ALTER TABLE `founder_agent_runs` ADD `total_tokens_input` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `founder_agent_runs` ADD `total_tokens_output` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `founder_agent_runs` ADD `total_tokens` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `founder_agent_runs` ADD `total_cost_usd` decimal(10,4) DEFAULT '0.0000' NOT NULL;