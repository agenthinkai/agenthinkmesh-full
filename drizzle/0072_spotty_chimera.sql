CREATE TABLE `waitlist_signups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`sourcePage` varchar(100) NOT NULL DEFAULT 'home',
	`stageInterest` varchar(80),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `waitlist_signups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ws_email_idx` ON `waitlist_signups` (`email`);--> statement-breakpoint
CREATE INDEX `ws_created_idx` ON `waitlist_signups` (`createdAt`);