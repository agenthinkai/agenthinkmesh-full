CREATE TABLE `turnaround_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyName` varchar(255),
	`industry` varchar(128),
	`crisisType` varchar(255),
	`documents` text,
	`agentOutputs` text,
	`alertsJson` text,
	`reportJson` text,
	`status` enum('pending','running','complete','error') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`pdfStatus` enum('idle','generating','ready','error') NOT NULL DEFAULT 'idle',
	`pdfUrl` text,
	`pdfJobStartedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `turnaround_sessions_id` PRIMARY KEY(`id`)
);
