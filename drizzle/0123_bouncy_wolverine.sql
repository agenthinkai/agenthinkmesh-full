CREATE TABLE `cockpit_council_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`decisionId` int NOT NULL,
	`decisionRef` varchar(32) NOT NULL,
	`councilMode` varchar(64) NOT NULL DEFAULT 'executive',
	`agentsJson` mediumtext NOT NULL,
	`judgeJson` mediumtext NOT NULL,
	`tallyApprove` int NOT NULL DEFAULT 0,
	`tallyConditional` int NOT NULL DEFAULT 0,
	`tallyReject` int NOT NULL DEFAULT 0,
	`finalVerdict` varchar(64) NOT NULL DEFAULT 'PENDING',
	`confidence` int NOT NULL DEFAULT 0,
	`runAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cockpit_council_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cockpit_decisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`decisionRef` varchar(32) NOT NULL,
	`title` varchar(512) NOT NULL,
	`decisionType` varchar(64) NOT NULL DEFAULT 'STRATEGIC',
	`priority` enum('HIGH','MEDIUM','LOW') NOT NULL DEFAULT 'MEDIUM',
	`status` enum('PENDING_COUNCIL','UNDER_REVIEW','APPROVED','REJECTED','DEFERRED') NOT NULL DEFAULT 'PENDING_COUNCIL',
	`context` text,
	`assumptions` text,
	`owner` varchar(256) NOT NULL DEFAULT '',
	`urgency` varchar(64) NOT NULL DEFAULT 'normal',
	`kpiImpact` varchar(1024) NOT NULL DEFAULT '[]',
	`submittedBy` varchar(256) NOT NULL DEFAULT '',
	`outcomeAction` text,
	`outcomeDate` varchar(32),
	`outcomeConfidence` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cockpit_decisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cockpit_operating_kpis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`section` varchar(64) NOT NULL,
	`kpiKey` varchar(128) NOT NULL,
	`label` varchar(256) NOT NULL,
	`value` varchar(256),
	`unit` varchar(64),
	`source` varchar(256),
	`verificationStatus` enum('live','manual','unverified') NOT NULL DEFAULT 'unverified',
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cockpit_operating_kpis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cockpit_scenario_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`decisionId` int NOT NULL,
	`scenarioName` varchar(256) NOT NULL,
	`weightsJson` mediumtext NOT NULL,
	`rankingsJson` mediumtext NOT NULL,
	`sensitivityJson` mediumtext NOT NULL,
	`recommendation` text,
	`runAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cockpit_scenario_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`description` text,
	`parentDeptId` int,
	`headUserId` int,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `departments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `enterprise_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`userId` int,
	`action` varchar(128) NOT NULL,
	`resourceType` varchar(64) NOT NULL,
	`resourceId` varchar(128),
	`details` text,
	`ipAddress` varchar(64),
	`userAgent` varchar(256),
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enterprise_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `enterprise_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`userId` int NOT NULL,
	`roleId` int NOT NULL,
	`deptId` int,
	`jobTitle` varchar(128),
	`status` enum('active','suspended','invited') NOT NULL DEFAULT 'invited',
	`invitedAt` timestamp NOT NULL DEFAULT (now()),
	`joinedAt` timestamp,
	`lastActiveAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `enterprise_memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `enterprise_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`description` text,
	`permissions` text NOT NULL DEFAULT ('[]'),
	`twinAccess` text NOT NULL DEFAULT ('[]'),
	`isSystemRole` tinyint NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `enterprise_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hydro_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`userName` varchar(200),
	`actionType` varchar(100) NOT NULL,
	`entityType` varchar(100),
	`entityId` varchar(100),
	`oldValue` text,
	`newValue` text,
	`reason` text,
	`ipAddress` varchar(50),
	`createdAt` bigint NOT NULL,
	CONSTRAINT `hydro_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hydro_company_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slotNumber` int NOT NULL,
	`status` enum('empty','target_identified','under_diligence','approved','acquired','active','exited') DEFAULT 'empty',
	`companyName` varchar(300),
	`sector` varchar(200),
	`acquisitionPriceKwd` decimal(12,3),
	`revenueKwd` decimal(12,3),
	`ebitdaKwd` decimal(12,3),
	`cashConversionPct` decimal(6,2),
	`receivablesDays` int,
	`customerConcentrationPct` decimal(6,2),
	`totalDebtKwd` decimal(12,3),
	`automationPlan` text,
	`automationSavingsActualKwd` decimal(12,3),
	`automationSavingsForecastKwd` decimal(12,3),
	`riskAlerts` text,
	`phase` int,
	`acquisitionDate` bigint,
	`notes` text,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `hydro_company_slots_id` PRIMARY KEY(`id`),
	CONSTRAINT `hydro_company_slots_slotNumber_unique` UNIQUE(`slotNumber`)
);
--> statement-breakpoint
CREATE TABLE `hydro_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemKey` varchar(100) NOT NULL,
	`label` varchar(300) NOT NULL,
	`currentInput` varchar(500),
	`status` enum('verified','pending','assumption','outstanding') NOT NULL DEFAULT 'pending',
	`statusNote` varchar(500),
	`category` varchar(100) NOT NULL DEFAULT 'financial',
	`isEditable` tinyint DEFAULT 1,
	`sortOrder` int DEFAULT 0,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `hydro_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `hydro_evidence_itemKey_unique` UNIQUE(`itemKey`)
);
--> statement-breakpoint
CREATE TABLE `hydro_scenarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scenarioKey` varchar(50) NOT NULL,
	`label` varchar(200) NOT NULL,
	`caymanAmountKwd` decimal(12,3) NOT NULL,
	`caymanTimingMonths` int NOT NULL DEFAULT 18,
	`revenueY1` decimal(12,3),
	`revenueY2` decimal(12,3),
	`revenueY3` decimal(12,3),
	`revenueY4` decimal(12,3),
	`revenueY5` decimal(12,3),
	`ebitdaY1` decimal(12,3),
	`ebitdaY2` decimal(12,3),
	`ebitdaY3` decimal(12,3),
	`ebitdaY4` decimal(12,3),
	`ebitdaY5` decimal(12,3),
	`seniorDebtY1` decimal(12,3),
	`seniorDebtY2` decimal(12,3),
	`seniorDebtY3` decimal(12,3),
	`seniorDebtY4` decimal(12,3),
	`seniorDebtY5` decimal(12,3),
	`dscrY1` decimal(6,2),
	`dscrY2` decimal(6,2),
	`dscrY3` decimal(6,2),
	`dscrY4` decimal(6,2),
	`dscrY5` decimal(6,2),
	`twinVerdict` varchar(100) NOT NULL,
	`isActive` tinyint DEFAULT 0,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `hydro_scenarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hydro_stress_params` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(100) NOT NULL,
	`userId` int,
	`caymanAmountKwd` decimal(12,3) DEFAULT '1000',
	`caymanDelayMonths` int DEFAULT 0,
	`revenueGrowthDelta` decimal(6,3) DEFAULT '0',
	`grossMarginDelta` decimal(6,3) DEFAULT '0',
	`automationSavingsPct` decimal(6,3) DEFAULT '100',
	`financeRatePct` decimal(6,3) DEFAULT '5.5',
	`gracePeriodMonths` int DEFAULT 12,
	`acqTimingDeltaMonths` int DEFAULT 0,
	`acqPriceDeltaPct` decimal(6,3) DEFAULT '0',
	`customerConcentrationShock` tinyint DEFAULT 0,
	`receivablesDelayDays` int DEFAULT 0,
	`gccDisruption` tinyint DEFAULT 0,
	`stressCase` varchar(50) DEFAULT 'custom',
	`createdAt` bigint NOT NULL,
	CONSTRAINT `hydro_stress_params_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `twin_instances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`deptId` int,
	`blueprintId` varchar(64) NOT NULL,
	`instanceSlug` varchar(128) NOT NULL,
	`displayName` varchar(128) NOT NULL,
	`description` text,
	`industry` varchar(64),
	`geography` varchar(64),
	`councilPersonaSetId` varchar(64),
	`ontologyId` varchar(64),
	`kpiSetId` varchar(64),
	`governanceProfile` enum('STANDARD','CONFIDENTIAL','SOVEREIGN','CLASSIFIED') NOT NULL DEFAULT 'STANDARD',
	`configJson` text NOT NULL DEFAULT ('{}'),
	`status` enum('provisioning','active','suspended','archived') NOT NULL DEFAULT 'provisioning',
	`provisionedAt` timestamp,
	`activatedAt` timestamp,
	`lastRunAt` timestamp,
	`runCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `twin_instances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `twin_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`fromTwinId` int NOT NULL,
	`toTwinId` int NOT NULL,
	`messageType` enum('signal','alert','data_update','recommendation','calibration') NOT NULL DEFAULT 'signal',
	`subject` varchar(256) NOT NULL,
	`payloadJson` text NOT NULL DEFAULT ('{}'),
	`priority` enum('low','normal','high','critical') NOT NULL DEFAULT 'normal',
	`status` enum('pending','delivered','acknowledged','failed') NOT NULL DEFAULT 'pending',
	`deliveredAt` timestamp,
	`acknowledgedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `twin_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `twin_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`twinInstanceId` int NOT NULL,
	`orgId` int NOT NULL,
	`userId` int NOT NULL,
	`sessionType` enum('run','simulate','deliberate','compare','calibrate') NOT NULL DEFAULT 'run',
	`inputJson` text NOT NULL DEFAULT ('{}'),
	`outputJson` text,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`durationMs` int,
	`tokensUsed` int NOT NULL DEFAULT 0,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `twin_sessions_id` PRIMARY KEY(`id`)
);
