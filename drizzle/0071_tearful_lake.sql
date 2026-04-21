CREATE TABLE `login_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`ipAddress` varchar(45) NOT NULL,
	`country` varchar(100),
	`loginAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `login_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `le_user_idx` ON `login_events` (`userId`);--> statement-breakpoint
CREATE INDEX `le_login_at_idx` ON `login_events` (`loginAt`);