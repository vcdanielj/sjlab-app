// ============================================
// SJ Lab — Drizzle ORM Schema (Cloudflare D1)
// ============================================

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ==========================================
// TABLES
// ==========================================

// ---------- Users ----------
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  phone: text('phone'),
  address: text('address'),
  clinicName: text('clinic_name'),
  taxId: text('tax_id'),
  role: text('role', { enum: ['admin', 'tech', 'client', 'delivery'] }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(false),
  autoBillingEnabled: integer('auto_billing_enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
});

// ---------- Workflows ----------
export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
});

// ---------- Workflow Steps ----------
export const workflowSteps = sqliteTable('workflow_steps', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull().references(() => workflows.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

// ---------- Categories ----------
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

// ---------- Products ----------
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  workflowId: text('workflow_id').notNull().references(() => workflows.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  details: text('details'),
  suggestedPriceUsd: real('suggested_price_usd').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
});

// ---------- Orders ----------
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  orderNumber: integer('order_number').notNull(),
  clientId: text('client_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  currentStepId: text('current_step_id').notNull().references(() => workflowSteps.id, { onDelete: 'restrict' }),
  patientName: text('patient_name').notNull(),
  color: text('color'),
  finalPriceUsd: real('final_price_usd').notNull(),
  amountPaidUsd: real('amount_paid_usd').notNull().default(0),
  status: text('status', { enum: ['active', 'completed', 'delivered', 'cancelled'] }).notNull().default('active'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at'),
  deliveredAt: integer('delivered_at'),
});

// ---------- Order Notes ----------
export const orderNotes = sqliteTable('order_notes', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
});

// ---------- Order Step History ----------
export const orderStepHistory = sqliteTable('order_step_history', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  fromStepId: text('from_step_id').references(() => workflowSteps.id),
  toStepId: text('to_step_id').notNull().references(() => workflowSteps.id),
  movedBy: text('moved_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  movedAt: integer('moved_at').notNull(),
});

// ---------- Order Prosthesis Jobs ----------
export const orderProsthesisJobs = sqliteTable('order_prosthesis_jobs', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  patientName: text('patient_name').notNull(),
  isPatientException: integer('is_patient_exception', { mode: 'boolean' }).notNull().default(false),
  exceptionReason: text('exception_reason'),
  status: text('status', { enum: ['pending', 'completed'] }).notNull().default('pending'),
  notes: text('notes'),
  sortOrder: integer('sort_order').notNull().default(0),
  completedAt: integer('completed_at'),
  createdAt: integer('created_at').notNull(),
});

// ---------- Payments ----------
export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  currency: text('currency', { enum: ['USD', 'VES'] }).notNull(),
  amount: real('amount_original').notNull(),
  
  // Tasa comercial aplicada al cliente
  appliedExchangeRateType: text('applied_rate_type', { 
    enum: ['USD_PARALLEL', 'USD_BCV', 'EUR_BCV', 'MANUAL'] 
  }).notNull().default('USD_PARALLEL'),
  exchangeRate: real('applied_rate_value'), // Tasa aplicada para el cálculo comercial (ej. EUR BCV)
  
  // Tasa de cambio real de consolidación (USD Paralelo de ese día)
  parallelExchangeRate: real('base_rate_value').notNull().default(1.0),
  
  // Valores duales en USD
  amountUsd: real('amount_usd_cxc').notNull(), // Dólar Comercial (Deducción CxC / FIFO)
  amountRealUsd: real('amount_usd_real').notNull().default(0.0), // Dólar Real (Consolidado Maestro)
  
  paymentMethod: text('payment_method').notNull(),
  reference: text('reference'),
  paymentDate: integer('payment_date').notNull(),
  status: text('status', { enum: ['active', 'voided'] }).notNull().default('active'),
  voidedAt: integer('voided_at'),
  createdAt: integer('created_at').notNull(),
});

// ---------- Payment Allocations ----------
export const paymentAllocations = sqliteTable('payment_allocations', {
  id: text('id').primaryKey(),
  paymentId: text('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'restrict' }),
  amountUsd: real('amount_usd').notNull(),
  createdAt: integer('created_at').notNull(),
});

// ---------- Expense Categories ----------
export const expenseCategories = sqliteTable('expense_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6B7280'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

// ---------- Expenses ----------
export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  description: text('description').notNull(),
  category: text('category', { enum: ['material', 'equipo', 'servicios', 'nomina', 'otro'] }).notNull(),
  categoryId: text('category_id').references(() => expenseCategories.id),
  currency: text('currency').notNull().default('USD'),
  amountOriginal: real('amount_original'),
  
  // Nuevos campos de tasas
  appliedExchangeRateType: text('applied_rate_type', { 
    enum: ['USD_PARALLEL', 'USD_BCV', 'EUR_BCV', 'MANUAL'] 
  }),
  exchangeRate: real('applied_rate_value'), // Tasa aplicada
  parallelExchangeRate: real('base_rate_value'), // Tasa paralelo real del día
  
  // Valores duales en USD
  amountUsd: real('amount_usd_cxc').notNull(), // Monto nominal registrado
  amountRealUsd: real('amount_usd_real').notNull().default(0.0), // Monto real consolidado
  
  expenseDate: integer('expense_date').notNull(),
  notes: text('notes'),
  paymentMethod: text('payment_method'), // Cuenta/Método de pago (Zelle, Binance, Efectivo, etc.)
  isPersonal: integer('is_personal', { mode: 'boolean' }).notNull().default(false),
  isRecurring: integer('is_recurring', { mode: 'boolean' }).notNull().default(false),
  recurrenceInterval: text('recurrence_interval'),
  recurrenceTemplateId: text('recurrence_template_id'),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: integer('created_at').notNull(),
});

