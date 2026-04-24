CREATE TABLE `fleet_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fleet_mode` varchar(20) NOT NULL,
	`runs_total` int NOT NULL DEFAULT 30,
	`runs_completed` int NOT NULL DEFAULT 0,
	`runs_remaining` int NOT NULL DEFAULT 30,
	`last_run_at` bigint,
	`last_run_score` decimal(6,2),
	`last_run_cost` decimal(10,4),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` bigint NOT NULL,
	CONSTRAINT `fleet_config_id` PRIMARY KEY(`id`)
);
