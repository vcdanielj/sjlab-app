CREATE TABLE `deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text,
	`client_id` text NOT NULL,
	`delivery_user_id` text,
	`service_type` text NOT NULL,
	`address` text NOT NULL,
	`coordinates` text,
	`contact_info` text NOT NULL,
	`items_description` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`proposed_amount_usd` real,
	`final_amount_usd` real,
	`notes` text,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`completed_at` integer,
	`cancelled_at` integer,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`delivery_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `delivery_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`delivery_user_id` text NOT NULL,
	`amount_usd` real NOT NULL,
	`payment_date` integer NOT NULL,
	`reference` text,
	`expense_id` text,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`delivery_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
ALTER TABLE `users` ADD `address` text;