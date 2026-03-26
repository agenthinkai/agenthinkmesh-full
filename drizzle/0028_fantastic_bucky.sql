CREATE TABLE `forecast_agents` (
	`id` varchar(36) NOT NULL,
	`forecastId` varchar(36) NOT NULL,
	`agentName` varchar(100) NOT NULL,
	`agentRole` varchar(100) NOT NULL,
	`probabilityEstimate` decimal(5,4) NOT NULL,
	`confidence` decimal(5,4) NOT NULL,
	`upwardForces` text NOT NULL,
	`downwardForces` text NOT NULL,
	`summary` text NOT NULL,
	`recommendedActions` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `forecast_agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forecast_documents` (
	`id` varchar(36) NOT NULL,
	`forecastId` varchar(36) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`s3Url` varchar(512) NOT NULL,
	`extractedText` text,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `forecast_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forecast_history` (
	`id` varchar(36) NOT NULL,
	`forecastId` varchar(36) NOT NULL,
	`probability` decimal(5,4) NOT NULL,
	`confidence` decimal(5,4) NOT NULL,
	`delta` decimal(5,4) NOT NULL DEFAULT '0.0000',
	`cause` varchar(255) NOT NULL,
	`agentSource` varchar(100),
	`eventType` enum('agent_update','manual_update','trigger_fired','document_added','status_change') NOT NULL DEFAULT 'agent_update',
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `forecast_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forecast_triggers` (
	`id` varchar(36) NOT NULL,
	`forecastId` varchar(36) NOT NULL,
	`triggerType` enum('probability_drop','low_confidence','status_worsened','deadline_approaching') NOT NULL,
	`threshold` decimal(5,4),
	`firedAt` timestamp NOT NULL DEFAULT (now()),
	`description` text NOT NULL,
	`actionsTaken` text,
	`resolved` boolean NOT NULL DEFAULT false,
	`resolvedAt` timestamp,
	CONSTRAINT `forecast_triggers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forecasts` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`forecastType` enum('deadline_risk','budget_risk','target_probability') NOT NULL,
	`question` text NOT NULL,
	`description` text,
	`deadline` timestamp,
	`threshold` decimal(15,2),
	`businessArea` varchar(100),
	`currentProbability` decimal(5,4) NOT NULL DEFAULT '0.5000',
	`previousProbability` decimal(5,4),
	`confidenceScore` decimal(5,4) NOT NULL DEFAULT '0.5000',
	`status` enum('on_track','watchlist','at_risk','critical','resolved') NOT NULL DEFAULT 'watchlist',
	`agentsJson` text,
	`documentUrl` varchar(512),
	`isSeeded` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `forecasts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_scenarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scenarioId` varchar(32) NOT NULL,
	`domain` enum('deal_screening','wealth_management','insurance_underwriting','mvno_intelligence','legal_review','budget_forecasting','social_media','ic_reports') NOT NULL,
	`title` varchar(512) NOT NULL,
	`summary` text NOT NULL,
	`content` text NOT NULL,
	`geography` varchar(128),
	`sector` varchar(128),
	`tags` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledge_scenarios_id` PRIMARY KEY(`id`),
	CONSTRAINT `knowledge_scenarios_scenarioId_unique` UNIQUE(`scenarioId`)
);
--> statement-breakpoint
ALTER TABLE `forecast_agents` ADD CONSTRAINT `forecast_agents_forecastId_forecasts_id_fk` FOREIGN KEY (`forecastId`) REFERENCES `forecasts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `forecast_documents` ADD CONSTRAINT `forecast_documents_forecastId_forecasts_id_fk` FOREIGN KEY (`forecastId`) REFERENCES `forecasts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `forecast_history` ADD CONSTRAINT `forecast_history_forecastId_forecasts_id_fk` FOREIGN KEY (`forecastId`) REFERENCES `forecasts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `forecast_triggers` ADD CONSTRAINT `forecast_triggers_forecastId_forecasts_id_fk` FOREIGN KEY (`forecastId`) REFERENCES `forecasts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `forecasts` ADD CONSTRAINT `forecasts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;