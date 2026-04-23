CREATE TABLE `demo_email_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`demo_request_id` int NOT NULL,
	`recipient_name` varchar(200) NOT NULL,
	`institution` varchar(300) NOT NULL,
	`email` varchar(300) NOT NULL,
	`status_at_send` varchar(50) NOT NULL,
	`sent_at` bigint NOT NULL,
	CONSTRAINT `demo_email_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `demo_requests` ADD `follow_up_sent_at` bigint;--> statement-breakpoint
CREATE INDEX `del_request_idx` ON `demo_email_log` (`demo_request_id`);--> statement-breakpoint
CREATE INDEX `del_sent_at_idx` ON `demo_email_log` (`sent_at`);