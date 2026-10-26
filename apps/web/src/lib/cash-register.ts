export interface CashSnapshot {
  balances: Record<string, string>;
  expenses: Record<string, string>;
  received: Record<string, string>;
  refunds: Record<string, string>;
  fingerprint: string;
}
export interface CashShiftView {
  id: string;
  responsible_user_id: string;
  opened_at: string;
  closed_at: string | null;
  opening: { snapshot: CashSnapshot; counted: string; note: string };
  closing: {
    expected: string;
    counted: string;
    difference: string;
    retained: string;
    plannedHandover: string;
    note: string;
  } | null;
}
export interface CashRegisterView {
  registerId: string;
  name: string;
  currency: string;
  timezone: string;
  snapshot: CashSnapshot;
  active: CashShiftView | null;
  history: CashShiftView[];
  totals: {
    received: Record<string, string>;
    refunds: Record<string, string>;
    expenses: Record<string, string>;
  } | null;
  incomeMethods: string[];
  expenseMethods: string[];
  mayOperate: boolean;
  mayManage: boolean;
  currentUserId: string;
  cashierIds: string[];
  members: Array<{ id: string; name: string }>;
  handovers: Array<{ id: string; recipient_id: string; amount: string; shift_id: string }>;
}
