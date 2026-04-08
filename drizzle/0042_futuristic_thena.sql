CREATE TABLE `tier0_signals` (
	`id` varchar(64) NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`source` varchar(100) NOT NULL,
	`subtype` enum('Accelerator','Grant','Hackathon','Research') NOT NULL,
	`tier` enum('0A','0B') NOT NULL,
	`classification` enum('Startup','Emerging','Project') NOT NULL,
	`description` text NOT NULL,
	`dealMemo` text NOT NULL,
	`confidence` enum('High','Medium') NOT NULL,
	`scoreBoost` int NOT NULL DEFAULT 30,
	`externalUrl` varchar(512),
	`surfaced` boolean NOT NULL DEFAULT false,
	`ingestedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tier0_signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `t0_source_idx` ON `tier0_signals` (`source`);--> statement-breakpoint
CREATE INDEX `t0_tier_idx` ON `tier0_signals` (`tier`);--> statement-breakpoint
CREATE INDEX `t0_surfaced_idx` ON `tier0_signals` (`surfaced`);