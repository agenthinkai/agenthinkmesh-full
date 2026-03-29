CREATE TABLE `consensus_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`thesis` varchar(200),
	`yesCount` int NOT NULL DEFAULT 0,
	`noCount` int NOT NULL DEFAULT 0,
	`verdict` varchar(30) NOT NULL,
	`consensusReached` tinyint NOT NULL DEFAULT 0,
	`hardFlags` text,
	`silentFails` text,
	`votesJson` longtext,
	`resultJson` longtext,
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consensus_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `consensus_sessions_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE TABLE `cost_counters` (
	`counter_key` varchar(64) NOT NULL,
	`value` varchar(32) NOT NULL DEFAULT '0',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cost_counters_counter_key` PRIMARY KEY(`counter_key`)
);
--> statement-breakpoint
CREATE TABLE `pitch_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pitchToken` varchar(64) NOT NULL,
	`phone` varchar(20),
	`pitchText` text,
	`decisionMemoryId` int,
	`verdict` varchar(30),
	`confidenceScore` decimal(5,3),
	`paymentStatus` varchar(20) DEFAULT 'FREE',
	`reportUnlocked` tinyint DEFAULT 0,
	`voteSummaryJson` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pitch_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `pitch_sessions_pitchToken_unique` UNIQUE(`pitchToken`)
);
--> statement-breakpoint
CREATE INDEX `cs_session_idx` ON `consensus_sessions` (`sessionId`);--> statement-breakpoint
CREATE INDEX `cs_verdict_idx` ON `consensus_sessions` (`verdict`);--> statement-breakpoint
CREATE INDEX `ps_token_idx` ON `pitch_sessions` (`pitchToken`);