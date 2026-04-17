CREATE TABLE `pitch_mirror_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareToken` varchar(64) NOT NULL,
	`mirrorResultJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pitch_mirror_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `pitch_mirror_shares_shareToken_unique` UNIQUE(`shareToken`)
);
--> statement-breakpoint
CREATE INDEX `pms_token_idx` ON `pitch_mirror_shares` (`shareToken`);