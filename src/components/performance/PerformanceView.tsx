import React, { useState, useMemo, useCallback } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingBag, 
  Bike, 
  Receipt, 
  Building2, 
  Users, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus, 
  Calendar,
  Percent,
  PieChart,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Sparkles,
  Wallet,
  CalendarRange,
  Clock
} from 'lucide-react';
import { 
  Order, 
  Delivery, 
  AccountsPayable, 
  FixedCost, 
  FreelancerShift, 
  Investment, 
  CashTransaction,
  SystemSettings,
  DateRange
} from '../../types';
import { formatCurrency, formatPercent, formatDate } from '../../lib/formatters';
import { 
  MONTH_NAMES_PT, 
  isDateInRange, 
  formatDateBR, 
  startOfDay, 
  endOfDay, 
  getDefaultDateRange 
} from '../../lib/dateUtils';
import { DateRangePicker } from '../common/DateRangePicker';

interface PerformanceViewProps {
  orders: Order[];
  deliveries: Delivery[];
  payables: AccountsPayable[];
  fixedCosts?: FixedCost[];
  shifts: FreelancerShift[];
  investments: Investment[];
  cashTransactions?: CashTransaction[];
  settings: SystemSettings;
  selectedMonth: number;
  selectedYear: number;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  onRefresh: () => void;
}

type PerformanceTab = 'dre' | 'platforms' | 'expenses' | 'annual';

interface PeriodMetrics {
  month?: number;
  year?: number;
  label: string;
  startDate: Date;
  endDate: Date;
  orderCount: number;
  grossRevenue: number;
  platformFees: number;
  cardFees: number;
  adjustments: number;
  totalDeductions: number;
  netRevenue: number;
  avgTicket: number;
  cogsPayables: number;
  interestPayables: number;
  baseInsumos: number;
  cashOutflows: number;
  cashOutflowCategories: Record<string, number>;
  courierCost: number;
  courierTotalFeePaid: number;
  deliveryCount: number;
  freelancerCost: number;
  totalVariableCosts: number;
  contributionMargin: number;
  contributionMarginPct: number;
  fixedCostsTotal: number;
  investmentsTotal: number;
  totalStructuralCosts: number;
  operatingProfit: number;
  operatingProfitMarginPct: number;
  netFinalProfit: number;
  netFinalProfitMarginPct: number;
  channels: Record<string, {
    orderCount: number;
    gross: number;
    mixPct: number;
    platformFees: number;
    effectiveFeePct: number;
    cardFees: number;
    adjustments: number;
    netRevenue: number;
    netMarginPct: number;
    avgTicket: number;
  }>;
}

