ALTER TABLE `organizations` MODIFY COLUMN `approvedDomains` text NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_runs` MODIFY COLUMN `blackboardMemory` text NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_runs` MODIFY COLUMN `sourceDocuments` text NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_runs` MODIFY COLUMN `riskFlags` text NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_runs` MODIFY COLUMN `routeLog` text NOT NULL;