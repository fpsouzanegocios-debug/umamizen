import { FixedCost, FixedCostPayment, DateRange } from '../types';
import { isDateInRange } from './dateUtils';

export interface ResolvedFixedCost extends FixedCost {
  originalId: string;
  year_month: string;
  is_recurring: boolean;
}

/**
 * Returns number of days in a specific year and month (1-indexed month: 1=Jan, 12=Dec).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculates the due date for a specific month/year, keeping the original day of month.
 * If the month has fewer days (e.g. Feb 28), it clamps to the last day of that month.
 */
export function getMonthlyDueDate(originalDueDate: string, targetYear: number, targetMonth: number): string {
  if (!originalDueDate || !/^\d{4}-\d{2}-\d{2}$/.test(originalDueDate)) {
    return `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
  }

  const parts = originalDueDate.split('-').map(Number);
  const origDay = parts[2] || 1;
  const maxDays = getDaysInMonth(targetYear, targetMonth);
  const clampedDay = Math.min(origDay, maxDays);

  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Checks if a fixed cost is active in a given target year and month.
 * Rules:
 * - Begins from the month/year of registration (due_date) onwards.
 * - If recurrence is 'one_time', only valid for its specific month.
 * - If recurrence is 'yearly', valid every year on its specific month.
 * - If recurrence is 'monthly' (default), valid for every month from start onward.
 */
export function isFixedCostActiveInMonth(cost: FixedCost, targetYear: number, targetMonth: number): boolean {
  if (!cost.due_date || !/^\d{4}-\d{2}-\d{2}$/.test(cost.due_date)) {
    return true;
  }

  const [startYear, startMonth] = cost.due_date.split('-').map(Number);

  // Does not apply to months prior to registration
  if (targetYear < startYear || (targetYear === startYear && targetMonth < startMonth)) {
    return false;
  }

  if (cost.recurrence === 'one_time') {
    return targetYear === startYear && targetMonth === startMonth;
  }

  if (cost.recurrence === 'yearly') {
    return targetMonth === startMonth;
  }

  // Monthly (default)
  return true;
}

/**
 * Resolves a fixed cost for a specific target month, calculating its due date
 * and looking up its payment status for that specific month.
 */
export function resolveFixedCostForMonth(
  cost: FixedCost,
  targetYear: number,
  targetMonth: number,
  payments: FixedCostPayment[] = []
): ResolvedFixedCost {
  const ym = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
  const calculatedDueDate = getMonthlyDueDate(cost.due_date, targetYear, targetMonth);

  // Check payment for this specific month
  const paymentRecord = payments.find(
    (p) => p.fixed_cost_id === cost.id && p.year_month === ym
  );

  let isPaid: boolean;
  let paymentDate: string | undefined = undefined;
  let paymentMethod: string = cost.payment_method || 'PIX';

  if (paymentRecord) {
    isPaid = Boolean(paymentRecord.is_paid);
    paymentDate = paymentRecord.payment_date || undefined;
    if (paymentRecord.payment_method) {
      paymentMethod = paymentRecord.payment_method;
    }
  } else {
    // If it's the original month and no separate payment record exists yet,
    // fallback to the cost's base is_paid flag.
    const origYM = cost.due_date ? cost.due_date.slice(0, 7) : '';
    if (origYM === ym) {
      isPaid = Boolean(cost.is_paid);
      paymentDate = cost.payment_date;
    } else {
      // Future or other months start as unpaid
      isPaid = false;
    }
  }

  return {
    ...cost,
    id: cost.id,
    originalId: cost.id,
    year_month: ym,
    due_date: calculatedDueDate,
    is_paid: isPaid,
    payment_date: paymentDate,
    payment_method: paymentMethod,
    is_recurring: cost.recurrence !== 'one_time'
  };
}

/**
 * Resolves all fixed costs that are active for a specific year and month.
 */
export function getFixedCostsForSingleMonth(
  fixedCosts: FixedCost[],
  payments: FixedCostPayment[] = [],
  targetYear: number,
  targetMonth: number
): ResolvedFixedCost[] {
  return fixedCosts
    .filter((fc) => isFixedCostActiveInMonth(fc, targetYear, targetMonth))
    .map((fc) => resolveFixedCostForMonth(fc, targetYear, targetMonth, payments));
}

/**
 * Returns all resolved fixed costs that fall within a given DateRange or month.
 * IMPORTANT: Fixed costs are structural monthly costs of the operation.
 * They belong to the entire month and MUST ALWAYS be included in financial calculations
 * (like Lucro Real and DRE) for the selected month/period, regardless of whether their
 * specific calendar due date has arrived or falls inside a partial date range.
 */
export function getResolvedFixedCostsForPeriod(
  fixedCosts: FixedCost[],
  payments: FixedCostPayment[] = [],
  dateRange?: DateRange,
  selectedMonth?: number,
  selectedYear?: number
): ResolvedFixedCost[] {
  if (!fixedCosts || fixedCosts.length === 0) return [];

  if (dateRange) {
    const sDate = new Date(dateRange.startDate);
    const eDate = new Date(dateRange.endDate);

    const sYear = sDate.getFullYear();
    const sMonth = sDate.getMonth() + 1;
    const eYear = eDate.getFullYear();
    const eMonth = eDate.getMonth() + 1;

    const results: ResolvedFixedCost[] = [];

    // Iterate through all months within the range
    let curYear = sYear;
    let curMonth = sMonth;

    while (curYear < eYear || (curYear === eYear && curMonth <= eMonth)) {
      const activeInMonth = fixedCosts.filter((fc) =>
        isFixedCostActiveInMonth(fc, curYear, curMonth)
      );

      for (const fc of activeInMonth) {
        const resolved = resolveFixedCostForMonth(fc, curYear, curMonth, payments);
        results.push(resolved);
      }

      curMonth++;
      if (curMonth > 12) {
        curMonth = 1;
        curYear++;
      }
    }

    return results;
  }

  if (selectedMonth && selectedYear) {
    return getFixedCostsForSingleMonth(fixedCosts, payments, selectedYear, selectedMonth);
  }

  // Fallback: current month
  const now = new Date();
  return getFixedCostsForSingleMonth(fixedCosts, payments, now.getFullYear(), now.getMonth() + 1);
}

/**
 * Computes the total fixed costs for a period.
 */
export function calculateFixedCostsTotal(
  fixedCosts: FixedCost[],
  payments: FixedCostPayment[] = [],
  dateRange?: DateRange,
  selectedMonth?: number,
  selectedYear?: number
): number {
  const resolved = getResolvedFixedCostsForPeriod(
    fixedCosts,
    payments,
    dateRange,
    selectedMonth,
    selectedYear
  );
  return resolved.reduce((acc, fc) => acc + Number(fc.amount || 0), 0);
}
