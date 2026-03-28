CREATE TABLE `agent_votes_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`decisionMemoryId` int NOT NULL,
	`personaId` varchar(100) NOT NULL,
	`personaName` varchar(100),
	`vote` varchar(20),
	`confidence` decimal(4,3),
	`rationale` text,
	`wasCorrect` boolean,
	`scoredAt` timestamp,
	CONSTRAINT `agent_votes_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_weights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`personaId` varchar(100) NOT NULL,
	`weight` decimal(4,2) NOT NULL DEFAULT '1.00',
	`totalEvaluations` int NOT NULL DEFAULT 0,
	`correctPredictions` int NOT NULL DEFAULT 0,
	`lastEvaluatedAt` timestamp,
	`updatedAt` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_weights_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_weights_personaId_unique` UNIQUE(`personaId`)
);
--> statement-breakpoint
CREATE TABLE `decision_memory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` varchar(100),
	`taskDescription` text NOT NULL,
	`taskDomain` varchar(50),
	`embedding` text NOT NULL,
	`finalVerdict` varchar(30),
	`confidenceScore` decimal(5,3),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `decision_memory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `decision_outcomes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`decisionMemoryId` int NOT NULL,
	`outcomeSource` varchar(50),
	`outcomeData` text,
	`outcomeVerdict` varchar(20) DEFAULT 'PENDING',
	`outcomeRecordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `decision_outcomes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agent_votes_log` ADD CONSTRAINT `agent_votes_log_decisionMemoryId_decision_memory_id_fk` FOREIGN KEY (`decisionMemoryId`) REFERENCES `decision_memory`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `decision_outcomes` ADD CONSTRAINT `decision_outcomes_decisionMemoryId_decision_memory_id_fk` FOREIGN KEY (`decisionMemoryId`) REFERENCES `decision_memory`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `avl_mem_idx` ON `agent_votes_log` (`decisionMemoryId`);--> statement-breakpoint
CREATE INDEX `avl_persona_idx` ON `agent_votes_log` (`personaId`);--> statement-breakpoint
CREATE INDEX `dm_domain_idx` ON `decision_memory` (`taskDomain`);--> statement-breakpoint
CREATE INDEX `do_mem_idx` ON `decision_outcomes` (`decisionMemoryId`);