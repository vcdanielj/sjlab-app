-- Rename columns in payments
ALTER TABLE `payments` RENAME COLUMN `amount` TO `amount_original`;--> statement-breakpoint
ALTER TABLE `payments` RENAME COLUMN `amount_usd` TO `amount_usd_cxc`;--> statement-breakpoint
ALTER TABLE `payments` RENAME COLUMN `exchange_rate` TO `applied_rate_value`;--> statement-breakpoint

-- Add new columns in payments
ALTER TABLE `payments` ADD `applied_rate_type` text DEFAULT 'USD_PARALLEL' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `base_rate_value` real DEFAULT 1.0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `amount_usd_real` real DEFAULT 0.0 NOT NULL;--> statement-breakpoint

-- Rename columns in expenses
ALTER TABLE `expenses` RENAME COLUMN `amount_usd` TO `amount_usd_cxc`;--> statement-breakpoint
ALTER TABLE `expenses` RENAME COLUMN `exchange_rate` TO `applied_rate_value`;--> statement-breakpoint

-- Add new columns in expenses
ALTER TABLE `expenses` ADD `applied_rate_type` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `base_rate_value` real;--> statement-breakpoint
ALTER TABLE `expenses` ADD `amount_usd_real` real DEFAULT 0.0 NOT NULL;--> statement-breakpoint

-- Populate historical data for payments
UPDATE `payments` SET `base_rate_value` = 1.0, `amount_usd_real` = `amount_usd_cxc`, `applied_rate_type` = 'USD_PARALLEL' WHERE `currency` = 'USD';--> statement-breakpoint
UPDATE `payments` SET `base_rate_value` = COALESCE(`applied_rate_value`, 1.0), `amount_usd_real` = `amount_usd_cxc`, `applied_rate_type` = 'USD_PARALLEL' WHERE `currency` = 'VES';--> statement-breakpoint

-- Populate historical data for expenses
UPDATE `expenses` SET `base_rate_value` = COALESCE(`applied_rate_value`, 1.0), `amount_usd_real` = `amount_usd_cxc`, `applied_rate_type` = CASE WHEN `currency` = 'VES' THEN 'USD_PARALLEL' ELSE NULL END;