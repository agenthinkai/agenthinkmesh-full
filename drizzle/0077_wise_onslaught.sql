ALTER TABLE `demo_requests` MODIFY COLUMN `status` varchar(50) NOT NULL DEFAULT 'new';--> statement-breakpoint
ALTER TABLE `demo_requests` ADD `updated_at` bigint NOT NULL;