CREATE TABLE IF NOT EXISTS `unidentified_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`currency` text NOT NULL,
	`amount_original` real NOT NULL,
	`payment_method` text NOT NULL,
	`reference` text,
	`payment_date` integer NOT NULL,
	`notes` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reconciled_payment_id` text REFERENCES `payments`(`id`) ON DELETE SET NULL,
	`reconciled_at` integer,
	`voided_at` integer,
	`created_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
	`created_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `idx_unidentified_payments_status` ON `unidentified_payments` (`status`);
