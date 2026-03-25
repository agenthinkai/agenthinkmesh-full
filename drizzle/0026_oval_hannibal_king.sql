CREATE TABLE `intel_analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`institution` varchar(255) NOT NULL,
	`domain` varchar(128),
	`aum` varchar(64),
	`inputText` text,
	`result` text NOT NULL,
	`modules` text,
	`lens` text,
	`isInternal` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `intel_analyses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intel_briefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`weekOf` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `intel_briefs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intel_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trackedInstitutionId` int NOT NULL,
	`result` text NOT NULL,
	`diff` text,
	`fetchedContent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `intel_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intel_tracked` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`institution` varchar(255) NOT NULL,
	`domain` varchar(128),
	`aum` varchar(64),
	`lastAnalysis` text,
	`lastFetchedContent` text,
	`trackingSource` varchar(64) DEFAULT 'news_api',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `intel_tracked_id` PRIMARY KEY(`id`)
);
