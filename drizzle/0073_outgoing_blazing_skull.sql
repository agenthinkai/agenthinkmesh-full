ALTER TABLE `users` ADD `email_unsubscribed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `email_unsubscribed_at` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `unsubscribe_reason` varchar(500);--> statement-breakpoint
ALTER TABLE `users` ADD `unsubscribe_token` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_unsubscribe_token_unique` UNIQUE(`unsubscribe_token`);