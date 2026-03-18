CREATE TABLE `admesh_ads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`language` enum('en','ar') NOT NULL,
	`adIndex` int NOT NULL,
	`hook` text NOT NULL,
	`body` text NOT NULL,
	`cta` varchar(255) NOT NULL,
	`visualDirection` text,
	`targetAudience` varchar(255),
	`hookScore` int,
	`clarityScore` int,
	`brandFitScore` int,
	`localRelevanceScore` int,
	`ctrPotentialScore` int,
	`overallScore` int,
	`isTopPick` boolean NOT NULL DEFAULT false,
	`isApproved` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admesh_ads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admesh_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(64) NOT NULL,
	`brandName` varchar(128) NOT NULL,
	`brandVoice` varchar(64) NOT NULL DEFAULT 'premium',
	`category` varchar(128) NOT NULL,
	`market` varchar(64) NOT NULL DEFAULT 'Kuwait',
	`competitors` text,
	`languages` varchar(32) NOT NULL DEFAULT 'en,ar',
	`mode` enum('demo','live') NOT NULL DEFAULT 'demo',
	`status` enum('pending','running','complete','failed') NOT NULL DEFAULT 'pending',
	`competitorInsights` text,
	`strategy` text,
	`performanceInsights` text,
	`blackboard` text,
	`totalTokens` int,
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `admesh_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admesh_steps` (
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
	CONSTRAINT `admesh_steps_id` PRIMARY KEY(`id`)
);
