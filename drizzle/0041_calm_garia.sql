ALTER TABLE `outbound_emails` ADD `resentAt` timestamp;--> statement-breakpoint
ALTER TABLE `outbound_emails` ADD `resendMsMessageId` varchar(512);--> statement-breakpoint
ALTER TABLE `outbound_emails` ADD `deliveryStatus` enum('pending','sent','delivered','rejected','failed');