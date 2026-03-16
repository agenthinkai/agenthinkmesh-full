CREATE TABLE `partner_institutions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`type` enum('asset_manager','custodian','exchange','regulator','index_provider','law_firm','auditor','other') NOT NULL DEFAULT 'other',
	`country` varchar(64) NOT NULL DEFAULT 'Kuwait',
	`contactName` varchar(128),
	`contactEmail` varchar(320),
	`website` varchar(256),
	`notes` text,
	`status` enum('prospect','contacted','in_discussion','partner','declined') NOT NULL DEFAULT 'prospect',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_institutions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partnership_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`institutionName` varchar(128) NOT NULL,
	`contactName` varchar(128) NOT NULL,
	`contactEmail` varchar(320) NOT NULL,
	`role` varchar(128),
	`message` text,
	`partnerType` enum('asset_manager','custodian','exchange','regulator','index_provider','law_firm','auditor','other') NOT NULL DEFAULT 'other',
	`notified` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partnership_requests_id` PRIMARY KEY(`id`)
);
