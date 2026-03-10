CREATE TABLE `annotation_exports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`format` enum('jsonl','csv') NOT NULL DEFAULT 'jsonl',
	`recordCount` int NOT NULL DEFAULT 0,
	`agentFilter` varchar(128),
	`statusFilter` varchar(32),
	`fileKey` varchar(512),
	`fileUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `annotation_exports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `annotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`agentId` int NOT NULL,
	`agentName` varchar(128) NOT NULL,
	`inputText` text NOT NULL,
	`context` varchar(256),
	`label` varchar(128) NOT NULL,
	`confidence` decimal(4,3) NOT NULL,
	`dialect` varchar(64),
	`rationale` text,
	`structuredResult` text NOT NULL,
	`requiresReview` boolean NOT NULL DEFAULT false,
	`reviewStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewNote` text,
	`latencyMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `annotations_id` PRIMARY KEY(`id`)
);
