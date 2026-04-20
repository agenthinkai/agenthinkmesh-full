CREATE TABLE `auto_trigger_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(36) NOT NULL,
	`dealId` varchar(36) NOT NULL,
	`triggerType` varchar(32) NOT NULL,
	`firedAt` timestamp NOT NULL DEFAULT (now()),
	`resultTriageId` varchar(36),
	CONSTRAINT `auto_trigger_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `atl_user_idx` ON `auto_trigger_log` (`userId`);--> statement-breakpoint
CREATE INDEX `atl_fired_at_idx` ON `auto_trigger_log` (`firedAt`);