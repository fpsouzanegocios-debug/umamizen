import { DateRange } from '../types';

export const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const MONTH_NAMES_SHORT_PT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez'
];

export const WEEKDAYS_SHORT_PT = ['Do', 'Se', 'Te', 'Qu', 'Qu', 'Se', 'Sá'];

export interface PresetOption {
  key: string;
  label: string;
  getRange: (referenceDate?: Date) => { startDate: Date; endDate: Date };
}

/**
 * Normalizes start of a day to 00:00:00.000
 */
export const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Normalizes end of a day to 23:59:59.999
 */
export const endOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Formats a Date to DD/MM/AAAA
 */
export const formatDateBR = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Returns a timezone-safe YYYY-MM-DD date key based on local year, month and day
 */
export const getLocalDateKey = (date: Date = new Date()): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};


/**
 * Formats a Date to DD/MM/AAAA HH:mm
 */
export const formatDateTimeBR = (date: Date): string => {
  const dateStr = formatDateBR(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${dateStr} ${hours}:${mins}`;
};

/**
 * Formats a Date to HH:mm
 */
export const formatTimeBR = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
};

/**
 * Checks if a given date string or Date is within the specified DateRange
 */
export const isDateInRange = (
  dateInput: string | Date | null | undefined,
  range: DateRange
): boolean => {
  if (!dateInput) return false;
  let d: Date;
  if (typeof dateInput === 'string') {
    // If format is YYYY-MM-DD without time, parse in local time
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [year, month, day] = dateInput.split('-').map(Number);
      d = new Date(year, month - 1, day, 12, 0, 0);
    } else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(dateInput)) {
      d = new Date(dateInput.replace(' ', 'T'));
    } else {
      d = new Date(dateInput);
    }
  } else {
    d = dateInput;
  }

  if (isNaN(d.getTime())) return false;
  const time = d.getTime();
  return time >= range.startDate.getTime() && time <= range.endDate.getTime();
};

/**
 * Generates the list of 12 date presets matching the user's requirements.
 * Always defaults to current real clock time (new Date()).
 */
export const getPresetOptions = (refDate?: Date): PresetOption[] => {
  const getRef = () => refDate || new Date();
  const now = getRef();

  // Month labels for M-2, M-3, M-4
  const getPastMonth = (offsetMonths: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() - offsetMonths, 1);
    const monthName = MONTH_NAMES_PT[d.getMonth()];
    const year = d.getFullYear();
    return {
      label: `${monthName}/${year}`,
      getRange: () => ({
        startDate: startOfDay(new Date(year, d.getMonth(), 1)),
        endDate: endOfDay(new Date(year, d.getMonth() + 1, 0))
      })
    };
  };

  const m2 = getPastMonth(2);
  const m3 = getPastMonth(3);
  const m4 = getPastMonth(4);

  return [
    {
      key: 'today',
      label: 'Hoje',
      getRange: (refParam?: Date) => {
        const ref = refParam || getRef();
        return {
          startDate: startOfDay(ref),
          endDate: endOfDay(ref)
        };
      }
    },
    {
      key: 'yesterday',
      label: 'Ontem',
      getRange: (refParam?: Date) => {
        const ref = refParam || getRef();
        const d = new Date(ref);
        d.setDate(d.getDate() - 1);
        return {
          startDate: startOfDay(d),
          endDate: endOfDay(d)
        };
      }
    },
    {
      key: 'this_week',
      label: 'Esta semana',
      getRange: (refParam?: Date) => {
        const ref = refParam || getRef();
        const d = new Date(ref);
        const day = d.getDay(); // 0 is Sunday
        const diffToMonday = day === 0 ? -6 : 1 - day; // Brazilian business week starts Monday
        const monday = new Date(d);
        monday.setDate(d.getDate() + diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return {
          startDate: startOfDay(monday),
          endDate: endOfDay(sunday)
        };
      }
    },
    {
      key: 'last_week',
      label: 'Semana passada',
      getRange: (refParam?: Date) => {
        const ref = refParam || getRef();
        const d = new Date(ref);
        const day = d.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const lastMonday = new Date(d);
        lastMonday.setDate(d.getDate() + diffToMonday - 7);
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        return {
          startDate: startOfDay(lastMonday),
          endDate: endOfDay(lastSunday)
        };
      }
    },
    {
      key: 'this_month',
      label: 'Este mês',
      getRange: (refParam?: Date) => {
        const ref = refParam || getRef();
        return {
          startDate: startOfDay(new Date(ref.getFullYear(), ref.getMonth(), 1)),
          endDate: endOfDay(new Date(ref.getFullYear(), ref.getMonth() + 1, 0))
        };
      }
    },
    {
      key: 'last_month',
      label: 'Mês passado',
      getRange: (refParam?: Date) => {
        const ref = refParam || getRef();
        return {
          startDate: startOfDay(new Date(ref.getFullYear(), ref.getMonth() - 1, 1)),
          endDate: endOfDay(new Date(ref.getFullYear(), ref.getMonth(), 0))
        };
      }
    },
    {
      key: 'past_month_2',
      label: m2.label,
      getRange: m2.getRange
    },
    {
      key: 'past_month_3',
      label: m3.label,
      getRange: m3.getRange
    },
    {
      key: 'past_month_4',
      label: m4.label,
      getRange: m4.getRange
    },
    {
      key: 'last_2_months',
      label: 'Últimos 2 meses',
      getRange: (refParam?: Date) => {
        const ref = refParam || getRef();
        return {
          startDate: startOfDay(new Date(ref.getFullYear(), ref.getMonth() - 1, 1)),
          endDate: endOfDay(new Date(ref.getFullYear(), ref.getMonth() + 1, 0))
        };
      }
    },
    {
      key: 'last_3_months',
      label: 'Últimos 3 meses',
      getRange: (refParam?: Date) => {
        const ref = refParam || getRef();
        return {
          startDate: startOfDay(new Date(ref.getFullYear(), ref.getMonth() - 2, 1)),
          endDate: endOfDay(new Date(ref.getFullYear(), ref.getMonth() + 1, 0))
        };
      }
    },
    {
      key: 'last_6_months',
      label: 'Últimos 6 meses',
      getRange: (refParam?: Date) => {
        const ref = refParam || getRef();
        return {
          startDate: startOfDay(new Date(ref.getFullYear(), ref.getMonth() - 5, 1)),
          endDate: endOfDay(new Date(ref.getFullYear(), ref.getMonth() + 1, 0))
        };
      }
    }
  ];
};

/**
 * Calendar Day cell structure
 */
export interface CalendarDay {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  dateKey: string; // YYYY-MM-DD
}

/**
 * Generates a 42-day matrix (6 weeks x 7 days) starting Sunday (Do)
 */
export const getCalendarMonthMatrix = (year: number, monthIndex: number): CalendarDay[] => {
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const days: CalendarDay[] = [];

  // Start date from previous month Sunday
  const startDate = new Date(year, monthIndex, 1 - startDayOfWeek);

  for (let i = 0; i < 42; i++) {
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    const dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    days.push({
      date: current,
      dayNumber: current.getDate(),
      isCurrentMonth: current.getMonth() === monthIndex,
      isToday: dateKey === todayKey,
      dateKey
    });
  }

  return days;
};

/**
 * Default date range for the system
 */
export const getDefaultDateRange = (): DateRange => {
  // Use September 2026 as active default matching user's database records
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  return {
    startDate: startOfDay(new Date(year, month, 1)),
    endDate: endOfDay(new Date(year, month + 1, 0)),
    label: `${MONTH_NAMES_PT[month]}/${year}`,
    presetKey: 'this_month'
  };
};
