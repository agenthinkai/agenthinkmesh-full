CREATE TABLE `signal_deals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`company` varchar(255) NOT NULL,
	`sector` varchar(128) NOT NULL,
	`stage` varchar(64) NOT NULL,
	`summary` text NOT NULL,
	`source` varchar(255) NOT NULL,
	`screened` boolean NOT NULL DEFAULT false,
	`autoScreened` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `signal_deals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_signal_prefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`autoScreen` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_signal_prefs_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_signal_prefs_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `signal_deals` ADD CONSTRAINT `signal_deals_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_signal_prefs` ADD CONSTRAINT `user_signal_prefs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sd_user_idx` ON `signal_deals` (`userId`);--> statement-breakpoint
CREATE INDEX `sd_created_idx` ON `signal_deals` (`createdAt`);