export const PerformanceView: React.FC<PerformanceViewProps> = ({
  orders,
  deliveries,
  payables,
  fixedCosts = [],
  shifts,
  investments,
  cashTransactions = [],
  settings,
  selectedMonth,
  selectedYear,
  dateRange,
  onDateRangeChange,
  onRefresh
}) => {
  const [activeSubTab, setActiveSubTab] = useState<PerformanceTab>('dre');
  const [filterMode, setFilterMode] = useState<'range' | 'months'>('range');

  // Internal range state when dateRange is not controlled from parent
  const [internalRange, setInternalRange] = useState<DateRange>(() => dateRange || getDefaultDateRange());

  const currentRange = dateRange || internalRange;

  const handleRangeChange = useCallback((newRange: DateRange) => {
    setInternalRange(newRange);
    if (onDateRangeChange) {
      onDateRangeChange(newRange);
    }
  }, [onDateRangeChange]);

  // Comparison period state for 'months' mode
  const [refMonth, setRefMonth] = useState<number>(selectedMonth || 9);
  const [refYear, setRefYear] = useState<number>(selectedYear || 2026);

  const defaultCompMonth = refMonth === 1 ? 12 : refMonth - 1;
  const defaultCompYear = refMonth === 1 ? refYear - 1 : refYear;

  const [compMonth, setCompMonth] = useState<number>(defaultCompMonth);
  const [compYear, setCompYear] = useState<number>(defaultCompYear);

  // Month selector options
  const monthOptions = useMemo(() => {
    return MONTH_NAMES_PT.map((name, idx) => ({
      value: idx + 1,
      label: name
    }));
  }, []);

  const yearOptions = [2025, 2026, 2027];

  // Helper to compute comparison range matching the length of the selected range
  const computeComparisonRange = (range: DateRange): DateRange => {
    const start = range.startDate;
    const end = range.endDate;
    
    // Check if it's exactly a full calendar month (1st day to last day)
    const isFirstDay = start.getDate() === 1;
    const lastDayOfMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const isLastDay = end.getDate() === lastDayOfMonth && end.getMonth() === start.getMonth() && end.getFullYear() === start.getFullYear();

    if (isFirstDay && isLastDay) {
      const prevMonth = start.getMonth() === 0 ? 11 : start.getMonth() - 1;
      const prevYear = start.getMonth() === 0 ? start.getFullYear() - 1 : start.getFullYear();
      const prevStart = startOfDay(new Date(prevYear, prevMonth, 1));
      const prevEnd = endOfDay(new Date(prevYear, prevMonth + 1, 0));
      return {
        startDate: prevStart,
        endDate: prevEnd,
        label: `${MONTH_NAMES_PT[prevMonth]}/${prevYear}`
      };
    }

    // Check if single day
    if (start.toDateString() === end.toDateString()) {
      const prevDay = new Date(start);
      prevDay.setDate(prevDay.getDate() - 1);
      return {
        startDate: startOfDay(prevDay),
        endDate: endOfDay(prevDay),
        label: `${formatDateBR(prevDay)} (Dia ant.)`
      };
    }

    // Arbitrary period: preceding period of equal length
    const durationMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);

    return {
      startDate: startOfDay(prevStart),
      endDate: endOfDay(prevEnd),
      label: `${formatDateBR(prevStart)} a ${formatDateBR(prevEnd)} (Período ant.)`
    };
  };

  // Helper to compute metrics for any given DateRange
  const computeMetricsForRange = (range: DateRange, labelOverride?: string): PeriodMetrics => {
    const label = labelOverride || range.label || `${formatDateBR(range.startDate)} a ${formatDateBR(range.endDate)}`;

    // 1. Orders within range
    const periodOrders = orders.filter((o) => {
      if (o.is_canceled) return false;
      return isDateInRange(o.order_date, range);
    });

    const orderCount = periodOrders.length;
    const grossRevenue = periodOrders.reduce((acc, o) => acc + Number(o.gross_amount || 0), 0);
    const platformFees = periodOrders.reduce((acc, o) => acc + Number(o.platform_fee_amount || 0), 0);
    const cardFees = periodOrders.reduce((acc, o) => acc + Number(o.card_fee_amount || 0), 0);
    const adjustments = periodOrders.reduce((acc, o) => acc + Number(o.adjustment_amount || 0), 0);
    const totalDeductions = platformFees + cardFees + adjustments;
    const netRevenue = grossRevenue - totalDeductions;
    const avgTicket = orderCount > 0 ? grossRevenue / orderCount : 0;

    // Channels breakdown
    const channelList = ['Cardápio Digital', 'iFood', 'AiqFome', 'Balcão / WhatsApp'];
    const channelsData: PeriodMetrics['channels'] = {};

    channelList.forEach((cName) => {
      const cOrders = periodOrders.filter((o) => (o.channel || '').toLowerCase() === cName.toLowerCase() || (cName === 'Cardápio Digital' && !o.channel));
      const cCount = cOrders.length;
      const cGross = cOrders.reduce((acc, o) => acc + Number(o.gross_amount || 0), 0);
      const cPlatformFees = cOrders.reduce((acc, o) => acc + Number(o.platform_fee_amount || 0), 0);
      const cCardFees = cOrders.reduce((acc, o) => acc + Number(o.card_fee_amount || 0), 0);
      const cAdj = cOrders.reduce((acc, o) => acc + Number(o.adjustment_amount || 0), 0);
      const cNet = cGross - cPlatformFees - cCardFees - cAdj;
      const cAvg = cCount > 0 ? cGross / cCount : 0;
      const mixPct = grossRevenue > 0 ? (cGross / grossRevenue) * 100 : 0;
      const effectiveFeePct = cGross > 0 ? (cPlatformFees / cGross) * 100 : 0;
      const netMarginPct = cGross > 0 ? (cNet / cGross) * 100 : 0;

      channelsData[cName] = {
        orderCount: cCount,
        gross: cGross,
        mixPct,
        platformFees: cPlatformFees,
        effectiveFeePct,
        cardFees: cCardFees,
        adjustments: cAdj,
        netRevenue: cNet,
        netMarginPct,
        avgTicket: cAvg
      };
    });

    // 2. Deliveries within range
    const periodDeliveries = deliveries.filter((d) => isDateInRange(d.delivery_date, range));
    // Regra de Negócio: No Desempenho, deduzir somente a taxa adicional de bairros (additional_rate).
    // A taxa base de R$ 8 já é coberta pelos fretes das plataformas (iFood/AiqFome) e no
    // Cardápio Digital já é descontada como ajuste promocional (R$ 8,00 por pedido).
    const courierCost = periodDeliveries.reduce((acc, d) => acc + Number(d.additional_rate || 0), 0);
    const courierTotalFeePaid = periodDeliveries.reduce((acc, d) => acc + Number(d.courier_fee || 0), 0);
    const deliveryCount = periodDeliveries.length;

    // 3. Insumos / Contas a pagar (COGS) within range
    const periodPayables = payables.filter((p) => isDateInRange(p.due_date, range));
    const cogsPayables = periodPayables.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const interestPayables = periodPayables.reduce((acc, p) => acc + Number(p.interest_amount || 0), 0);
    const baseInsumos = cogsPayables - interestPayables;

    // 4. Saídas de Caixa (cashTransactions) within range
    const periodCash = (cashTransactions || []).filter((ct) => {
      if (ct.type !== 'outflow') return false;
      return isDateInRange(ct.transaction_date, range);
    });
    const cashOutflows = periodCash.reduce((acc, ct) => acc + Number(ct.amount || 0), 0);
    const cashOutflowCategories: Record<string, number> = {};
    periodCash.forEach((ct) => {
      const cat = ct.category || 'Outros';
      cashOutflowCategories[cat] = (cashOutflowCategories[cat] || 0) + Number(ct.amount || 0);
    });

    // 5. Freelancers within range
    const periodShifts = shifts.filter((s) => isDateInRange(s.shift_date, range));
    const freelancerCost = periodShifts.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);

    // Total variable costs
    const totalVariableCosts = cogsPayables + cashOutflows + courierCost + freelancerCost;
    const contributionMargin = netRevenue - totalVariableCosts;
    const contributionMarginPct = grossRevenue > 0 ? (contributionMargin / grossRevenue) * 100 : 0;

    // 6. Fixed costs within range
    const periodFixed = (fixedCosts || []).filter((fc) => isDateInRange(fc.due_date, range));
    const fixedCostsTotal = periodFixed.reduce((acc, fc) => acc + Number(fc.amount || 0), 0);

    // 7. Investments within range
    const periodInvestments = investments.filter((inv) => isDateInRange(inv.investment_date, range));
    const investmentsTotal = periodInvestments.reduce((acc, inv) => acc + Number(inv.amount || 0), 0);

    const totalStructuralCosts = fixedCostsTotal + investmentsTotal;
    const operatingProfit = contributionMargin - fixedCostsTotal;
    const operatingProfitMarginPct = grossRevenue > 0 ? (operatingProfit / grossRevenue) * 100 : 0;
    const netFinalProfit = operatingProfit - investmentsTotal;
    const netFinalProfitMarginPct = grossRevenue > 0 ? (netFinalProfit / grossRevenue) * 100 : 0;

    return {
      label,
      startDate: range.startDate,
      endDate: range.endDate,
      orderCount,
      grossRevenue,
      platformFees,
      cardFees,
      adjustments,
      totalDeductions,
      netRevenue,
      avgTicket,
      cogsPayables,
      interestPayables,
      baseInsumos,
      cashOutflows,
      cashOutflowCategories,
      courierCost,
      courierTotalFeePaid,
      deliveryCount,
      freelancerCost,
      totalVariableCosts,
      contributionMargin,
      contributionMarginPct,
      fixedCostsTotal,
      investmentsTotal,
      totalStructuralCosts,
      operatingProfit,
      operatingProfitMarginPct,
      netFinalProfit,
      netFinalProfitMarginPct,
      channels: channelsData
    };
  };

  // Active Date Ranges depending on filterMode
  const activeRefRange: DateRange = useMemo(() => {
    if (filterMode === 'range') {
      return currentRange;
    }
    return {
      startDate: startOfDay(new Date(refYear, refMonth - 1, 1)),
      endDate: endOfDay(new Date(refYear, refMonth, 0)),
      label: `${MONTH_NAMES_PT[refMonth - 1]}/${refYear}`
    };
  }, [filterMode, currentRange, refMonth, refYear]);

  const activeCompRange: DateRange = useMemo(() => {
    if (filterMode === 'range') {
      return computeComparisonRange(currentRange);
    }
    return {
      startDate: startOfDay(new Date(compYear, compMonth - 1, 1)),
      endDate: endOfDay(new Date(compYear, compMonth, 0)),
      label: `${MONTH_NAMES_PT[compMonth - 1]}/${compYear}`
    };
  }, [filterMode, currentRange, compMonth, compYear]);

  // Computed metrics for Reference and Comparison periods
  const refMetrics = useMemo(() => computeMetricsForRange(activeRefRange), [orders, deliveries, payables, fixedCosts, shifts, investments, cashTransactions, activeRefRange]);
  const compMetrics = useMemo(() => computeMetricsForRange(activeCompRange), [orders, deliveries, payables, fixedCosts, shifts, investments, cashTransactions, activeCompRange]);

  // Comparison helpers
  const calcDiff = (current: number, previous: number) => {
    const diff = current - previous;
    const pct = previous > 0 ? (diff / previous) * 100 : current > 0 ? 100 : 0;
    return { diff, pct };
  };

  const grossDiff = calcDiff(refMetrics.grossRevenue, compMetrics.grossRevenue);
  const netDiff = calcDiff(refMetrics.netRevenue, compMetrics.netRevenue);
  const profitDiff = calcDiff(refMetrics.operatingProfit, compMetrics.operatingProfit);
  const netFinalDiff = calcDiff(refMetrics.netFinalProfit, compMetrics.netFinalProfit);
  const orderDiff = calcDiff(refMetrics.orderCount, compMetrics.orderCount);
  const ticketDiff = calcDiff(refMetrics.avgTicket, compMetrics.avgTicket);
  const expensesDiff = calcDiff(
    refMetrics.totalVariableCosts + refMetrics.fixedCostsTotal,
    compMetrics.totalVariableCosts + compMetrics.fixedCostsTotal
  );

  // Annual overview for 2026 (Jan to Dec)
  const annualHistory = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const y = selectedYear || 2026;
      const r: DateRange = {
        startDate: startOfDay(new Date(y, m - 1, 1)),
        endDate: endOfDay(new Date(y, m, 0)),
        label: `${MONTH_NAMES_PT[m - 1]}/${y}`
      };
      const res = computeMetricsForRange(r, MONTH_NAMES_PT[m - 1]);
      return {
        ...res,
        month: m,
        year: y
      };
    });
  }, [orders, deliveries, payables, fixedCosts, shifts, investments, cashTransactions, selectedYear]);

  // Annual Totals
  const annualTotals = useMemo(() => {
    const activeMonths = annualHistory.filter((m) => m.grossRevenue > 0 || m.cogsPayables > 0 || m.fixedCostsTotal > 0 || m.cashOutflows > 0);
    const monthsCount = Math.max(1, activeMonths.length);

    const totalGross = annualHistory.reduce((acc, m) => acc + m.grossRevenue, 0);
    const totalDeductions = annualHistory.reduce((acc, m) => acc + m.totalDeductions, 0);
    const totalNet = annualHistory.reduce((acc, m) => acc + m.netRevenue, 0);
    const totalCogs = annualHistory.reduce((acc, m) => acc + m.cogsPayables, 0);
    const totalCashOutflows = annualHistory.reduce((acc, m) => acc + m.cashOutflows, 0);
    const totalCouriers = annualHistory.reduce((acc, m) => acc + m.courierCost, 0);
    const totalFixed = annualHistory.reduce((acc, m) => acc + m.fixedCostsTotal, 0);
    const totalInvestments = annualHistory.reduce((acc, m) => acc + m.investmentsTotal, 0);
    const totalProfit = annualHistory.reduce((acc, m) => acc + m.operatingProfit, 0);
    const totalNetFinal = annualHistory.reduce((acc, m) => acc + m.netFinalProfit, 0);
    const totalOrders = annualHistory.reduce((acc, m) => acc + m.orderCount, 0);

    return {
      totalGross,
      totalDeductions,
      totalNet,
      totalCogs,
      totalCashOutflows,
      totalCouriers,
      totalFixed,
      totalInvestments,
      totalProfit,
      totalNetFinal,
      totalOrders,
      avgMonthlyGross: totalGross / monthsCount,
      avgMonthlyProfit: totalProfit / monthsCount,
      profitMarginPct: totalGross > 0 ? (totalProfit / totalGross) * 100 : 0,
      netFinalMarginPct: totalGross > 0 ? (totalNetFinal / totalGross) * 100 : 0
    };
  }, [annualHistory]);

  // Variance Badge Component
  const renderVarianceBadge = (
    pct: number, 
    diff: number, 
    invertColor: boolean = false, 
    suffix: string = ''
  ) => {
    if (diff === 0 && pct === 0) {
      return (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
          <Minus size={12} /> 0% {suffix}
        </span>
      );
    }

    const isPositive = pct > 0;
    const isGood = invertColor ? !isPositive : isPositive;
    const badgeColor = isGood ? '#10B981' : '#F43F5E';
    const bgColor = isGood ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)';
    const Icon = isPositive ? ArrowUpRight : ArrowDownRight;

    return (
      <span style={{
        fontSize: '0.74rem',
        fontWeight: 700,
        color: badgeColor,
        backgroundColor: bgColor,
        padding: '2px 8px',
        borderRadius: '12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px'
      }}>
        <Icon size={13} />
        <span>{isPositive ? '+' : ''}{pct.toFixed(1)}% {suffix}</span>
      </span>
    );
  };

  // Own channel sales percentage
  const refOwnChannelShare = useMemo(() => {
    const ownGross = (refMetrics.channels['Cardápio Digital']?.gross || 0) + (refMetrics.channels['Balcão / WhatsApp']?.gross || 0);
    return refMetrics.grossRevenue > 0 ? (ownGross / refMetrics.grossRevenue) * 100 : 0;
  }, [refMetrics]);

  return (
    <div className="page-container">
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart3 size={28} color="#38BDF8" />
            Desempenho da Empresa & Inteligência Financeira
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Análise comparativa mês a mês, lucratividade real por plataforma, DRE gerencial e métricas de delivery
          </p>
        </div>

        {/* Period Selector Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: 'var(--bg-card)',
          padding: '8px 12px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          flexWrap: 'wrap'
        }}>
          {/* Mode Switcher */}
          <div style={{ display: 'flex', gap: '4px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setFilterMode('range')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filterMode === 'range' ? '#38BDF8' : 'transparent',
                color: filterMode === 'range' ? '#0F172A' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              <Calendar size={14} />
              <span>Por Período (Dia/Semana/Mês)</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('months')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filterMode === 'months' ? '#38BDF8' : 'transparent',
                color: filterMode === 'months' ? '#0F172A' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              <CalendarRange size={14} />
              <span>Comparar 2 Meses</span>
            </button>
          </div>

          {filterMode === 'range' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <DateRangePicker value={currentRange} onChange={handleRangeChange} align="right" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Comparando com:</span>
                <span className="badge badge-neutral" style={{ fontWeight: 600, fontSize: '0.76rem' }}>
                  {activeCompRange.label}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: '#38BDF8', fontWeight: 700 }}>MÊS PRINCIPAL:</span>
                <select
                  className="select"
                  value={refMonth}
                  onChange={(e) => setRefMonth(Number(e.target.value))}
                  style={{ padding: '4px 8px', fontSize: '0.82rem', height: '32px' }}
                >
                  {monthOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <select
                  className="select"
                  value={refYear}
                  onChange={(e) => setRefYear(Number(e.target.value))}
                  style={{ padding: '4px 8px', fontSize: '0.82rem', height: '32px', width: '78px' }}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>vs</span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>COMPARAR COM:</span>
                <select
                  className="select"
                  value={compMonth}
                  onChange={(e) => setCompMonth(Number(e.target.value))}
                  style={{ padding: '4px 8px', fontSize: '0.82rem', height: '32px' }}
                >
                  {monthOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <select
                  className="select"
                  value={compYear}
                  onChange={(e) => setCompYear(Number(e.target.value))}
                  style={{ padding: '4px 8px', fontSize: '0.82rem', height: '32px', width: '78px' }}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top MoM KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '22px'
      }}>
        {/* Gross Revenue */}
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="kpi-title">Faturamento Bruto</div>
            {renderVarianceBadge(grossDiff.pct, grossDiff.diff)}
          </div>
          <div className="kpi-value" style={{ color: '#F8FAFC' }}>
            {formatCurrency(refMetrics.grossRevenue)}
          </div>
          <div className="kpi-subtitle" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Ant: {formatCurrency(compMetrics.grossRevenue)}</span>
            <span style={{ color: grossDiff.diff >= 0 ? '#10B981' : '#F43F5E', fontWeight: 600 }}>
              {grossDiff.diff >= 0 ? '+' : ''}{formatCurrency(grossDiff.diff)}
            </span>
          </div>
        </div>

        {/* Net Sales */}
        <div className="kpi-card" style={{ borderColor: 'rgba(56, 189, 248, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="kpi-title" style={{ color: '#38BDF8' }}>Receita Líquida Real</div>
            {renderVarianceBadge(netDiff.pct, netDiff.diff)}
          </div>
          <div className="kpi-value" style={{ color: '#38BDF8' }}>
            {formatCurrency(refMetrics.netRevenue)}
          </div>
          <div className="kpi-subtitle" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Pós-taxas apps & cartões</span>
            <span>Ant: {formatCurrency(compMetrics.netRevenue)}</span>
          </div>
        </div>

        {/* Operating Profit */}
        <div className="kpi-card" style={{ borderColor: refMetrics.operatingProfit >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="kpi-title" style={{ color: refMetrics.operatingProfit >= 0 ? '#34D399' : '#FB7185' }}>
              Lucro Operacional (EBITDA)
            </div>
            {renderVarianceBadge(profitDiff.pct, profitDiff.diff)}
          </div>
          <div className="kpi-value" style={{ color: refMetrics.operatingProfit >= 0 ? '#34D399' : '#FB7185' }}>
            {formatCurrency(refMetrics.operatingProfit)}
          </div>
          <div className="kpi-subtitle" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Margem: <strong>{refMetrics.operatingProfitMarginPct.toFixed(1)}%</strong></span>
            <span>Pós-invest.: <strong style={{ color: refMetrics.netFinalProfit >= 0 ? '#34D399' : '#FB7185' }}>{formatCurrency(refMetrics.netFinalProfit)}</strong></span>
          </div>
        </div>

        {/* Orders Count & Ticket */}
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="kpi-title">Volume de Pedidos</div>
            {renderVarianceBadge(orderDiff.pct, orderDiff.diff)}
          </div>
          <div className="kpi-value" style={{ color: '#F8FAFC' }}>
            {refMetrics.orderCount} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>pedidos</span>
          </div>
          <div className="kpi-subtitle" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Ticket: <strong>{formatCurrency(refMetrics.avgTicket)}</strong></span>
            <span>Ant: {compMetrics.orderCount} ped</span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="kpi-title">Gastos Totais (Op. + Fixos)</div>
            {renderVarianceBadge(expensesDiff.pct, expensesDiff.diff, true)}
          </div>
          <div className="kpi-value" style={{ color: '#FBBF24' }}>
            {formatCurrency(refMetrics.totalVariableCosts + refMetrics.fixedCostsTotal)}
          </div>
          <div className="kpi-subtitle" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Insumos, equipe & fixos</span>
            <span>Ant: {formatCurrency(compMetrics.totalVariableCosts + compMetrics.fixedCostsTotal)}</span>
          </div>
        </div>
      </div>

      {/* Subtabs Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          type="button"
          onClick={() => setActiveSubTab('dre')}
          className={`btn ${activeSubTab === 'dre' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}
        >
          <Receipt size={16} />
          <span>DRE Gerencial Comparativa</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('platforms')}
          className={`btn ${activeSubTab === 'platforms' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}
        >
          <PieChart size={16} />
          <span>Lucro por Plataforma (iFood, Site, etc.)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('expenses')}
          className={`btn ${activeSubTab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}
        >
          <TrendingDown size={16} />
          <span>Evolução & Raio-X de Gastos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('annual')}
          className={`btn ${activeSubTab === 'annual' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}
        >
          <Calendar size={16} />
          <span>Histórico Anual ({selectedYear || 2026})</span>
        </button>
      </div>

      {/* TAB 1: DRE Gerencial Comparativa */}
      {activeSubTab === 'dre' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#F8FAFC', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Receipt size={20} color="#38BDF8" />
                  Demonstração do Resultado do Exercício (DRE Gerencial)
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                  Visão estruturada do fluxo de receitas, deduções de vendas, custos operacionais e margem líquida final
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                <span className="badge badge-info">{refMetrics.label}</span>
                <span style={{ color: 'var(--text-muted)' }}>comparado a</span>
                <span className="badge badge-neutral">{compMetrics.label}</span>
              </div>
            </div>

            <div className="table-container" style={{ margin: 0, border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '240px' }}>Estrutura de Resultados</th>
                    <th style={{ textAlign: 'right' }}>{refMetrics.label} (R$)</th>
                    <th style={{ textAlign: 'right' }}>% Bruto</th>
                    <th style={{ textAlign: 'right' }}>{compMetrics.label} (R$)</th>
                    <th style={{ textAlign: 'right' }}>% Bruto</th>
                    <th style={{ textAlign: 'right' }}>Variação (R$)</th>
                    <th style={{ textAlign: 'center' }}>Evolução MoM</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 1. Receita Bruta */}
                  <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', fontWeight: 700 }}>
                    <td style={{ color: '#F8FAFC' }}>
                      <span style={{ color: '#38BDF8', marginRight: '6px' }}>[+]</span>
                      RECEITA BRUTA DE VENDAS
                    </td>
                    <td style={{ textAlign: 'right', color: '#F8FAFC', fontSize: '0.95rem' }}>{formatCurrency(refMetrics.grossRevenue)}</td>
                    <td style={{ textAlign: 'right' }}>100.0%</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(compMetrics.grossRevenue)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>100.0%</td>
                    <td style={{ textAlign: 'right', color: grossDiff.diff >= 0 ? '#10B981' : '#F43F5E', fontWeight: 600 }}>
                      {grossDiff.diff >= 0 ? '+' : ''}{formatCurrency(grossDiff.diff)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(grossDiff.pct, grossDiff.diff)}
                    </td>
                  </tr>

                  {/* Deduções de Vendas */}
                  <tr>
                    <td style={{ paddingLeft: '28px', color: 'var(--text-secondary)' }}>
                      (-) Taxas de Plataformas (iFood / AiqFome)
                    </td>
                    <td style={{ textAlign: 'right', color: '#FB7185' }}>-{formatCurrency(refMetrics.platformFees)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {refMetrics.grossRevenue > 0 ? ((refMetrics.platformFees / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-{formatCurrency(compMetrics.platformFees)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.grossRevenue > 0 ? ((compMetrics.platformFees / compMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(refMetrics.platformFees - compMetrics.platformFees)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(calcDiff(refMetrics.platformFees, compMetrics.platformFees).pct, calcDiff(refMetrics.platformFees, compMetrics.platformFees).diff, true)}
                    </td>
                  </tr>

                  <tr>
                    <td style={{ paddingLeft: '28px', color: 'var(--text-secondary)' }}>
                      (-) Taxas de Maquininha (Cartão Débito/Crédito)
                    </td>
                    <td style={{ textAlign: 'right', color: '#FBBF24' }}>-{formatCurrency(refMetrics.cardFees)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {refMetrics.grossRevenue > 0 ? ((refMetrics.cardFees / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-{formatCurrency(compMetrics.cardFees)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.grossRevenue > 0 ? ((compMetrics.cardFees / compMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(refMetrics.cardFees - compMetrics.cardFees)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(calcDiff(refMetrics.cardFees, compMetrics.cardFees).pct, calcDiff(refMetrics.cardFees, compMetrics.cardFees).diff, true)}
                    </td>
                  </tr>

                  <tr>
                    <td style={{ paddingLeft: '28px', color: 'var(--text-secondary)' }}>
                      (-) Ajustes Promocionais & Cupons
                    </td>
                    <td style={{ textAlign: 'right', color: '#94A3B8' }}>-{formatCurrency(refMetrics.adjustments)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {refMetrics.grossRevenue > 0 ? ((refMetrics.adjustments / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-{formatCurrency(compMetrics.adjustments)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.grossRevenue > 0 ? ((compMetrics.adjustments / compMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(refMetrics.adjustments - compMetrics.adjustments)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(calcDiff(refMetrics.adjustments, compMetrics.adjustments).pct, calcDiff(refMetrics.adjustments, compMetrics.adjustments).diff, true)}
                    </td>
                  </tr>

                  {/* 2. Receita Líquida */}
                  <tr style={{ backgroundColor: 'rgba(56, 189, 248, 0.06)', fontWeight: 700 }}>
                    <td style={{ color: '#38BDF8' }}>
                      <span style={{ color: '#38BDF8', marginRight: '6px' }}>[=]</span>
                      RECEITA LÍQUIDA DE VENDAS
                    </td>
                    <td style={{ textAlign: 'right', color: '#38BDF8', fontSize: '0.95rem' }}>{formatCurrency(refMetrics.netRevenue)}</td>
                    <td style={{ textAlign: 'right', color: '#38BDF8' }}>
                      {refMetrics.grossRevenue > 0 ? ((refMetrics.netRevenue / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(compMetrics.netRevenue)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.grossRevenue > 0 ? ((compMetrics.netRevenue / compMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: netDiff.diff >= 0 ? '#10B981' : '#F43F5E', fontWeight: 600 }}>
                      {netDiff.diff >= 0 ? '+' : ''}{formatCurrency(netDiff.diff)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(netDiff.pct, netDiff.diff)}
                    </td>
                  </tr>

                  {/* Custos Operacionais Variáveis */}
                  <tr>
                    <td style={{ paddingLeft: '28px', color: 'var(--text-secondary)' }}>
                      (-) Custos de Insumos & Fornecedores (Contas a Pagar)
                      {refMetrics.interestPayables > 0 && (
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#FB7185' }}>
                          Inclui {formatCurrency(refMetrics.interestPayables)} em juros de boletos por atraso (Base: {formatCurrency(refMetrics.baseInsumos)})
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', color: '#FB7185' }}>-{formatCurrency(refMetrics.cogsPayables)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {refMetrics.grossRevenue > 0 ? ((refMetrics.cogsPayables / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-{formatCurrency(compMetrics.cogsPayables)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.grossRevenue > 0 ? ((compMetrics.cogsPayables / compMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(refMetrics.cogsPayables - compMetrics.cogsPayables)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(calcDiff(refMetrics.cogsPayables, compMetrics.cogsPayables).pct, calcDiff(refMetrics.cogsPayables, compMetrics.cogsPayables).diff, true)}
                    </td>
                  </tr>

                  {/* Saídas do Caixa / Pequenas Compras */}
                  <tr>
                    <td style={{ paddingLeft: '28px', color: 'var(--text-secondary)' }}>
                      (-) Saídas de Caixa & Pequenas Compras (Supermercado, Hortifruti, etc.)
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Despesas operacionais e compras de emergência registradas na categoria Saídas
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: '#FB7185' }}>-{formatCurrency(refMetrics.cashOutflows)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {refMetrics.grossRevenue > 0 ? ((refMetrics.cashOutflows / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-{formatCurrency(compMetrics.cashOutflows)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.grossRevenue > 0 ? ((compMetrics.cashOutflows / compMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(refMetrics.cashOutflows - compMetrics.cashOutflows)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(calcDiff(refMetrics.cashOutflows, compMetrics.cashOutflows).pct, calcDiff(refMetrics.cashOutflows, compMetrics.cashOutflows).diff, true)}
                    </td>
                  </tr>

                  <tr>
                    <td style={{ paddingLeft: '28px', color: 'var(--text-secondary)' }}>
                      (-) Taxas Adicionais de Motoboys (Somente Adicionais dos Bairros)
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Base R$ 8 coberta pelas taxas de apps e deduzida no Cardápio Digital
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: '#FB7185' }}>-{formatCurrency(refMetrics.courierCost)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {refMetrics.grossRevenue > 0 ? ((refMetrics.courierCost / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-{formatCurrency(compMetrics.courierCost)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.grossRevenue > 0 ? ((compMetrics.courierCost / compMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(refMetrics.courierCost - compMetrics.courierCost)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(calcDiff(refMetrics.courierCost, compMetrics.courierCost).pct, calcDiff(refMetrics.courierCost, compMetrics.courierCost).diff, true)}
                    </td>
                  </tr>

                  <tr>
                    <td style={{ paddingLeft: '28px', color: 'var(--text-secondary)' }}>
                      (-) Mão de Obra Operacional / Freelancers
                    </td>
                    <td style={{ textAlign: 'right', color: '#FB7185' }}>-{formatCurrency(refMetrics.freelancerCost)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {refMetrics.grossRevenue > 0 ? ((refMetrics.freelancerCost / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-{formatCurrency(compMetrics.freelancerCost)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.grossRevenue > 0 ? ((compMetrics.freelancerCost / compMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(refMetrics.freelancerCost - compMetrics.freelancerCost)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(calcDiff(refMetrics.freelancerCost, compMetrics.freelancerCost).pct, calcDiff(refMetrics.freelancerCost, compMetrics.freelancerCost).diff, true)}
                    </td>
                  </tr>

                  {/* 3. Margem de Contribuição */}
                  <tr style={{ backgroundColor: 'rgba(251, 191, 36, 0.06)', fontWeight: 700 }}>
                    <td style={{ color: '#FBBF24' }}>
                      <span style={{ color: '#FBBF24', marginRight: '6px' }}>[=]</span>
                      MARGEM DE CONTRIBUIÇÃO
                    </td>
                    <td style={{ textAlign: 'right', color: '#FBBF24', fontSize: '0.95rem' }}>{formatCurrency(refMetrics.contributionMargin)}</td>
                    <td style={{ textAlign: 'right', color: '#FBBF24' }}>{refMetrics.contributionMarginPct.toFixed(1)}%</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(compMetrics.contributionMargin)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{compMetrics.contributionMarginPct.toFixed(1)}%</td>
                    <td style={{ textAlign: 'right', color: calcDiff(refMetrics.contributionMargin, compMetrics.contributionMargin).diff >= 0 ? '#10B981' : '#F43F5E', fontWeight: 600 }}>
                      {calcDiff(refMetrics.contributionMargin, compMetrics.contributionMargin).diff >= 0 ? '+' : ''}{formatCurrency(calcDiff(refMetrics.contributionMargin, compMetrics.contributionMargin).diff)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(calcDiff(refMetrics.contributionMargin, compMetrics.contributionMargin).pct, calcDiff(refMetrics.contributionMargin, compMetrics.contributionMargin).diff)}
                    </td>
                  </tr>

                  {/* Custos Fixos Operacionais */}
                  <tr>
                    <td style={{ paddingLeft: '28px', color: 'var(--text-secondary)' }}>
                      (-) Custos Fixos Operacionais (Aluguel, Luz, Software, etc.)
                    </td>
                    <td style={{ textAlign: 'right', color: '#FB7185' }}>-{formatCurrency(refMetrics.fixedCostsTotal)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {refMetrics.grossRevenue > 0 ? ((refMetrics.fixedCostsTotal / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-{formatCurrency(compMetrics.fixedCostsTotal)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.grossRevenue > 0 ? ((compMetrics.fixedCostsTotal / compMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(refMetrics.fixedCostsTotal - compMetrics.fixedCostsTotal)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(calcDiff(refMetrics.fixedCostsTotal, compMetrics.fixedCostsTotal).pct, calcDiff(refMetrics.fixedCostsTotal, compMetrics.fixedCostsTotal).diff, true)}
                    </td>
                  </tr>

                  {/* 4. Lucro Operacional (EBITDA / Antes de Investimentos) */}
                  <tr style={{
                    backgroundColor: refMetrics.operatingProfit >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
                    fontWeight: 700,
                    borderTop: '1px solid rgba(148, 163, 184, 0.2)'
                  }}>
                    <td style={{ color: refMetrics.operatingProfit >= 0 ? '#34D399' : '#FB7185' }}>
                      <span style={{ marginRight: '6px' }}>[=]</span>
                      LUCRO OPERACIONAL (EBITDA)
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                        Margem de Contribuição (-) Custos Fixos Operacionais
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: refMetrics.operatingProfit >= 0 ? '#34D399' : '#FB7185', fontSize: '1rem', fontWeight: 800 }}>
                      {formatCurrency(refMetrics.operatingProfit)}
                    </td>
                    <td style={{ textAlign: 'right', color: refMetrics.operatingProfit >= 0 ? '#34D399' : '#FB7185' }}>
                      {refMetrics.operatingProfitMarginPct.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {formatCurrency(compMetrics.operatingProfit)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.operatingProfitMarginPct.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: 'right', color: profitDiff.diff >= 0 ? '#10B981' : '#F43F5E', fontWeight: 600 }}>
                      {profitDiff.diff >= 0 ? '+' : ''}{formatCurrency(profitDiff.diff)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(profitDiff.pct, profitDiff.diff)}
                    </td>
                  </tr>

                  {/* Investimentos / Capex */}
                  <tr>
                    <td style={{ paddingLeft: '28px', color: 'var(--text-secondary)' }}>
                      (-) Investimentos & Melhorias do Mês (Capex / Reformas / Equipamentos)
                    </td>
                    <td style={{ textAlign: 'right', color: '#94A3B8' }}>-{formatCurrency(refMetrics.investmentsTotal)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {refMetrics.grossRevenue > 0 ? ((refMetrics.investmentsTotal / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-{formatCurrency(compMetrics.investmentsTotal)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.grossRevenue > 0 ? ((compMetrics.investmentsTotal / compMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(refMetrics.investmentsTotal - compMetrics.investmentsTotal)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(calcDiff(refMetrics.investmentsTotal, compMetrics.investmentsTotal).pct, calcDiff(refMetrics.investmentsTotal, compMetrics.investmentsTotal).diff, true)}
                    </td>
                  </tr>

                  {/* 5. Resultado Líquido Final do Mês */}
                  <tr style={{
                    backgroundColor: refMetrics.netFinalProfit >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                    fontWeight: 800,
                    borderTop: '2px solid var(--border-color)'
                  }}>
                    <td style={{ color: refMetrics.netFinalProfit >= 0 ? '#34D399' : '#FB7185', fontSize: '0.98rem' }}>
                      <span style={{ marginRight: '6px' }}>[=]</span>
                      RESULTADO LÍQUIDO FINAL (SOBRA / DÉFICIT DE CAIXA)
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                        Lucro Operacional (-) Investimentos do Mês
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: refMetrics.netFinalProfit >= 0 ? '#34D399' : '#FB7185', fontSize: '1.15rem', fontWeight: 800 }}>
                      {formatCurrency(refMetrics.netFinalProfit)}
                    </td>
                    <td style={{ textAlign: 'right', color: refMetrics.netFinalProfit >= 0 ? '#34D399' : '#FB7185' }}>
                      {refMetrics.netFinalProfitMarginPct.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {formatCurrency(compMetrics.netFinalProfit)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.netFinalProfitMarginPct.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: 'right', color: netFinalDiff.diff >= 0 ? '#10B981' : '#F43F5E', fontSize: '1rem' }}>
                      {netFinalDiff.diff >= 0 ? '+' : ''}{formatCurrency(netFinalDiff.diff)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(netFinalDiff.pct, netFinalDiff.diff)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Lucro por Plataforma (Channel Economics) */}
      {activeSubTab === 'platforms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Channel Highlight Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            <div className="card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34D399', fontSize: '0.85rem', fontWeight: 700 }}>
                <ShieldCheck size={18} />
                <span>Share de Canal Próprio (Site / Balcão)</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#F8FAFC', margin: '8px 0 4px 0' }}>
                {refOwnChannelShare.toFixed(1)}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Vendas em canais de alta margem sem comissão abusiva de apps
              </div>
            </div>

            <div className="card" style={{ borderColor: 'rgba(244, 63, 94, 0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FB7185', fontSize: '0.85rem', fontWeight: 700 }}>
                <DollarSign size={18} />
                <span>Taxas Retidas por Aplicativos</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FB7185', margin: '8px 0 4px 0' }}>
                {formatCurrency(refMetrics.platformFees)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Taxa média efetiva: <strong>{refMetrics.grossRevenue > 0 ? ((refMetrics.platformFees / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%</strong> sobre o faturamento
              </div>
            </div>

            <div className="card" style={{ borderColor: 'rgba(56, 189, 248, 0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38BDF8', fontSize: '0.85rem', fontWeight: 700 }}>
                <Sparkles size={18} />
                <span>Economia por Vendas no Cardápio Digital</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38BDF8', margin: '8px 0 4px 0' }}>
                {formatCurrency(((refMetrics.channels['Cardápio Digital']?.gross || 0) * 0.15))}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Estimativa de comissão de 15% evitada se fossem pelo iFood
              </div>
            </div>
          </div>

          {/* Platforms Comparison Table */}
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#F8FAFC', margin: 0 }}>
                  Comparativo de Eficiência e Lucro Real por Canal ({refMetrics.label})
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                  Veja exatamente quanto cada canal fatura bruto, quanto fica em taxas e o valor líquido final
                </p>
              </div>
            </div>

            <div className="table-container" style={{ margin: 0, border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Canal de Venda</th>
                    <th style={{ textAlign: 'right' }}>Faturamento Bruto</th>
                    <th style={{ textAlign: 'right' }}>Mix de Vendas (%)</th>
                    <th style={{ textAlign: 'center' }}>Pedidos</th>
                    <th style={{ textAlign: 'right' }}>Ticket Médio</th>
                    <th style={{ textAlign: 'right' }}>Taxa App Retida</th>
                    <th style={{ textAlign: 'right' }}>Taxa Efetiva (%)</th>
                    <th style={{ textAlign: 'right' }}>Taxa Cartão</th>
                    <th style={{ textAlign: 'right' }}>Faturamento Líquido</th>
                    <th style={{ textAlign: 'center' }}>Margem Líquida %</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(refMetrics.channels).map(([cName, data]) => {
                    const compData = compMetrics.channels[cName];
                    const growth = compData ? calcDiff(data.gross, compData.gross) : null;
                    const isOwnChannel = cName === 'Cardápio Digital' || cName === 'Balcão / WhatsApp';

                    return (
                      <tr key={cName}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={`badge ${
                              cName === 'iFood' ? 'badge-danger' : 
                              cName === 'AiqFome' ? 'badge-warning' : 'badge-info'
                            }`}>
                              {cName}
                            </span>
                            {isOwnChannel && (
                              <span style={{ fontSize: '0.68rem', color: '#34D399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1px 5px', borderRadius: '4px' }}>
                                Canal Próprio
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>
                          {formatCurrency(data.gross)}
                          {growth && (
                            <div style={{ fontSize: '0.72rem', marginTop: '2px' }}>
                              {renderVarianceBadge(growth.pct, growth.diff)}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {data.mixPct.toFixed(1)}%
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {data.orderCount}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(data.avgTicket)}
                        </td>
                        <td style={{ textAlign: 'right', color: data.platformFees > 0 ? '#FB7185' : 'var(--text-muted)', fontWeight: 600 }}>
                          {data.platformFees > 0 ? `-${formatCurrency(data.platformFees)}` : 'R$ 0,00'}
                        </td>
                        <td style={{ textAlign: 'right', color: data.effectiveFeePct > 0 ? '#FB7185' : '#34D399', fontWeight: 600 }}>
                          {data.effectiveFeePct.toFixed(1)}%
                        </td>
                        <td style={{ textAlign: 'right', color: data.cardFees > 0 ? '#FBBF24' : 'var(--text-muted)' }}>
                          {data.cardFees > 0 ? `-${formatCurrency(data.cardFees)}` : 'R$ 0,00'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#38BDF8', fontSize: '0.95rem' }}>
                          {formatCurrency(data.netRevenue)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            backgroundColor: data.netMarginPct >= 85 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                            color: data.netMarginPct >= 85 ? '#34D399' : '#FBBF24',
                            border: `1px solid ${data.netMarginPct >= 85 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`
                          }}>
                            {data.netMarginPct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Evolução & Raio-X de Gastos */}
      {activeSubTab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#F8FAFC', margin: 0 }}>
                  Raio-X de Despesas & Centros de Custo ({refMetrics.label} vs {compMetrics.label})
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                  Acompanhe em quais áreas os custos aumentaram ou foram otimizados
                </p>
              </div>
            </div>

            <div className="table-container" style={{ margin: 0, border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Centro de Custo</th>
                    <th style={{ textAlign: 'right' }}>{refMetrics.label}</th>
                    <th style={{ textAlign: 'right' }}>% do Faturamento</th>
                    <th style={{ textAlign: 'right' }}>{compMetrics.label}</th>
                    <th style={{ textAlign: 'right' }}>% do Faturamento</th>
                    <th style={{ textAlign: 'right' }}>Diferença R$</th>
                    <th style={{ textAlign: 'center' }}>Variação MoM</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 1. Insumos */}
                  <tr>
                    <td style={{ fontWeight: 600, color: '#F8FAFC' }}>
                      Insumos & Fornecedores (Contas a Pagar)
                      {refMetrics.interestPayables > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38BDF8', fontWeight: 500 }}>
                            Base Insumos: {formatCurrency(refMetrics.baseInsumos)}
                          </span>
                          <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#FB7185', fontWeight: 500 }}>
                            Juros de Boleto: {formatCurrency(refMetrics.interestPayables)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>{formatCurrency(refMetrics.cogsPayables)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {refMetrics.grossRevenue > 0 ? ((refMetrics.cogsPayables / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(compMetrics.cogsPayables)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.grossRevenue > 0 ? ((compMetrics.cogsPayables / compMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: refMetrics.cogsPayables <= compMetrics.cogsPayables ? '#10B981' : '#F43F5E', fontWeight: 600 }}>
                      {refMetrics.cogsPayables - compMetrics.cogsPayables >= 0 ? '+' : ''}{formatCurrency(refMetrics.cogsPayables - compMetrics.cogsPayables)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(calcDiff(refMetrics.cogsPayables, compMetrics.cogsPayables).pct, calcDiff(refMetrics.cogsPayables, compMetrics.cogsPayables).diff, true)}
                    </td>
                  </tr>

                  {/* Saídas de Caixa */}
                  <tr>
                    <td style={{ fontWeight: 600, color: '#F8FAFC' }}>
                      Saídas de Caixa & Pequenas Compras
                      <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                        Supermercado, feira, pequenos suprimentos e compras avulsas
                      </span>
                      {Object.keys(refMetrics.cashOutflowCategories).length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {Object.entries(refMetrics.cashOutflowCategories).map(([cat, val]) => (
                            <span key={cat} style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                              {cat}: {formatCurrency(val)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>{formatCurrency(refMetrics.cashOutflows)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {refMetrics.grossRevenue > 0 ? ((refMetrics.cashOutflows / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(compMetrics.cashOutflows)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.grossRevenue > 0 ? ((compMetrics.cashOutflows / compMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: refMetrics.cashOutflows <= compMetrics.cashOutflows ? '#10B981' : '#F43F5E', fontWeight: 600 }}>
                      {refMetrics.cashOutflows - compMetrics.cashOutflows >= 0 ? '+' : ''}{formatCurrency(refMetrics.cashOutflows - compMetrics.cashOutflows)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(calcDiff(refMetrics.cashOutflows, compMetrics.cashOutflows).pct, calcDiff(refMetrics.cashOutflows, compMetrics.cashOutflows).diff, true)}
                    </td>
                  </tr>

                  {/* 2. Taxas de Aplicativos */}
                  <tr>
                    <td style={{ fontWeight: 600, color: '#F8FAFC' }}>
                      Taxas de Plataformas (iFood & AiqFome)
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>{formatCurrency(refMetrics.platformFees)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {refMetrics.grossRevenue > 0 ? ((refMetrics.platformFees / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(compMetrics.platformFees)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.grossRevenue > 0 ? ((compMetrics.platformFees / compMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: refMetrics.platformFees <= compMetrics.platformFees ? '#10B981' : '#F43F5E', fontWeight: 600 }}>
                      {refMetrics.platformFees - compMetrics.platformFees >= 0 ? '+' : ''}{formatCurrency(refMetrics.platformFees - compMetrics.platformFees)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(calcDiff(refMetrics.platformFees, compMetrics.platformFees).pct, calcDiff(refMetrics.platformFees, compMetrics.platformFees).diff, true)}
                    </td>
                  </tr>

                  {/* 3. Motoboys */}
                  <tr>
                    <td style={{ fontWeight: 600, color: '#F8FAFC' }}>
                      Taxas Adicionais de Motoboys (Adicional de Bairro)
                      <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                        Total repassado aos motoboys no mês: {formatCurrency(refMetrics.courierTotalFeePaid)} ({refMetrics.deliveryCount} corridas)
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>{formatCurrency(refMetrics.courierCost)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {refMetrics.grossRevenue > 0 ? ((refMetrics.courierCost / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(compMetrics.courierCost)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.grossRevenue > 0 ? ((compMetrics.courierCost / compMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: refMetrics.courierCost <= compMetrics.courierCost ? '#10B981' : '#F43F5E', fontWeight: 600 }}>
                      {refMetrics.courierCost - compMetrics.courierCost >= 0 ? '+' : ''}{formatCurrency(refMetrics.courierCost - compMetrics.courierCost)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(calcDiff(refMetrics.courierCost, compMetrics.courierCost).pct, calcDiff(refMetrics.courierCost, compMetrics.courierCost).diff, true)}
                    </td>
                  </tr>

                  {/* 4. Custos Fixos */}
                  <tr>
                    <td style={{ fontWeight: 600, color: '#F8FAFC' }}>
                      Custos Fixos (Aluguel, Luz, Água, Sistemas)
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>{formatCurrency(refMetrics.fixedCostsTotal)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {refMetrics.grossRevenue > 0 ? ((refMetrics.fixedCostsTotal / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(compMetrics.fixedCostsTotal)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.grossRevenue > 0 ? ((compMetrics.fixedCostsTotal / compMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: refMetrics.fixedCostsTotal <= compMetrics.fixedCostsTotal ? '#10B981' : '#F43F5E', fontWeight: 600 }}>
                      {refMetrics.fixedCostsTotal - compMetrics.fixedCostsTotal >= 0 ? '+' : ''}{formatCurrency(refMetrics.fixedCostsTotal - compMetrics.fixedCostsTotal)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(calcDiff(refMetrics.fixedCostsTotal, compMetrics.fixedCostsTotal).pct, calcDiff(refMetrics.fixedCostsTotal, compMetrics.fixedCostsTotal).diff, true)}
                    </td>
                  </tr>

                  {/* 5. Freelancers */}
                  <tr>
                    <td style={{ fontWeight: 600, color: '#F8FAFC' }}>
                      Freelancers & Equipe Extra
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>{formatCurrency(refMetrics.freelancerCost)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {refMetrics.grossRevenue > 0 ? ((refMetrics.freelancerCost / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(compMetrics.freelancerCost)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.grossRevenue > 0 ? ((compMetrics.freelancerCost / compMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: refMetrics.freelancerCost <= compMetrics.freelancerCost ? '#10B981' : '#F43F5E', fontWeight: 600 }}>
                      {refMetrics.freelancerCost - compMetrics.freelancerCost >= 0 ? '+' : ''}{formatCurrency(refMetrics.freelancerCost - compMetrics.freelancerCost)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(calcDiff(refMetrics.freelancerCost, compMetrics.freelancerCost).pct, calcDiff(refMetrics.freelancerCost, compMetrics.freelancerCost).diff, true)}
                    </td>
                  </tr>

                  {/* 6. Investimentos */}
                  <tr>
                    <td style={{ fontWeight: 600, color: '#F8FAFC' }}>
                      Investimentos & Melhorias Patrimoniais
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#F8FAFC' }}>{formatCurrency(refMetrics.investmentsTotal)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {refMetrics.grossRevenue > 0 ? ((refMetrics.investmentsTotal / refMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(compMetrics.investmentsTotal)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {compMetrics.grossRevenue > 0 ? ((compMetrics.investmentsTotal / compMetrics.grossRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'right', color: refMetrics.investmentsTotal <= compMetrics.investmentsTotal ? '#10B981' : '#F43F5E', fontWeight: 600 }}>
                      {refMetrics.investmentsTotal - compMetrics.investmentsTotal >= 0 ? '+' : ''}{formatCurrency(refMetrics.investmentsTotal - compMetrics.investmentsTotal)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {renderVarianceBadge(calcDiff(refMetrics.investmentsTotal, compMetrics.investmentsTotal).pct, calcDiff(refMetrics.investmentsTotal, compMetrics.investmentsTotal).diff, true)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Histórico Anual Mês a Mês */}
      {activeSubTab === 'annual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Annual Summary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div className="kpi-card">
              <div className="kpi-title">Faturamento Bruto Total ({selectedYear || 2026})</div>
              <div className="kpi-value" style={{ color: '#F8FAFC' }}>{formatCurrency(annualTotals.totalGross)}</div>
              <div className="kpi-subtitle">Média mensal: {formatCurrency(annualTotals.avgMonthlyGross)}</div>
            </div>

            <div className="kpi-card" style={{ borderColor: 'rgba(56, 189, 248, 0.3)' }}>
              <div className="kpi-title" style={{ color: '#38BDF8' }}>Receita Líquida Acumulada</div>
              <div className="kpi-value" style={{ color: '#38BDF8' }}>{formatCurrency(annualTotals.totalNet)}</div>
              <div className="kpi-subtitle">Deduções apps: -{formatCurrency(annualTotals.totalDeductions)}</div>
            </div>

            <div className="kpi-card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
              <div className="kpi-title" style={{ color: '#34D399' }}>Lucro Operacional Anual (EBITDA)</div>
              <div className="kpi-value" style={{ color: '#34D399' }}>{formatCurrency(annualTotals.totalProfit)}</div>
              <div className="kpi-subtitle">
                Margem: {annualTotals.profitMarginPct.toFixed(1)}% | Sobra Final: <strong style={{ color: annualTotals.totalNetFinal >= 0 ? '#34D399' : '#FB7185' }}>{formatCurrency(annualTotals.totalNetFinal)}</strong>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-title">Pedidos Totais no Ano</div>
              <div className="kpi-value" style={{ color: '#F8FAFC' }}>{annualTotals.totalOrders}</div>
              <div className="kpi-subtitle">Total acumulado em {selectedYear || 2026}</div>
            </div>
          </div>

          {/* Annual Month-by-Month Table */}
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.1rem', color: '#F8FAFC', margin: 0 }}>
                Evolução Mensal de Todos os Meses de {selectedYear || 2026}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                Acompanhamento contínuo da saúde financeira do restaurante mês a mês
              </p>
            </div>

            <div className="table-container" style={{ margin: 0, border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th style={{ textAlign: 'center' }}>Pedidos</th>
                    <th style={{ textAlign: 'right' }}>Faturamento Bruto</th>
                    <th style={{ textAlign: 'right' }}>Taxas Deduções</th>
                    <th style={{ textAlign: 'right' }}>Receita Líquida</th>
                    <th style={{ textAlign: 'right' }}>Insumos (COGS)</th>
                    <th style={{ textAlign: 'right' }}>Saídas Caixa</th>
                    <th style={{ textAlign: 'right' }}>Motoboys</th>
                    <th style={{ textAlign: 'right' }}>Custos Fixos</th>
                    <th style={{ textAlign: 'right' }}>Lucro Operac. (EBITDA)</th>
                    <th style={{ textAlign: 'right' }}>Investimentos</th>
                    <th style={{ textAlign: 'right' }}>Resultado Final</th>
                    <th style={{ textAlign: 'center' }}>Margem Final</th>
                  </tr>
                </thead>
                <tbody>
                  {annualHistory.map((m) => {
                    const isSelected = m.month === refMonth;
                    return (
                      <tr 
                        key={m.month} 
                        style={{ 
                          backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.08)' : undefined,
                          opacity: m.grossRevenue === 0 && m.cogsPayables === 0 && m.cashOutflows === 0 ? 0.45 : 1
                        }}
                      >
                        <td style={{ fontWeight: 700, color: isSelected ? '#38BDF8' : '#F8FAFC' }}>
                          {MONTH_NAMES_PT[m.month - 1]}
                          {isSelected && <span className="badge badge-info" style={{ marginLeft: '6px', fontSize: '0.65rem' }}>Atual</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>{m.orderCount}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(m.grossRevenue)}</td>
                        <td style={{ textAlign: 'right', color: m.totalDeductions > 0 ? '#FB7185' : 'var(--text-muted)' }}>
                          {m.totalDeductions > 0 ? `-${formatCurrency(m.totalDeductions)}` : '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#38BDF8' }}>{formatCurrency(m.netRevenue)}</td>
                        <td style={{ textAlign: 'right', color: m.cogsPayables > 0 ? '#FB7185' : 'var(--text-muted)' }}>
                          {m.cogsPayables > 0 ? `-${formatCurrency(m.cogsPayables)}` : '-'}
                        </td>
                        <td style={{ textAlign: 'right', color: m.cashOutflows > 0 ? '#FB7185' : 'var(--text-muted)' }}>
                          {m.cashOutflows > 0 ? `-${formatCurrency(m.cashOutflows)}` : '-'}
                        </td>
                        <td style={{ textAlign: 'right', color: m.courierCost > 0 ? '#FBBF24' : 'var(--text-muted)' }}>
                          {m.courierCost > 0 ? `-${formatCurrency(m.courierCost)}` : '-'}
                        </td>
                        <td style={{ textAlign: 'right', color: m.fixedCostsTotal > 0 ? '#FB7185' : 'var(--text-muted)' }}>
                          {m.fixedCostsTotal > 0 ? `-${formatCurrency(m.fixedCostsTotal)}` : '-'}
                        </td>
                        <td style={{ 
                          textAlign: 'right', 
                          fontWeight: 700, 
                          color: m.operatingProfit >= 0 ? '#34D399' : '#FB7185'
                        }}>
                          {formatCurrency(m.operatingProfit)}
                        </td>
                        <td style={{ textAlign: 'right', color: m.investmentsTotal > 0 ? '#94A3B8' : 'var(--text-muted)' }}>
                          {m.investmentsTotal > 0 ? `-${formatCurrency(m.investmentsTotal)}` : '-'}
                        </td>
                        <td style={{ 
                          textAlign: 'right', 
                          fontWeight: 800, 
                          color: m.netFinalProfit >= 0 ? '#34D399' : '#FB7185',
                          fontSize: '0.92rem'
                        }}>
                          {formatCurrency(m.netFinalProfit)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: m.netFinalProfitMarginPct >= 15 ? 'rgba(16, 185, 129, 0.15)' : m.netFinalProfitMarginPct >= 0 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                            color: m.netFinalProfitMarginPct >= 15 ? '#34D399' : m.netFinalProfitMarginPct >= 0 ? '#FBBF24' : '#FB7185',
                            border: `1px solid ${m.netFinalProfitMarginPct >= 15 ? 'rgba(16, 185, 129, 0.3)' : m.netFinalProfitMarginPct >= 0 ? 'rgba(251, 191, 36, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`
                          }}>
                            {m.netFinalProfitMarginPct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', fontWeight: 800, borderTop: '2px solid var(--border-color)' }}>
                    <td style={{ color: '#F8FAFC' }}>TOTAL ANUAL</td>
                    <td style={{ textAlign: 'center' }}>{annualTotals.totalOrders}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(annualTotals.totalGross)}</td>
                    <td style={{ textAlign: 'right', color: '#FB7185' }}>-{formatCurrency(annualTotals.totalDeductions)}</td>
                    <td style={{ textAlign: 'right', color: '#38BDF8' }}>{formatCurrency(annualTotals.totalNet)}</td>
                    <td style={{ textAlign: 'right', color: '#FB7185' }}>-{formatCurrency(annualTotals.totalCogs)}</td>
                    <td style={{ textAlign: 'right', color: '#FB7185' }}>-{formatCurrency(annualTotals.totalCashOutflows)}</td>
                    <td style={{ textAlign: 'right', color: '#FBBF24' }}>-{formatCurrency(annualTotals.totalCouriers)}</td>
                    <td style={{ textAlign: 'right', color: '#FB7185' }}>-{formatCurrency(annualTotals.totalFixed)}</td>
                    <td style={{ textAlign: 'right', color: annualTotals.totalProfit >= 0 ? '#34D399' : '#FB7185' }}>{formatCurrency(annualTotals.totalProfit)}</td>
                    <td style={{ textAlign: 'right', color: '#94A3B8' }}>-{formatCurrency(annualTotals.totalInvestments)}</td>
                    <td style={{ textAlign: 'right', color: annualTotals.totalNetFinal >= 0 ? '#34D399' : '#FB7185', fontSize: '1rem' }}>{formatCurrency(annualTotals.totalNetFinal)}</td>
                    <td style={{ textAlign: 'center', color: annualTotals.netFinalMarginPct >= 0 ? '#34D399' : '#FB7185' }}>{annualTotals.netFinalMarginPct.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
