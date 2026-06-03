ALTER TABLE `outcome_sessions` ADD `primary_driver` enum('FINANCIAL','CONSTRUCTION','REGULATORY','TECHNOLOGY','COMMERCIAL','ESG');--> statement-breakpoint
ALTER TABLE `outcome_sessions` ADD `source_confidence` enum('HIGH','MEDIUM','LOW');--> statement-breakpoint
ALTER TABLE `outcome_sessions` ADD `source_type` enum('FILING','ANNUAL_REPORT','REGULATORY','LENDER','DEVELOPER','ANNOUNCEMENT','MANUAL');--> statement-breakpoint
ALTER TABLE `outcome_sessions` ADD `source_url` text;