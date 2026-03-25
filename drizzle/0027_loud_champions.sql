CREATE TABLE `mvno_agent_runs` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`subscriberContext` text NOT NULL,
	`agentResults` text NOT NULL,
	`overallRecommendation` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mvno_agent_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mvno_subscribers` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`subscriberName` varchar(255) NOT NULL,
	`msisdn` varchar(20) NOT NULL,
	`simStatus` enum('active','suspended','ported_out') NOT NULL DEFAULT 'active',
	`plan` enum('basic','worker','remittance_plus') NOT NULL DEFAULT 'basic',
	`nationality` varchar(100),
	`kycStatus` enum('pending','verified','rejected') NOT NULL DEFAULT 'pending',
	`monthlyArpu` decimal(10,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mvno_subscribers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mvno_agent_runs` ADD CONSTRAINT `mvno_agent_runs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mvno_subscribers` ADD CONSTRAINT `mvno_subscribers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;