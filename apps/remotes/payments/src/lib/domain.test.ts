import { describe, expect, it } from 'vitest';
import {
  dayDifference,
  getPaymentDateForMonth,
  isVisibleInMonth,
  paymentInstance,
  type Payment,
} from './domain';

function recurring(paymentDay: number, overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'internet',
    groupId: 'home',
    name: 'Интернет',
    amount: 1000,
    paymentDay,
    dueDate: null,
    isMonthly: true,
    bankId: null,
    isArchived: false,
    createdOn: '2026-01-01',
    ...overrides,
  };
}

describe('payment calendar', () => {
  it('clamps monthly dates to the last day in short months', () => {
    expect(getPaymentDateForMonth(recurring(31), '2026-02')).toBe('2026-02-28');
    expect(getPaymentDateForMonth(recurring(31), '2024-02')).toBe('2024-02-29');
    expect(getPaymentDateForMonth(recurring(31), '2026-04')).toBe('2026-04-30');
    expect(getPaymentDateForMonth(recurring(31), '2026-03')).toBe('2026-03-31');
  });

  it('shows a one-time payment only in its scheduled month', () => {
    const oneOff = recurring(25, {
      isMonthly: false,
      dueDate: '2026-10-25',
      createdOn: '2026-10-04',
    });
    expect(isVisibleInMonth(oneOff, '2026-10')).toBe(true);
    expect(isVisibleInMonth(oneOff, '2026-11')).toBe(false);
    expect(isVisibleInMonth(oneOff, '2026-09')).toBe(false);
  });

  it('does not show a recurring payment before its creation month', () => {
    expect(isVisibleInMonth(recurring(7, { createdOn: '2026-10-04' }), '2026-09')).toBe(false);
    expect(isVisibleInMonth(recurring(7, { createdOn: '2026-10-04' }), '2026-10')).toBe(true);
  });

  it('computes calendar-day distance and due status', () => {
    expect(dayDifference('2026-10-04', '2026-10-05')).toBe(1);
    expect(dayDifference('2026-10-04', '2026-10-01')).toBe(-3);
    expect(paymentInstance(recurring(4), '2026-10', new Date(2026, 9, 4))?.status).toBe('soon');
    expect(paymentInstance(recurring(7), '2026-10', new Date(2026, 9, 4))?.status).toBe('soon');
    expect(paymentInstance(recurring(9), '2026-10', new Date(2026, 9, 4))?.status).toBe('normal');
    expect(paymentInstance(recurring(1), '2026-10', new Date(2026, 9, 4))?.status).toBe('overdue');
  });

  it('marks a month paid from its completion record', () => {
    const entry = {
      id: 'internet_2026-10',
      paymentId: 'internet',
      groupId: 'home',
      year: 2026,
      month: 10,
      paidOn: '2026-10-04',
      scheduledDate: '2026-10-07',
      bankId: 'bank-1',
    };
    expect(paymentInstance(recurring(7), '2026-10', new Date(2026, 9, 4), entry)?.status).toBe(
      'paid',
    );
    expect(
      paymentInstance(recurring(7), '2026-11', new Date(2026, 9, 4))?.completion,
    ).toBeUndefined();
  });
});
