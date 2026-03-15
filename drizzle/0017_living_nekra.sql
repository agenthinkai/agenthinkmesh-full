CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`icon` varchar(8) NOT NULL DEFAULT '🤖',
	`color` varchar(16) NOT NULL DEFAULT '#7BA3D4',
	`domain` varchar(64) NOT NULL,
	`persona` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_name_unique` UNIQUE(`name`)
);