// ---------- Deliveries ----------
export const deliveries = sqliteTable('deliveries', {
  id: text('id').primaryKey(),
  orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
  clientId: text('client_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  deliveryUserId: text('delivery_user_id').references(() => users.id, { onDelete: 'restrict' }),
  serviceType: text('service_type', { enum: ['pickup', 'delivery'] }).notNull(),
  address: text('address').notNull(),
  coordinates: text('coordinates'),
  contactInfo: text('contact_info').notNull(),
  itemsDescription: text('items_description').notNull(),
  status: text('status', { enum: ['pending', 'proposed', 'accepted', 'completed', 'cancelled'] }).notNull().default('pending'),
  proposedAmountUsd: real('proposed_amount_usd'),
  finalAmountUsd: real('final_amount_usd'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  completedAt: integer('completed_at'),
  cancelledAt: integer('cancelled_at'),
});

// ---------- Delivery Payments ----------
export const deliveryPayments = sqliteTable('delivery_payments', {
  id: text('id').primaryKey(),
  deliveryUserId: text('delivery_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  amountUsd: real('amount_usd').notNull(),
  paymentDate: integer('payment_date').notNull(),
  reference: text('reference'),
  expenseId: text('expense_id').references(() => expenses.id, { onDelete: 'set null' }),
  createdAt: integer('created_at').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
});

// ---------- System Settings ----------
export const systemSettings = sqliteTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// ---------- Cash Closings (Arqueo de Caja) ----------
export const cashClosings = sqliteTable('cash_closings', {
  id: text('id').primaryKey(),
  closingDate: integer('closing_date').notNull(),
  closedBy: text('closed_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  zelleExpected: real('zelle_expected').notNull(),
  zelleActual: real('zelle_actual').notNull(),
  binanceExpected: real('binance_expected').notNull(),
  binanceActual: real('binance_actual').notNull(),
  efectivoExpected: real('efectivo_expected').notNull(),
  efectivoActual: real('efectivo_actual').notNull(),
  bolivaresExpected: real('bolivares_expected').notNull(),
  bolivaresActual: real('bolivares_actual').notNull(),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
});

// ---------- Treasury Accounts ----------
export const treasuryAccounts = sqliteTable('treasury_accounts', {
  id: text('id').primaryKey(), // zelle, binance, efectivo, bolivares
  name: text('name').notNull(),
  currency: text('currency', { enum: ['USD', 'VES'] }).notNull(),
  initialBalance: real('initial_balance').notNull().default(0),
  initialBalanceDate: integer('initial_balance_date').notNull(), // default timestamp for 2026-08-01
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  updatedAt: integer('updated_at').notNull(),
});

// ---------- Treasury Transfers ----------
export const treasuryTransfers = sqliteTable('treasury_transfers', {
  id: text('id').primaryKey(),
  fromAccountId: text('from_account_id').notNull().references(() => treasuryAccounts.id),
  toAccountId: text('to_account_id').notNull().references(() => treasuryAccounts.id),
  amountFrom: real('amount_from').notNull(),
  currencyFrom: text('currency_from', { enum: ['USD', 'VES'] }).notNull(),
  amountTo: real('amount_to').notNull(),
  currencyTo: text('currency_to', { enum: ['USD', 'VES'] }).notNull(),
  exchangeRate: real('exchange_rate'),
  transferDate: integer('transfer_date').notNull(),
  reference: text('reference'),
  notes: text('notes'),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: integer('created_at').notNull(),
});

// ---------- Treasury Adjustments ----------
export const treasuryAdjustments = sqliteTable('treasury_adjustments', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => treasuryAccounts.id),
  type: text('type', { enum: ['inflow', 'outflow'] }).notNull(), // 'inflow' (+) or 'outflow' (-)
  amount: real('amount').notNull(),
  currency: text('currency', { enum: ['USD', 'VES'] }).notNull(),
  reason: text('reason').notNull(), // Motivo obligatorio del ajuste
  notes: text('notes'),
  adjustmentDate: integer('adjustment_date').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: integer('created_at').notNull(),
});


// ==========================================
// RELATIONS
// ==========================================

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  payments: many(payments),
  orderNotes: many(orderNotes),
  deliveriesClient: many(deliveries, { relationName: 'clientDeliveries' }),
  deliveriesAssigned: many(deliveries, { relationName: 'assignedDeliveries' }),
  deliveryPayments: many(deliveryPayments),
}));

