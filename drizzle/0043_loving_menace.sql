CREATE TABLE `ips_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL DEFAULT 'My IPS',
	`constraints` longtext NOT NULL,
	`targetReturn` decimal(6,4) NOT NULL,
	`targetVolatilityMin` decimal(6,4) NOT NULL,
	`targetVolatilityMax` decimal(6,4) NOT NULL,
	`maxDrawdown` decimal(6,4) NOT NULL,
	`benchmark` varchar(64) NOT NULL DEFAULT '60/40',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ips_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ipsConfigId` int,
	`ipsSnapshot` longtext NOT NULL,
	`macroRegime` varchar(32),
	`macroConfidence` decimal(5,4),
	`macroRationale` text,
	`assetEstimates` longtext,
	`constructionResults` longtext,
	`cioWeights` longtext,
	`cioExpectedReturn` decimal(6,4),
	`cioExpectedVolatility` decimal(6,4),
	`cioSharpe` decimal(6,4),
	`cioRisks` text,
	`ipsCompliant` boolean DEFAULT false,
	`boardMemo` longtext,
	`status` enum('draft','macro_done','assets_done','construction_done','complete') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolio_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ips_configs` ADD CONSTRAINT `ips_configs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolio_runs` ADD CONSTRAINT `portfolio_runs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolio_runs` ADD CONSTRAINT `portfolio_runs_ipsConfigId_ips_configs_id_fk` FOREIGN KEY (`ipsConfigId`) REFERENCES `ips_configs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ips_user_idx` ON `ips_configs` (`userId`);--> statement-breakpoint
CREATE INDEX `pr_user_idx` ON `portfolio_runs` (`userId`);--> statement-breakpoint
CREATE INDEX `pr_status_idx` ON `portfolio_runs` (`status`);