export type ChannelType = 'iFood' | 'AiqFome' | 'Cardápio Digital' | 'Balcão / WhatsApp' | string;

export type PaymentMethod = 
  | 'Cartão de crédito'
  | 'Cartão de débito'
  | 'Pix'
  | 'Pix automático'
  | 'Dinheiro'
  | 'iFood'
  | 'AiqFome'
  | string;

export type OrderAdjustmentType = 'free_delivery' | 'coupon' | 'none' | 'custom';

export interface SystemSettings {
  id: number;
  ifood_fee_pct: number;
  aiqfome_fee_pct: number;
  card_debit_fee_pct: number;
  card_credit_fee_pct: number;
  site_free_shipping_cost: number;
  coupon_suggested_amount: number;
  courier_base_rate: number;
  freelancer_default_rate: number;
  fixed_closed_day: string;
  payable_alert_days: number;
  updated_at: string;
}

export interface NeighborhoodRate {
  id: string;
  name: string;
  normalized_name: string;
  total_rate: number;
  base_rate: number;
  additional_rate: number;
  is_blocked: boolean;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface NeighborhoodAlias {
  id: string;
  raw_name: string;
  normalized_raw_name: string;
  neighborhood_rate_id: string;
  is_confirmed: boolean;
  created_at: string;
  neighborhood_rate?: NeighborhoodRate;
}

export interface Courier {
  id: string;
  name: string;
  phone?: string;
  pix_key?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  external_order_id: string;
  customer_name: string;
  customer_phone?: string;
  order_date: string;
  channel: ChannelType;
  original_payment_method: string;
  final_payment_method: string;
  status: string;
  is_canceled: boolean;
  gross_amount: number;
  original_gross_amount: number;
  platform_fee_pct: number;
  platform_fee_amount: number;
  card_fee_pct: number;
  card_fee_amount: number;
  adjustment_type: OrderAdjustmentType;
  adjustment_amount: number;
  net_amount: number;
  neighborhood_id?: string;
  neighborhood_name?: string;
  courier_id?: string;
  courier_name?: string;
  delivery_fee?: number;
  neighborhood_fee?: number;
  normal_delivery_fee?: number;
  is_free_delivery?: boolean;
  free_delivery_cost?: number;
  coupon_amount?: number;
  coupon_name?: string;
  coupon_already_discounted?: boolean;
  has_pending_issue: boolean;
  pending_issue_reason?: string;
  is_manually_edited: boolean;
  manual_edit_at?: string;
  manual_edit_user?: string;
  original_imported_data?: Record<string, any>;
  notes?: string;
  import_batch_id?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderChangeHistory {
  id: string;
  order_id: string;
  field_name: string;
  old_value?: string;
  new_value?: string;
  changed_by: string;
  changed_at: string;
}

export interface Delivery {
  id: string;
  external_order_id: string;
  order_number?: string;
  order_id?: string;
  courier_id?: string;
  courier_name: string;
  delivery_date: string;
  order_amount: number;
  payment_method?: string;
  neighborhood_name?: string;
  neighborhood_rate_id?: string;
  neighborhood_total_rate: number;
  base_rate: number;
  additional_rate: number;
  courier_fee: number;
  status: string;
  is_manually_edited: boolean;
  has_pending_issue: boolean;
  pending_issue_reason?: string;
  notes?: string;
  import_batch_id?: string;
  created_at: string;
  updated_at: string;
  is_paid?: boolean;
  payment_id?: string;
  is_return?: boolean;
}

export interface ImportBatch {
  id: string;
  batch_date: string;
  file_type: string;
  filename: string;
  total_records: number;
  notes?: string;
  created_at: string;
}

export interface CourierDailyPayment {
  id: string;
  courier_id?: string | null;
  courier_name: string;
  payment_date: string;
  total_deliveries?: number;
  delivery_count?: number;
  base_amount?: number;
  base_total?: number;
  additional_amount?: number;
  additional_total?: number;
  total_amount?: number;
  paid_amount: number;
  total_paid?: number;
  payment_method: string;
  is_paid: boolean;
  paid_at?: string;
  paid_by?: string;
  notes?: string;
  retained_cash?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AccountsPayable {
  id: string;
  due_date: string;
  supplier: string;
  description: string;
  installment_number: number;
  total_installments: number;
  group_id?: string;
  amount: number;
  original_amount?: number;
  interest_amount?: number;
  status: 'pending' | 'paid' | 'due_today' | 'overdue';
  is_paid: boolean;
  payment_date?: string;
  payment_method?: string;
  category: string;
  notes?: string;
  linked_cash_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Freelancer {
  id: string;
  name: string;
  default_hourly_rate: number;
  is_active: boolean;
  pix_key?: string;
  phone?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FreelancerShift {
  id: string;
  shift_date: string;
  freelancer_id: string;
  freelancer?: Freelancer;
  start_time: string;
  end_time: string;
  break_minutes: number;
  hours_worked: number;
  hourly_rate: number;
  total_amount: number;
  payment_status: 'pending' | 'partially_paid' | 'paid';
  paid_amount: number;
  balance_due: number;
  payment_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FreelancerPayment {
  id: string;
  freelancer_id: string;
  shift_id?: string;
  payment_date: string;
  amount: number;
  payment_method?: string;
  notes?: string;
  linked_cash_id?: string;
  created_at: string;
}

export interface Investment {
  id: string;
  investment_date: string;
  category: string;
  supplier?: string;
  description: string;
  installment_number: number;
  total_installments: number;
  group_id?: string;
  amount: number;
  status: 'paid' | 'pending';
  payment_date?: string;
  payment_method?: string;
  notes?: string;
  linked_cash_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CashTransaction {
  id: string;
  transaction_date: string;
  type: 'inflow' | 'outflow';
  category: string;
  description: string;
  amount: number;
  payment_method?: string;
  origin_type: 'manual' | 'accounts_payable' | 'investments' | 'couriers' | 'freelancers';
  origin_id?: string;
  notes?: string;
  created_at: string;
}

export interface CashInitialBalance {
  id: string;
  balance_date: string;
  initial_amount: number;
  notes?: string;
  created_at: string;
}

export interface MonthlyGoal {
  id: string;
  year: number;
  month: number;
  target_amount: number;
  created_at: string;
  updated_at: string;
}

export interface ClosedDay {
  id: string;
  closed_date: string;
  reason?: string;
  created_at: string;
}

export interface PendingIssue {
  id: string;
  issue_type: 'sale_without_delivery' | 'delivery_without_sale' | 'unknown_neighborhood' | 'blocked_neighborhood' | 'order_without_courier' | 'manual_edit';
  reference_type: 'order' | 'delivery' | 'neighborhood';
  reference_id: string;
  description: string;
  status: 'open' | 'resolved' | 'ignored';
  resolution_notes?: string;
  created_at: string;
  resolved_at?: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
  presetKey?: string;
}

export interface FixedCost {
  id: string;
  name: string;
  category: string;
  amount: number;
  due_date: string;
  recurrence?: 'monthly' | 'yearly' | 'one_time';
  is_paid: boolean;
  payment_date?: string;
  payment_method?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export type DateFilterCategory = 
  | 'dashboard' 
  | 'performance'
  | 'orders' 
  | 'couriers' 
  | 'payables' 
  | 'freelancers' 
  | 'investments' 
  | 'cash' 
  | 'goals'
  | 'fixed_costs';


