CREATE TABLE `email_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`emailType` varchar(64) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'sent',
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amountUsd` decimal(10,2) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`status` varchar(32) NOT NULL,
	`provider` varchar(32) NOT NULL DEFAULT 'stripe',
	`providerPaymentId` varchar(255),
	`planTier` enum('standard','pro','enterprise'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planTier` enum('trial','standard','pro','enterprise') NOT NULL,
	`status` enum('active','cancelled','past_due','trialing','incomplete') NOT NULL DEFAULT 'active',
	`monthlyRunsLimit` int,
	`stripeCustomerId` varchar(255),
	`stripeSubscriptionId` varchar(255),
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `planTier` enum('trial','standard','pro','enterprise') DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `trialRunsRemaining` int DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `trialStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `trialExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `monthlyRunsLimit` int;--> statement-breakpoint
ALTER TABLE `users` ADD `monthlyRunsUsed` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `billingCycleAnchor` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `convertedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeSubscriptionId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `emailDay1SentAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `emailDay15SentAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `emailDay45SentAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `emailDay55SentAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `emailDay60SentAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `totalCompletedRuns` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totalAgentsFired` int DEFAULT 0 NOT NULL;