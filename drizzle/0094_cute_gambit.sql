CREATE TABLE `sado_agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`status` varchar(30) NOT NULL DEFAULT 'idle',
	`last_action` text,
	`current_task` text,
	`confidence` float,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `sado_agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sado_audit_trail` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timestamp` bigint NOT NULL,
	`actor` varchar(100) NOT NULL,
	`agent_name` varchar(100),
	`action` varchar(100) NOT NULL,
	`entity` varchar(255),
	`confidence` float,
	`result` varchar(50),
	`severity` varchar(10) DEFAULT 'INFO',
	`trace_id` varchar(64) NOT NULL,
	`details` text,
	CONSTRAINT `sado_audit_trail_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sado_columns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source_id` int NOT NULL,
	`column_name` varchar(100) NOT NULL,
	`data_type` varchar(50) NOT NULL,
	`business_meaning` text,
	`classification` varchar(20) NOT NULL DEFAULT 'INTERNAL',
	`confidence` float NOT NULL DEFAULT 0.5,
	`classified_at` bigint,
	CONSTRAINT `sado_columns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sado_escalations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agent_name` varchar(100) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`confidence` float NOT NULL,
	`recommended_action` text NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`operator_decision` text,
	`resolved_at` bigint,
	`trace_id` varchar(64) NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `sado_escalations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sado_governance_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rule_id` varchar(100) NOT NULL,
	`jurisdiction` varchar(10) NOT NULL,
	`regulation` varchar(100) NOT NULL,
	`data_classification` varchar(20) NOT NULL,
	`source_country` varchar(10) NOT NULL,
	`destination_country` varchar(10) NOT NULL,
	`action` varchar(20) NOT NULL,
	`severity` varchar(10) NOT NULL,
	`description` text NOT NULL,
	`recommended_action` text,
	`trace_id` varchar(64) NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `sado_governance_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sado_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` varchar(50) NOT NULL,
	`schema` varchar(100) NOT NULL,
	`table` varchar(100) NOT NULL,
	`row_count` int NOT NULL DEFAULT 0,
	`status` varchar(30) NOT NULL DEFAULT 'discovered',
	`discovered_at` bigint NOT NULL,
	CONSTRAINT `sado_sources_id` PRIMARY KEY(`id`)
);
