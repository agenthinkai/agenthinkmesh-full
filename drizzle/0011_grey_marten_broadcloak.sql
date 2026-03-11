CREATE TABLE `portfolio_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fundName` varchar(255),
	`manager` varchar(255),
	`reviewPeriod` varchar(128),
	`notes` text,
	`documents` text,
	`reportJson` text,
	`status` enum('pending','analyzing','complete','error') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolio_reviews_id` PRIMARY KEY(`id`)
);
