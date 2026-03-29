CREATE TABLE `token_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionId` varchar(64),
	`tokensUsed` int NOT NULL DEFAULT 1,
	`action` varchar(64) NOT NULL DEFAULT 'council_run',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `token_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `payments` MODIFY COLUMN `planTier` enum('standard','pro','professional','enterprise');--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `planTier` enum('trial','standard','pro','professional','enterprise') NOT NULL DEFAULT 'trial';--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `status` enum('active','canceled','cancelled','past_due','trialing','incomplete') NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `planTier` enum('trial','standard','pro','professional','enterprise') NOT NULL DEFAULT 'trial';--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `plan` enum('starter','professional','enterprise') DEFAULT 'starter' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `stripePriceId` varchar(64);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `tokensRemaining` int DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `tokensTotal` int DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `renewsAt` timestamp;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_userId_unique` UNIQUE(`userId`);--> statement-breakpoint
CREATE INDEX `tu_user_idx` ON `token_usage` (`userId`);--> statement-breakpoint
CREATE INDEX `tu_session_idx` ON `token_usage` (`sessionId`);--> statement-breakpoint
CREATE INDEX `sub_user_idx` ON `subscriptions` (`userId`);--> statement-breakpoint
CREATE INDEX `sub_stripe_idx` ON `subscriptions` (`stripeSubscriptionId`);