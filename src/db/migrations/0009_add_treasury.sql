CREATE TABLE IF NOT EXISTS `treasury_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`initial_balance` real DEFAULT 0 NOT NULL,
	`initial_balance_date` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `treasury_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`from_account_id` text NOT NULL REFERENCES `treasury_accounts`(`id`),
	`to_account_id` text NOT NULL REFERENCES `treasury_accounts`(`id`),
	`amount_from` real NOT NULL,
	`currency_from` text NOT NULL,
	`amount_to` real NOT NULL,
	`currency_to` text NOT NULL,
	`exchange_rate` real,
	`transfer_date` integer NOT NULL,
	`reference` text,
	`notes` text,
	`created_by` text NOT NULL REFERENCES `users`(`id`),
	`created_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `treasury_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL REFERENCES `treasury_accounts`(`id`),
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`reason` text NOT NULL,
	`notes` text,
	`adjustment_date` integer NOT NULL,
	`created_by` text NOT NULL REFERENCES `users`(`id`),
	`created_at` integer NOT NULL
);
