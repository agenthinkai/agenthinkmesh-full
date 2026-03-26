ALTER TABLE `forecast_history` ADD `month` varchar(20);--> statement-breakpoint
ALTER TABLE `forecast_history` ADD `revenue` decimal(15,2);--> statement-breakpoint
ALTER TABLE `forecast_history` ADD `ebitda` decimal(15,2);--> statement-breakpoint
ALTER TABLE `forecast_history` ADD `sortOrder` int;--> statement-breakpoint
ALTER TABLE `forecasts` ADD `geography` varchar(100);--> statement-breakpoint
ALTER TABLE `forecasts` ADD `currency` varchar(10);--> statement-breakpoint
ALTER TABLE `forecasts` ADD `baseRevenue` decimal(15,2);--> statement-breakpoint
ALTER TABLE `forecasts` ADD `ebitdaMargin` decimal(5,4);--> statement-breakpoint
ALTER TABLE `forecasts` ADD `growthRate` decimal(5,4);--> statement-breakpoint
ALTER TABLE `forecasts` ADD `assumptions` text;