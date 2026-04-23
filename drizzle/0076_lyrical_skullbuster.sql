CREATE TABLE `demo_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`institution` varchar(300) NOT NULL,
	`email` varchar(300) NOT NULL,
	`use_case` text NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`created_at` bigint NOT NULL,
	CONSTRAINT `demo_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `demo_email_idx` ON `demo_requests` (`email`);--> statement-breakpoint
CREATE INDEX `demo_status_idx` ON `demo_requests` (`status`);--> statement-breakpoint
CREATE INDEX `demo_created_idx` ON `demo_requests` (`created_at`);