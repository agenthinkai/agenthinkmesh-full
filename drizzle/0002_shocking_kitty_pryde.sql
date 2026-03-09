CREATE TABLE `agent_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`tasksCompleted` int NOT NULL DEFAULT 0,
	`successRate` decimal(5,2) NOT NULL DEFAULT '80.00',
	`avgLatency` int NOT NULL DEFAULT 500,
	`errorRate` decimal(5,2) NOT NULL DEFAULT '0.00',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_metrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_metrics_agentId_unique` UNIQUE(`agentId`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`agentName` varchar(128) NOT NULL,
	`developerName` varchar(128) NOT NULL,
	`description` text NOT NULL,
	`capabilities` text NOT NULL,
	`endpointUrl` varchar(512) NOT NULL,
	`averageLatency` int NOT NULL DEFAULT 500,
	`pricingModel` enum('free','per_task','subscription') NOT NULL DEFAULT 'free',
	`status` enum('active','inactive','pending') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `task_history` ADD `agentsUsed` text;--> statement-breakpoint
ALTER TABLE `task_history` ADD `executionTime` int;