CREATE TABLE `decision_upgrade_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`domain` enum('deal','procurement','enterprise','hiring') NOT NULL,
	`originalRunId` varchar(128) NOT NULL,
	`improvedRunId` varchar(128),
	`verdictBefore` varchar(64) NOT NULL,
	`verdictAfter` varchar(64),
	`confidenceBefore` decimal(5,3) NOT NULL,
	`confidenceAfter` decimal(5,3),
	`confidenceDelta` decimal(5,3),
	`fixesApplied` longtext,
	`upgradeProtocolJson` longtext NOT NULL,
	`deltaOutputJson` longtext,
	`strictMode` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `decision_upgrade_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `decision_upgrade_runs` ADD CONSTRAINT `decision_upgrade_runs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `dur_user_idx` ON `decision_upgrade_runs` (`userId`);--> statement-breakpoint
CREATE INDEX `dur_domain_idx` ON `decision_upgrade_runs` (`domain`);--> statement-breakpoint
CREATE INDEX `dur_created_idx` ON `decision_upgrade_runs` (`createdAt`);