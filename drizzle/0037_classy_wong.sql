CREATE TABLE `contact_interactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`userId` int NOT NULL,
	`action` text NOT NULL,
	`messageText` text,
	`outcome` enum('no_response','response','converted'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_interactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`company` varchar(255),
	`role` varchar(255),
	`region` varchar(100),
	`lastContacted` timestamp,
	`status` enum('new','contacted','active','closed') NOT NULL DEFAULT 'new',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outreach_style_examples` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`exampleText` text NOT NULL,
	`label` varchar(128),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `outreach_style_examples_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contact_interactions` ADD CONSTRAINT `contact_interactions_contactId_contacts_id_fk` FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contact_interactions` ADD CONSTRAINT `contact_interactions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `outreach_style_examples` ADD CONSTRAINT `outreach_style_examples_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ci_contact_idx` ON `contact_interactions` (`contactId`);--> statement-breakpoint
CREATE INDEX `ci_user_idx` ON `contact_interactions` (`userId`);--> statement-breakpoint
CREATE INDEX `contact_user_idx` ON `contacts` (`userId`);--> statement-breakpoint
CREATE INDEX `contact_status_idx` ON `contacts` (`status`);--> statement-breakpoint
CREATE INDEX `contact_last_contacted_idx` ON `contacts` (`lastContacted`);--> statement-breakpoint
CREATE INDEX `ose_user_idx` ON `outreach_style_examples` (`userId`);