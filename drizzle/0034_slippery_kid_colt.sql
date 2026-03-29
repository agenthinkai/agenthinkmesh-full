CREATE TABLE `deal_comparisons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`comparisonId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`dealIds` text NOT NULL,
	`dealNames` text NOT NULL,
	`dealCount` int NOT NULL,
	`rankedDeals` text NOT NULL,
	`comparisonSummary` text NOT NULL,
	`dealAnalyses` text NOT NULL,
	`pdfUrl` varchar(512),
	`totalAmountUsd` decimal(8,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deal_comparisons_id` PRIMARY KEY(`id`),
	CONSTRAINT `deal_comparisons_comparisonId_unique` UNIQUE(`comparisonId`)
);
--> statement-breakpoint
ALTER TABLE `deal_comparisons` ADD CONSTRAINT `deal_comparisons_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `dc_user_idx` ON `deal_comparisons` (`userId`);--> statement-breakpoint
CREATE INDEX `dc_comp_id_idx` ON `deal_comparisons` (`comparisonId`);