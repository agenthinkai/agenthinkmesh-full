CREATE TABLE `high_demand_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`ipAddress` varchar(64) NOT NULL,
	`endpoint` varchar(128) NOT NULL,
	`requestDate` varchar(10) NOT NULL,
	`dailyTotalAtTime` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `high_demand_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `llm_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`ipAddress` varchar(64) NOT NULL,
	`endpoint` varchar(128) NOT NULL,
	`tokensUsed` int NOT NULL DEFAULT 0,
	`requestDate` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `llm_usage_id` PRIMARY KEY(`id`)
);
