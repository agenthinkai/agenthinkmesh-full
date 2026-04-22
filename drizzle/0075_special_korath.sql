CREATE TABLE `client_encryption_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`wrappedKey` text NOT NULL,
	`keyVersion` int NOT NULL DEFAULT 1,
	`status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`rotatedAt` timestamp,
	`revokedAt` timestamp,
	CONSTRAINT `client_encryption_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_encryption_keys_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `cmk_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`operation` enum('key_generated','key_rotated','key_revoked','field_encrypted','field_decrypted') NOT NULL,
	`fieldRef` varchar(128),
	`keyVersion` int NOT NULL DEFAULT 1,
	`performedAt` timestamp NOT NULL DEFAULT (now()),
	`ipAddress` varchar(45),
	CONSTRAINT `cmk_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cal_user_idx` ON `cmk_audit_log` (`userId`);--> statement-breakpoint
CREATE INDEX `cal_op_idx` ON `cmk_audit_log` (`operation`);--> statement-breakpoint
CREATE INDEX `cal_performed_idx` ON `cmk_audit_log` (`performedAt`);