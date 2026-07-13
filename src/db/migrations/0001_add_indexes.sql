-- ============================================
-- SJ Lab — Add Performance Indexes (Sprint 8)
-- ============================================
-- Orders: most queried table
CREATE INDEX IF NOT EXISTS `idx_orders_client_id` ON `orders` (`client_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_orders_status` ON `orders` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_orders_created_at` ON `orders` (`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_orders_current_step_id` ON `orders` (`current_step_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_orders_completed_at` ON `orders` (`completed_at`);
--> statement-breakpoint
-- Payments: frequently filtered by client and status
CREATE INDEX IF NOT EXISTS `idx_payments_client_id` ON `payments` (`client_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_payments_status` ON `payments` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_payments_payment_date` ON `payments` (`payment_date`);
--> statement-breakpoint
-- Products: filtered by workflow and category
CREATE INDEX IF NOT EXISTS `idx_products_workflow_id` ON `products` (`workflow_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_products_category_id` ON `products` (`category_id`);
--> statement-breakpoint
-- Workflow steps: filtered by workflow
CREATE INDEX IF NOT EXISTS `idx_workflow_steps_workflow_id` ON `workflow_steps` (`workflow_id`);
--> statement-breakpoint
-- Order step history: bottleneck analysis queries
CREATE INDEX IF NOT EXISTS `idx_order_step_history_order_id` ON `order_step_history` (`order_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_step_history_from_step_id` ON `order_step_history` (`from_step_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_step_history_to_step_id` ON `order_step_history` (`to_step_id`);
--> statement-breakpoint
-- Payment allocations: FIFO queries
CREATE INDEX IF NOT EXISTS `idx_payment_allocations_payment_id` ON `payment_allocations` (`payment_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_payment_allocations_order_id` ON `payment_allocations` (`order_id`);
--> statement-breakpoint
-- Order notes: fetch by order
CREATE INDEX IF NOT EXISTS `idx_order_notes_order_id` ON `order_notes` (`order_id`);
