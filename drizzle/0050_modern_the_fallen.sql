CREATE TABLE `batch_deal_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` varchar(64) NOT NULL,
	`itemIndex` int NOT NULL,
	`dealName` varchar(255) NOT NULL,
	`dealText` longtext NOT NULL,
	`councilMode` enum('gcc','global_vc','india_pe') NOT NULL DEFAULT 'gcc',
	`status` enum('queued','processing','completed','failed') NOT NULL DEFAULT 'queued',
	`verdict` enum('APPROVED','APPROVED_WITH_CONDITIONS','REJECTED','VETOED'),
	`yesCount` int,
	`noCount` int,
	`hasIcReport` boolean NOT NULL DEFAULT false,
	`councilResult` longtext,
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `batch_deal_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `batch_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`status` enum('queued','processing','completed','partial') NOT NULL DEFAULT 'queued',
	`totalDeals` int NOT NULL DEFAULT 0,
	`completedCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `batch_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `batch_jobs_batchId_unique` UNIQUE(`batchId`)
);
--> statement-breakpoint
CREATE INDEX `bdi_job_idx` ON `batch_deal_items` (`batchId`);--> statement-breakpoint
CREATE INDEX `bdi_status_idx` ON `batch_deal_items` (`status`);--> statement-breakpoint
CREATE INDEX `bj_batch_idx` ON `batch_jobs` (`batchId`);--> statement-breakpoint
CREATE INDEX `bj_user_idx` ON `batch_jobs` (`userId`);