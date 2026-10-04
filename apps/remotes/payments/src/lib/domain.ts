export type PaymentGroup = {
  id: string;
  name: string;
  icon: string;
  color: string;
  isArchived: boolean;
  createdOn: string;
  createdAt?: Date;
};
export type Payment = {
  id: string;
  groupId: string;
  name: string;
  amount: number | null;
  paymentDay: number;
  dueDate: string | null;
  isMonthly: boolean;
  bankId: string | null;
  isArchived: boolean;
  createdOn: string;
  createdAt?: Date;
};
export type PaymentCompletion = {
  id: string;
  paymentId: string;
  groupId: string;
  year: number;
  month: number;
  paidOn: string;
  scheduledDate: string;
  bankId: string | null;
};
export type PaymentBank = {
  id: string;
  name: string;
  color: string;
  icon: string;
  isArchived: boolean;
};
export type PaymentSettings = { banks: PaymentBank[]; defaultBankId: string | null };
export type PaymentInstance = {
  payment: Payment;
  date: string;
  completion?: PaymentCompletion;
  daysUntil: number;
  status: 'paid' | 'overdue' | 'soon' | 'normal';
};

export const GROUP_COLORS = ['#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#3b82f6', '#eab308'];
export const GROUP_ICONS = ['🏠', '🚗', '📱', '💳', '🐕', '🎓', '🧾', '✨'];
export const BANK_COLORS = ['#f97316', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#eab308'];
export const BANK_ICONS = ['🏦', '💳', '💰', '🪙'];

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
export function localDateIso(date = new Date()) {
  return `${monthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addMonth(key: string, delta: number) {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return monthKey(date);
}
export function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  );
}
export function getPaymentDateForMonth(payment: Payment, key: string) {
  if (!payment.isMonthly) return payment.dueDate;
  const [year, month] = key.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${key}-${String(Math.min(payment.paymentDay, lastDay)).padStart(2, '0')}`;
}
export function dayDifference(from: string, to: string) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}
export function isVisibleInMonth(payment: Payment, key: string) {
  if (payment.isArchived || !payment.createdOn || payment.createdOn.slice(0, 7) > key) return false;
  return payment.isMonthly || payment.dueDate?.slice(0, 7) === key;
}
export function paymentInstance(
  payment: Payment,
  key: string,
  today = new Date(),
  completion?: PaymentCompletion,
): PaymentInstance | null {
  const date = getPaymentDateForMonth(payment, key);
  if (!date || !isVisibleInMonth(payment, key)) return null;
  const diff = dayDifference(
    localDateIso(today),
    date,
  );
  return {
    payment,
    date,
    completion,
    daysUntil: diff,
    status: completion ? 'paid' : diff < 0 ? 'overdue' : diff <= 3 ? 'soon' : 'normal',
  };
}
export function formatDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(
    new Date(year, month - 1, day),
  );
}
export function money(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
}
export function completionId(paymentId: string, key: string) {
  return `${paymentId}_${key}`;
}
