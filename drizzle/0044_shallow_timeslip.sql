ALTER TABLE `portfolio_runs` ADD `isBenchmark` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `portfolio_runs` ADD `benchmarkLabel` varchar(128);