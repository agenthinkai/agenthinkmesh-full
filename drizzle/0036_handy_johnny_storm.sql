CREATE TABLE `sovereign_vault` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaultName` enum('global_vault','china_sovereign_vault') NOT NULL,
	`dealId` varchar(36) NOT NULL,
	`agentId` varchar(64) NOT NULL,
	`payload` text NOT NULL,
	`classification` enum('RESTRICTED','CONFIDENTIAL','TOP_SECRET') NOT NULL DEFAULT 'RESTRICTED',
	`region` enum('Global','China') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sovereign_vault_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dealId` varchar(36) NOT NULL,
	`userId` varchar(36) NOT NULL,
	`region` enum('Global','China') NOT NULL DEFAULT 'Global',
	`baseAmountUsd` decimal(10,4) NOT NULL DEFAULT '32.5000',
	`currency` enum('USD','KWD','CNY','EUR') NOT NULL DEFAULT 'USD',
	`convertedAmount` decimal(10,4),
	`fxRate` decimal(12,6),
	`fxRateAt` timestamp,
	`status` enum('pending','completed','failed','killed') NOT NULL DEFAULT 'pending',
	`killSwitchTriggered` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sv_vault_region_idx` ON `sovereign_vault` (`vaultName`,`region`);--> statement-breakpoint
CREATE INDEX `sv_deal_idx` ON `sovereign_vault` (`dealId`);--> statement-breakpoint
CREATE INDEX `tx_deal_user_idx` ON `transactions` (`dealId`,`userId`);--> statement-breakpoint
CREATE INDEX `tx_status_idx` ON `transactions` (`status`);