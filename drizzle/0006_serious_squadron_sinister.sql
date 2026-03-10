ALTER TABLE `annotations` MODIFY COLUMN `latencyMs` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `agents` ADD `webhookUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `agents` ADD `orgId` varchar(64);