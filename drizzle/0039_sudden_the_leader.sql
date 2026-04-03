CREATE TABLE `email_replies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`outboundEmailId` int NOT NULL,
	`gmailMessageId` varchar(256) NOT NULL,
	`gmailThreadId` varchar(256) NOT NULL,
	`senderEmail` varchar(320) NOT NULL,
	`senderName` varchar(255),
	`subject` varchar(512),
	`snippet` text,
	`bodyText` text,
	`sentiment` enum('positive','neutral','negative'),
	`receivedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_replies_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_replies_gmailMessageId_unique` UNIQUE(`gmailMessageId`)
);
--> statement-breakpoint
CREATE TABLE `gmail_oauth_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text NOT NULL,
	`tokenType` varchar(32) NOT NULL DEFAULT 'Bearer',
	`scope` text,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gmail_oauth_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `gmail_oauth_tokens_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `gmail_sync_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`startedAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`status` enum('running','success','error') NOT NULL DEFAULT 'running',
	`messagesScanned` int NOT NULL DEFAULT 0,
	`newRepliesFound` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gmail_sync_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outbound_emails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientName` varchar(255) NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`recipientFirm` varchar(255),
	`recipientRole` varchar(255),
	`market` varchar(64) NOT NULL,
	`subject` varchar(512) NOT NULL,
	`language` varchar(32) NOT NULL DEFAULT 'English',
	`msMessageId` varchar(512),
	`gmailThreadId` varchar(256),
	`replyStatus` enum('no_response','new_reply','interested','meeting_booked','pilot_started','not_interested') NOT NULL DEFAULT 'no_response',
	`followUpDue` boolean NOT NULL DEFAULT false,
	`followUpDueAt` timestamp,
	`sentAt` timestamp NOT NULL,
	`firstRepliedAt` timestamp,
	`lastActivityAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outbound_emails_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `email_replies` ADD CONSTRAINT `email_replies_outboundEmailId_outbound_emails_id_fk` FOREIGN KEY (`outboundEmailId`) REFERENCES `outbound_emails`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `er_outbound_idx` ON `email_replies` (`outboundEmailId`);--> statement-breakpoint
CREATE INDEX `er_thread_idx` ON `email_replies` (`gmailThreadId`);--> statement-breakpoint
CREATE INDEX `oe_market_idx` ON `outbound_emails` (`market`);--> statement-breakpoint
CREATE INDEX `oe_status_idx` ON `outbound_emails` (`replyStatus`);--> statement-breakpoint
CREATE INDEX `oe_email_idx` ON `outbound_emails` (`recipientEmail`);--> statement-breakpoint
CREATE INDEX `oe_follow_up_idx` ON `outbound_emails` (`followUpDue`);