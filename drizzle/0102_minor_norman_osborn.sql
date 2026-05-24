CREATE TABLE `scenario_sim_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`deal_id` varchar(64) NOT NULL,
	`deal_name` varchar(255) NOT NULL,
	`mode` enum('quick','institutional','deep','infrastructure') NOT NULL,
	`target_count` int NOT NULL,
	`completed_count` int NOT NULL DEFAULT 0,
	`status` enum('pending','running','completed','failed','paused') NOT NULL DEFAULT 'pending',
	`decision_distribution` text,
	`failure_vectors` text,
	`approval_pathways` text,
	`governance_heatmap` text,
	`sensitivity_surface` text,
	`executive_summary` text,
	`duration_ms` int,
	`base_seed` bigint,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `scenario_sim_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `scenario_sim_runs_run_id_unique` UNIQUE(`run_id`)
);
--> statement-breakpoint
CREATE TABLE `scenario_sim_telemetry` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` varchar(64) NOT NULL,
	`chunk_index` int NOT NULL,
	`chunk_size` int NOT NULL,
	`approve_count` int NOT NULL DEFAULT 0,
	`conditional_count` int NOT NULL DEFAULT 0,
	`reject_count` int NOT NULL DEFAULT 0,
	`hard_no_count` int NOT NULL DEFAULT 0,
	`duration_ms` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scenario_sim_telemetry_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ssr_user_idx` ON `scenario_sim_runs` (`user_id`);--> statement-breakpoint
CREATE INDEX `ssr_deal_idx` ON `scenario_sim_runs` (`deal_id`);--> statement-breakpoint
CREATE INDEX `ssr_status_idx` ON `scenario_sim_runs` (`status`);--> statement-breakpoint
CREATE INDEX `sst_run_idx` ON `scenario_sim_telemetry` (`run_id`);