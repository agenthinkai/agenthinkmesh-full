CREATE TABLE `report_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`viewerIp` varchar(45) NOT NULL,
	`userAgent` text,
	`viewedAt` bigint NOT NULL,
	CONSTRAINT `report_views_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shared_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`reportType` enum('single_deal','comparison') NOT NULL,
	`dealId` varchar(64),
	`comparisonId` varchar(64),
	`userId` int NOT NULL,
	`expiresAt` bigint NOT NULL,
	`revokedAt` bigint,
	`viewCount` int NOT NULL DEFAULT 0,
	`lastViewedAt` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shared_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `shared_reports_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `shared_reports` ADD CONSTRAINT `shared_reports_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `rv_token_hash_idx` ON `report_views` (`tokenHash`);--> statement-breakpoint
CREATE INDEX `rv_viewed_at_idx` ON `report_views` (`viewedAt`);--> statement-breakpoint
CREATE INDEX `sr_token_hash_idx` ON `shared_reports` (`tokenHash`);--> statement-breakpoint
CREATE INDEX `sr_user_idx` ON `shared_reports` (`userId`);--> statement-breakpoint
CREATE INDEX `sr_deal_idx` ON `shared_reports` (`dealId`);--> statement-breakpoint
CREATE INDEX `sr_comp_idx` ON `shared_reports` (`comparisonId`);