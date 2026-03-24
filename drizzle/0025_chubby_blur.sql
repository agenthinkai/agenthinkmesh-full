CREATE TABLE `deal_screening_rate_limit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`windowStart` timestamp NOT NULL,
	`count` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deal_screening_rate_limit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deal_screenings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dealId` varchar(64) NOT NULL,
	`dealName` varchar(255) NOT NULL,
	`dealText` text NOT NULL,
	`pdfFileKey` varchar(512),
	`pdfFileUrl` text,
	`verdict` enum('APPROVED','APPROVED_WITH_CONDITIONS','REJECTED','VETOED') NOT NULL,
	`yesCount` int NOT NULL DEFAULT 0,
	`noCount` int NOT NULL DEFAULT 0,
	`hardYesCount` int NOT NULL DEFAULT 0,
	`softYesCount` int NOT NULL DEFAULT 0,
	`softNoCount` int NOT NULL DEFAULT 0,
	`hardNoCount` int NOT NULL DEFAULT 0,
	`confidenceScore` decimal(4,3) NOT NULL,
	`gccVetoTriggered` boolean NOT NULL DEFAULT false,
	`tiebreakerTriggered` boolean NOT NULL DEFAULT false,
	`tiebreakerSwingAgent` varchar(64),
	`conditionsToProceed` text NOT NULL,
	`blockingIssues` text NOT NULL,
	`votes` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deal_screenings_id` PRIMARY KEY(`id`),
	CONSTRAINT `deal_screenings_dealId_unique` UNIQUE(`dealId`)
);
