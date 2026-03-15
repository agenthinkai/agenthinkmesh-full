ALTER TABLE `agents` ADD `domain` varchar(64);--> statement-breakpoint
ALTER TABLE `agents` ADD `isBuiltIn` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `isCustom` boolean DEFAULT false NOT NULL;