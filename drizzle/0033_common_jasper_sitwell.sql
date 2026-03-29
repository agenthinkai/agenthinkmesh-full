CREATE TABLE `deal_screener_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripeSessionId` varchar(255) NOT NULL,
	`stripePaymentIntentId` varchar(255),
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`dealId` varchar(64),
	`amountUsd` decimal(8,2) NOT NULL DEFAULT '32.50',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deal_screener_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `deal_screener_payments_stripeSessionId_unique` UNIQUE(`stripeSessionId`)
);
--> statement-breakpoint
ALTER TABLE `deal_screener_payments` ADD CONSTRAINT `deal_screener_payments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `dsp_user_idx` ON `deal_screener_payments` (`userId`);--> statement-breakpoint
CREATE INDEX `dsp_session_idx` ON `deal_screener_payments` (`stripeSessionId`);--> statement-breakpoint
CREATE INDEX `dsp_status_idx` ON `deal_screener_payments` (`status`);