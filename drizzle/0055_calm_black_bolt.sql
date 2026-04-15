CREATE TABLE `vendor_evaluations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`vendorName` varchar(255) NOT NULL,
	`category` varchar(128) NOT NULL,
	`contractValue` varchar(128),
	`duration` varchar(128),
	`finalRecommendation` enum('APPROVE','REJECT','CONDITIONAL_APPROVAL') NOT NULL,
	`overallScore` decimal(4,1) NOT NULL,
	`overallConfidence` enum('High','Medium','Low') NOT NULL,
	`reportJson` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vendor_evaluations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `vendor_evaluations` ADD CONSTRAINT `vendor_evaluations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ve_user_idx` ON `vendor_evaluations` (`userId`);--> statement-breakpoint
CREATE INDEX `ve_created_idx` ON `vendor_evaluations` (`createdAt`);