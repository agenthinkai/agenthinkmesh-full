ALTER TABLE `deal_screenings` ADD `icMemoText` longtext;--> statement-breakpoint
ALTER TABLE `deal_screenings` ADD `icMemoVersion` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `deal_screenings` ADD `icMemoGeneratedAt` timestamp;