CREATE TABLE `lp_twin_exports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`sessionId` int NOT NULL,
	`exportedByUserId` int NOT NULL,
	`exportType` enum('pdf','csv','json') NOT NULL,
	`reportType` enum('full_session','segment_summary','ic_debate','fit_matrix') NOT NULL DEFAULT 'full_session',
	`ipAddress` varchar(64),
	`userAgent` varchar(512),
	`createdAt` bigint NOT NULL,
	CONSTRAINT `lp_twin_exports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lp_twin_funds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`updatedByUserId` int NOT NULL,
	`fundName` varchar(256) NOT NULL,
	`gpName` varchar(256) NOT NULL,
	`strategy` varchar(128) NOT NULL,
	`assetClass` varchar(128),
	`geography` varchar(256),
	`domicile` varchar(128),
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`targetFundSizeM` decimal(14,2) NOT NULL,
	`economicsJson` text NOT NULL,
	`investmentPropositionJson` text,
	`riskLiquidityJson` text,
	`trackRecordJson` text NOT NULL,
	`institutionalRequirementsJson` text,
	`evidenceStatus` enum('draft','complete','verified') NOT NULL DEFAULT 'draft',
	`version` int NOT NULL DEFAULT 1,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	`archivedAt` bigint,
	CONSTRAINT `lp_twin_funds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lp_twin_segment_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`sessionId` int NOT NULL,
	`segmentId` varchar(64) NOT NULL,
	`fitScore` decimal(5,1) NOT NULL,
	`fitReasonsJson` text,
	`disqualifiersJson` text,
	`objectionsJson` text,
	`evidenceGapsJson` text,
	`complianceFlagsJson` text,
	`icVerdict` enum('Approved','Conditional Watchlist','Rejected') NOT NULL,
	`tailoredPositioning` text,
	`probabilityBand` varchar(32),
	`modelVersion` varchar(32) NOT NULL,
	`actualResponseCapturedAt` bigint,
	`actualResponse` enum('interested','declined','no_response','committed'),
	`createdAt` bigint NOT NULL,
	CONSTRAINT `lp_twin_segment_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lp_twin_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`fundId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`sessionName` varchar(256) NOT NULL,
	`selectedSegmentsJson` text NOT NULL,
	`scenarioType` enum('baseline','stress','optimistic','custom') NOT NULL DEFAULT 'baseline',
	`assumptionsJson` text,
	`engineVersion` varchar(32) NOT NULL,
	`registryVersion` varchar(32) NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`startedAt` bigint,
	`completedAt` bigint,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	`deletedAt` bigint,
	CONSTRAINT `lp_twin_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `hydro_scenarios` ADD `scenarioName` varchar(200);--> statement-breakpoint
ALTER TABLE `hydro_scenarios` ADD `acquisitionPriceKwd` decimal(12,3);--> statement-breakpoint
ALTER TABLE `hydro_scenarios` ADD `warbaFinancingKwd` decimal(12,3);--> statement-breakpoint
ALTER TABLE `hydro_scenarios` ADD `npvKwd` decimal(12,3);--> statement-breakpoint
ALTER TABLE `hydro_scenarios` ADD `facilityApprovedKwd` decimal(12,3);--> statement-breakpoint
ALTER TABLE `hydro_scenarios` ADD `facilityDrawnKwd` decimal(12,3);--> statement-breakpoint
ALTER TABLE `hydro_scenarios` ADD `facilityUndrawnKwd` decimal(12,3);--> statement-breakpoint
ALTER TABLE `hydro_scenarios` ADD `acquisitionAllocationKwd` decimal(12,3);--> statement-breakpoint
ALTER TABLE `hydro_scenarios` ADD `workingCapitalKwd` decimal(12,3);--> statement-breakpoint
ALTER TABLE `hydro_scenarios` ADD `cashY1` decimal(12,3);--> statement-breakpoint
ALTER TABLE `hydro_scenarios` ADD `cashY2` decimal(12,3);--> statement-breakpoint
ALTER TABLE `hydro_scenarios` ADD `cashY3` decimal(12,3);--> statement-breakpoint
ALTER TABLE `hydro_scenarios` ADD `cashY4` decimal(12,3);--> statement-breakpoint
ALTER TABLE `hydro_scenarios` ADD `cashY5` decimal(12,3);--> statement-breakpoint
ALTER TABLE `hydro_scenarios` ADD `caymanTreatment` varchar(100);