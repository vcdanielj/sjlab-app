// ============================================
// SJ Lab — Domain Types
// ============================================

// ---------- Enums as const objects ----------

export const ORDER_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;
export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

export const PAYMENT_STATUS = {
  ACTIVE: 'active',
  VOIDED: 'voided',
} as const;
export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];

export const CURRENCY = {
  USD: 'USD',
  VES: 'VES',
} as const;
export type Currency = typeof CURRENCY[keyof typeof CURRENCY];

export const PAYMENT_METHOD = {
  CASH: 'Efectivo',
  ZELLE: 'Zelle',
  BINANCE: 'Binance',
  TRANSFER: 'Transferencia',
  MOBILE: 'Pago Móvil',
} as const;
export type PaymentMethod = typeof PAYMENT_METHOD[keyof typeof PAYMENT_METHOD];

export const USER_ROLE = {
  ADMIN: 'admin',
  TECH: 'tech',
  CLIENT: 'client',
} as const;
export type UserRole = typeof USER_ROLE[keyof typeof USER_ROLE];

// ---------- Domain Interfaces ----------

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  clinicName: string | null;
  taxId: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: number;
}

export interface Workflow {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: number;
  steps?: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Product {
  id: string;
  categoryId: string | null;
  workflowId: string;
  name: string;
  details: string | null;
  suggestedPriceUsd: number;
  isActive: boolean;
  createdAt: number;
  category?: Category;
  workflow?: Workflow;
}

export interface Order {
  id: string;
  orderNumber: number;
  clientId: string;
  productId: string;
  currentStepId: string;
  patientName: string;
  color: string | null;
  finalPriceUsd: number;
  amountPaidUsd: number;
  status: OrderStatus;
  notes: string | null;
  createdAt: number;
  completedAt: number | null;
  deliveredAt: number | null;
  client?: User;
  product?: Product;
  currentStep?: WorkflowStep;
}

export interface OrderNote {
  id: string;
  orderId: string;
  userId: string;
  content: string;
  createdAt: number;
  user?: User;
}

export interface OrderStepHistory {
  id: string;
  orderId: string;
  fromStepId: string | null;
  toStepId: string;
  movedBy: string;
  movedAt: number;
  fromStep?: WorkflowStep;
  toStep?: WorkflowStep;
  user?: User;
}

export interface Payment {
  id: string;
  clientId: string;
  currency: Currency;
  amount: number;
  exchangeRate: number | null;
  amountUsd: number;
  paymentMethod: string;
  reference: string | null;
  paymentDate: number;
  status: PaymentStatus;
  voidedAt: number | null;
  createdAt: number;
  client?: User;
  allocations?: PaymentAllocation[];
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  orderId: string;
  amountUsd: number;
  createdAt: number;
  order?: Order;
}

// ---------- API Response Types ----------

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
}

// ---------- Dashboard Types ----------

export interface KPIData {
  activeOrders: number;
  completedOrders: number;
  periodRevenue: number;
  totalReceivables: number;
  activeOrdersTrend: number;
  completedOrdersTrend: number;
  revenueTrend: number;
  receivablesTrend: number;
}

export interface ClientSummary {
  id: string;
  name: string;
  clinicName: string | null;
  activeOrders: number;
  totalBilled: number;
  totalPaid: number;
  balance: number;
  lastPaymentDate: number | null;
}

// ---------- Cash Closing Types ----------

export interface CashClosing {
  id: string;
  closingDate: number;
  closedBy: string;
  closedByName?: string;
  zelleExpected: number;
  zelleActual: number;
  binanceExpected: number;
  binanceActual: number;
  efectivoExpected: number;
  efectivoActual: number;
  bolivaresExpected: number;
  bolivaresActual: number;
  notes: string | null;
  createdAt: number;
}

// ---------- Treasury Types ----------

export interface TreasuryAccount {
  id: string; // 'zelle' | 'binance' | 'efectivo' | 'bolivares'
  name: string;
  currency: 'USD' | 'VES';
  initialBalance: number;
  initialBalanceDate: number;
  isActive: boolean;
  updatedAt: number;
}

export interface TreasuryAccountBalance {
  id: string;
  name: string;
  currency: 'USD' | 'VES';
  initialBalance: number;
  initialBalanceDate: number;
  inflows: number;
  outflows: number;
  transfersIn: number;
  transfersOut: number;
  adjustmentsIn: number;
  adjustmentsOut: number;
  currentBalance: number;
}

export interface TreasuryTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amountFrom: number;
  currencyFrom: 'USD' | 'VES';
  amountTo: number;
  currencyTo: 'USD' | 'VES';
  exchangeRate?: number | null;
  transferDate: number;
  reference?: string | null;
  notes?: string | null;
  createdBy: string;
  createdByName?: string;
  createdAt: number;
}

export interface TreasuryAdjustment {
  id: string;
  accountId: string;
  type: 'inflow' | 'outflow';
  amount: number;
  currency: 'USD' | 'VES';
  reason: string;
  notes?: string | null;
  adjustmentDate: number;
  createdBy: string;
  createdByName?: string;
  createdAt: number;
}

export interface AccountMovement {
  id: string;
  date: number;
  type: 'cobro' | 'gasto' | 'transfer_in' | 'transfer_out' | 'adjustment_in' | 'adjustment_out';
  accountId: string;
  accountName: string;
  currency: 'USD' | 'VES';
  description: string;
  reference?: string | null;
  amount: number; // positive for in, negative for out
  runningBalance: number;
  createdBy?: string;
  createdByName?: string;
}