export const workflowsRelations = relations(workflows, ({ many }) => ({
  steps: many(workflowSteps),
  products: many(products),
}));

export const workflowStepsRelations = relations(workflowSteps, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowSteps.workflowId],
    references: [workflows.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  workflow: one(workflows, {
    fields: [products.workflowId],
    references: [workflows.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  client: one(users, {
    fields: [orders.clientId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [orders.productId],
    references: [products.id],
  }),
  currentStep: one(workflowSteps, {
    fields: [orders.currentStepId],
    references: [workflowSteps.id],
  }),
  notes: many(orderNotes),
  stepHistory: many(orderStepHistory),
  allocations: many(paymentAllocations),
  prosthesisJobs: many(orderProsthesisJobs),
}));

export const orderNotesRelations = relations(orderNotes, ({ one }) => ({
  order: one(orders, {
    fields: [orderNotes.orderId],
    references: [orders.id],
  }),
  user: one(users, {
    fields: [orderNotes.userId],
    references: [users.id],
  }),
}));

export const orderStepHistoryRelations = relations(orderStepHistory, ({ one }) => ({
  order: one(orders, {
    fields: [orderStepHistory.orderId],
    references: [orders.id],
  }),
  fromStep: one(workflowSteps, {
    fields: [orderStepHistory.fromStepId],
    references: [workflowSteps.id],
    relationName: 'fromStep',
  }),
  toStep: one(workflowSteps, {
    fields: [orderStepHistory.toStepId],
    references: [workflowSteps.id],
    relationName: 'toStep',
  }),
  user: one(users, {
    fields: [orderStepHistory.movedBy],
    references: [users.id],
  }),
}));

export const orderProsthesisJobsRelations = relations(orderProsthesisJobs, ({ one }) => ({
  order: one(orders, {
    fields: [orderProsthesisJobs.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderProsthesisJobs.productId],
    references: [products.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  client: one(users, {
    fields: [payments.clientId],
    references: [users.id],
  }),
  allocations: many(paymentAllocations),
}));

export const paymentAllocationsRelations = relations(paymentAllocations, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentAllocations.paymentId],
    references: [payments.id],
  }),
  order: one(orders, {
    fields: [paymentAllocations.orderId],
    references: [orders.id],
  }),
}));

export const deliveriesRelations = relations(deliveries, ({ one }) => ({
  order: one(orders, {
    fields: [deliveries.orderId],
    references: [orders.id],
  }),
  client: one(users, {
    fields: [deliveries.clientId],
    references: [users.id],
    relationName: 'clientDeliveries',
  }),
  deliveryUser: one(users, {
    fields: [deliveries.deliveryUserId],
    references: [users.id],
    relationName: 'assignedDeliveries',
  }),
  creator: one(users, {
    fields: [deliveries.createdBy],
    references: [users.id],
  }),
}));

export const deliveryPaymentsRelations = relations(deliveryPayments, ({ one }) => ({
  deliveryUser: one(users, {
    fields: [deliveryPayments.deliveryUserId],
    references: [users.id],
  }),
  expense: one(expenses, {
    fields: [deliveryPayments.expenseId],
    references: [expenses.id],
  }),
  creator: one(users, {
    fields: [deliveryPayments.createdBy],
    references: [users.id],
  }),
}));

export const cashClosingsRelations = relations(cashClosings, ({ one }) => ({
  user: one(users, {
    fields: [cashClosings.closedBy],
    references: [users.id],
  }),
}));

export const treasuryTransfersRelations = relations(treasuryTransfers, ({ one }) => ({
  fromAccount: one(treasuryAccounts, {
    fields: [treasuryTransfers.fromAccountId],
    references: [treasuryAccounts.id],
    relationName: 'fromAccount',
  }),
  toAccount: one(treasuryAccounts, {
    fields: [treasuryTransfers.toAccountId],
    references: [treasuryAccounts.id],
    relationName: 'toAccount',
  }),
  creator: one(users, {
    fields: [treasuryTransfers.createdBy],
    references: [users.id],
  }),
}));

export const treasuryAdjustmentsRelations = relations(treasuryAdjustments, ({ one }) => ({
  account: one(treasuryAccounts, {
    fields: [treasuryAdjustments.accountId],
    references: [treasuryAccounts.id],
  }),
  creator: one(users, {
    fields: [treasuryAdjustments.createdBy],
    references: [users.id],
  }),
}));
