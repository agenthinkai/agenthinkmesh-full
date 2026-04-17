CREATE TABLE `pitch_triages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(36) NOT NULL,
	`pitchPreview` varchar(220) NOT NULL,
	`score` int NOT NULL,
	`classification` enum('ENGAGE','WATCH','IGNORE') NOT NULL,
	`confidence` enum('HIGH','MEDIUM','LOW') NOT NULL,
	`agentOutputs` text,
	`keySignals` text,
	`missingInfo` text,
	`topMissingFields` text,
	`nextStep` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pitch_triages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `pt_user_idx` ON `pitch_triages` (`userId`);--> statement-breakpoint
CREATE INDEX `pt_created_idx` ON `pitch_triages` (`createdAt`);