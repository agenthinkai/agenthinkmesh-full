ALTER TABLE `agents` MODIFY COLUMN `status` enum('active','inactive','pending','degraded') NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `agents` ADD `version` varchar(32) DEFAULT '1.0.0' NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `lastVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `agents` ADD `failCount` int DEFAULT 0 NOT NULL;