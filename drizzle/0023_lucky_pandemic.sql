CREATE TABLE `insurance_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(64) NOT NULL,
	`runType` enum('underwriting','claims','treaty','compliance','cat_model') NOT NULL,
	`status` enum('pending','running','complete','failed') NOT NULL DEFAULT 'pending',
	`inputSummary` text,
	`uwDecision` enum('APPROVE','REFER','DECLINE'),
	`confidenceScore` int,
	`premiumIndication` varchar(64),
	`riskScore` int,
	`takafulCompliant` boolean,
	`threatLevel` enum('low','medium','high','critical'),
	`treatyRecommendation` varchar(32),
	`cessionRate` varchar(32),
	`blackboard` text,
	`totalTokens` int,
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `insurance_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `insurance_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`agentId` varchar(32) NOT NULL,
	`agentName` varchar(128) NOT NULL,
	`status` enum('pending','running','complete','failed') NOT NULL DEFAULT 'pending',
	`output` text,
	`tokensUsed` int NOT NULL DEFAULT 0,
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `insurance_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `takaful_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(64) NOT NULL,
	`insuranceRunId` int,
	`alertType` varchar(64) NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'warning',
	`title` varchar(255) NOT NULL,
	`description` text,
	`recommendedAction` text,
	`isAcknowledged` boolean NOT NULL DEFAULT false,
	`acknowledgedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `takaful_alerts_id` PRIMARY KEY(`id`)
);
