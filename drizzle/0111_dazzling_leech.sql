CREATE TABLE `outcome_attributions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`outcome_session_id` int NOT NULL,
	`persona_id` varchar(64) NOT NULL,
	`prediction_type` enum('FINANCIAL','TECHNICAL','CONSTRUCTION','REGULATORY','COMMERCIAL','ESG') NOT NULL,
	`prediction_text` text NOT NULL,
	`materialized` tinyint,
	`confidence_weight` decimal(5,4),
	`created_at` bigint NOT NULL,
	CONSTRAINT `outcome_attributions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `oa_session_idx` ON `outcome_attributions` (`outcome_session_id`);--> statement-breakpoint
CREATE INDEX `oa_persona_idx` ON `outcome_attributions` (`persona_id`);--> statement-breakpoint
CREATE INDEX `oa_materialized_idx` ON `outcome_attributions` (`materialized`);