ALTER TABLE `founder_agent_evaluations` ADD `shariah_compliance` varchar(20);--> statement-breakpoint
ALTER TABLE `founder_agent_evaluations` ADD `decision_outcome` varchar(20);--> statement-breakpoint
ALTER TABLE `founder_agent_runs` ADD `fleet_mode` varchar(20) DEFAULT 'global' NOT NULL;