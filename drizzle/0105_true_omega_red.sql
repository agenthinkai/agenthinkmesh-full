ALTER TABLE `scenario_sim_runs` ADD `upgraded_scenario` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `scenario_sim_runs` ADD `original_deal_id` varchar(64);--> statement-breakpoint
ALTER TABLE `scenario_sim_runs` ADD `original_verdict` varchar(64);--> statement-breakpoint
ALTER TABLE `scenario_sim_runs` ADD `upgraded_verdict` varchar(64);--> statement-breakpoint
CREATE INDEX `ssr_orig_deal_idx` ON `scenario_sim_runs` (`original_deal_id`);