CREATE TABLE `admin_user_creations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminId` int NOT NULL,
	`adminEmail` varchar(320),
	`createdEmail` varchar(320) NOT NULL,
	`createdName` varchar(255),
	`assignedRole` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_user_creations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `mustResetPassword` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `createdByAdminId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `tempPasswordIssuedAt` timestamp;--> statement-breakpoint
CREATE INDEX `auc_admin_idx` ON `admin_user_creations` (`adminId`);--> statement-breakpoint
CREATE INDEX `auc_email_idx` ON `admin_user_creations` (`createdEmail`);