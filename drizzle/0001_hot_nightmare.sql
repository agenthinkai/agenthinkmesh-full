CREATE TABLE `task_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`task` text NOT NULL,
	`contextKey` varchar(64) NOT NULL,
	`contextLabel` varchar(128) NOT NULL,
	`agentCount` int NOT NULL DEFAULT 0,
	`outputs` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vault_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`filename` varchar(255) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` text NOT NULL,
	`mimeType` varchar(128),
	`extractedText` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vault_documents_id` PRIMARY KEY(`id`)
);
