ALTER TABLE `portfolio_runs` ADD `shareToken` varchar(64);--> statement-breakpoint
ALTER TABLE `portfolio_runs` ADD CONSTRAINT `portfolio_runs_shareToken_unique` UNIQUE(`shareToken`);--> statement-breakpoint
CREATE INDEX `pr_share_token_idx` ON `portfolio_runs` (`shareToken`);