ALTER TABLE `portfolio_reviews` ADD `pptxStatus` enum('idle','generating','ready','error') DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE `portfolio_reviews` ADD `pptxUrl` text;--> statement-breakpoint
ALTER TABLE `portfolio_reviews` ADD `pptxJobStartedAt` timestamp;