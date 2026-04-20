CREATE TABLE `deal_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(36) NOT NULL,
	`dealId` varchar(36) NOT NULL,
	`signalType` varchar(32) NOT NULL,
	`signalText` text NOT NULL,
	`source` varchar(16) NOT NULL DEFAULT 'manual',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`processed` boolean NOT NULL DEFAULT false,
	CONSTRAINT `deal_signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ds_user_idx` ON `deal_signals` (`userId`);--> statement-breakpoint
CREATE INDEX `ds_deal_idx` ON `deal_signals` (`dealId`);--> statement-breakpoint
CREATE INDEX `ds_created_idx` ON `deal_signals` (`createdAt`);