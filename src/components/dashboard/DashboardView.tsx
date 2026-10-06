import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  DollarSign, 
  ShoppingBag, 
  Bike, 
  Receipt, 
  Users, 
  Wallet, 
  Target, 
  CalendarOff, 
  UploadCloud, 
  Plus, 
  CheckCircle2, 
  ArrowRight, 
  ShieldAlert, 
  Flame, 
  Clock, 
  Layers, 
  Sparkles, 
  Building2, 
  Calendar, 
  ArrowUpDown 
} from 'lucide-react';
import { 
  Order, 
  Delivery, 
  AccountsPayable, 
  FreelancerShift, 
  Investment, 
  CashTransaction, 
  CashInitialBalance, 
  MonthlyGoal, 
  ClosedDay, 
  SystemSettings, 
  DateRange, 
  FixedCost, 
  FixedCostPayment 
} from '../../types';
import { formatCurrency, formatPercent } from '../../lib/formatters';
import { 
  isDateInRange, 
  getLocalDateKey, 
  getOperationalDateKey, 
  getOperationalTodayKey, 
  getPreviousMonthEquivalentRange, 
  ComparisonMode,
  startOfDay,
  endOfDay
} from '../../lib/dateUtils';
import { getResolvedFixedCostsForPeriod } from '../../lib/fixedCostUtils';
import { TabType } from '../layout/Sidebar';
import { DateRangePicker } from '../common/DateRangePicker';

interface DashboardViewProps {
  orders: Order[];
  deliveries: Delivery[];
  payables: AccountsPayable[];
  shifts: FreelancerShift[];
  investments: Investment[];
  cashTransactions: CashTransaction[];
  initialBalances: CashInitialBalance[];
  monthlyGoals: MonthlyGoal[];
  closedDays: ClosedDay[];
  settings: SystemSettings;
  fixedCosts?: FixedCost[];
  fixedCostPayments?: FixedCostPayment[];
  selectedMonth: number;
  selectedYear: number;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  onNavigate: (tab: TabType) => void;
  onOpenImport: () => void;
  onOpenClosedDay: () => void;
  onOpenNewCash: () => void;
  onOpenNewPayable: () => void;
  onOpenNewInvestment: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  deliveries,
  payables,
  shifts,
  investments,
  cashTransactions,
  initialBalances,
  monthlyGoals,
  closedDays,
  settings,
  fixedCosts = [],
  fixedCostPayments = [],
  selectedMonth,
  selectedYear,
  dateRange,
  onDateRangeChange,
  onNavigate,
  onOpenImport,
  onOpenClosedDay,
  onOpenNewCash,
  onOpenNewPayable,
  onOpenNewInvestment
}) => {
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('calendar_day');

  // Current Period Completed Orders (using dateRange if present, else month/year)
  const currentOrders = useMemo(() => {
    return orders.filter((o) => {
      if (dateRange) {
        return isDateInRange(o.order_date, dateRange);
      }
      const opKey = getOperationalDateKey(o.order_date);
      if (opKey && /^\d{4}-\d{2}-\d{2}$/.test(opKey)) {
        const [y, m] = opKey.split('-').map(Number);
        return m === selectedMonth && y === selectedYear;
      }
      const d = new Date(o.order_date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [orders, dateRange, selectedMonth, selectedYear]);

  const completedOrders = useMemo(() => {
    return currentOrders.filter((o) => !o.is_canceled);
  }, [currentOrders]);

  // Previous Month / Day Equivalent Range (Section 30)
  const comparisonInfo = useMemo(() => {
    if (dateRange) {
      return getPreviousMonthEquivalentRange(dateRange, comparisonMode);
    }
    const sDate = new Date(selectedYear, selectedMonth - 1, 1);
    const eDate = new Date(selectedYear, selectedMonth, 0);
    return getPreviousMonthEquivalentRange({
      startDate: startOfDay(sDate),
      endDate: endOfDay(eDate),
      label: `${selectedMonth}/${selectedYear}`
    }, comparisonMode);
  }, [dateRange, selectedMonth, selectedYear, comparisonMode]);

  const previousCompletedOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.is_canceled) return false;
      return isDateInRange(o.order_date, comparisonInfo.previousRange);
    });
  }, [orders, comparisonInfo.previousRange]);

  // Orders financial breakdown
  const orderStats = useMemo(() => {
    const count = completedOrders.length;
    const gross = completedOrders.reduce((acc, o) => acc + Number(o.gross_amount || 0), 0);
    const platformFees = completedOrders.reduce((acc, o) => acc + Number(o.platform_fee_amount || 0), 0);
    const cardFees = completedOrders.reduce((acc, o) => acc + Number(o.card_fee_amount || 0), 0);
    const adjustments = completedOrders.reduce((acc, o) => acc + Number(o.adjustment_amount || 0), 0);
    const net = completedOrders.reduce((acc, o) => acc + Number(o.net_amount || 0), 0);
    const avgTicket = count > 0 ? gross / count : 0;

    // Today's gross (operational shift aware)
    const todayStr = getOperationalTodayKey();
    const todayOrders = completedOrders.filter((o) => getOperationalDateKey(o.order_date) === todayStr);
    const grossToday = todayOrders.reduce((acc, o) => acc + Number(o.gross_amount || 0), 0);

    return { count, gross, platformFees, cardFees, adjustments, net, avgTicket, grossToday };
  }, [completedOrders]);

  // Previous Month / Day metrics (exact matching days)
  const prevOrderStats = useMemo(() => {
    const count = previousCompletedOrders.length;
    const gross = previousCompletedOrders.reduce((acc, o) => acc + Number(o.gross_amount || 0), 0);
    const platformFees = previousCompletedOrders.reduce((acc, o) => acc + Number(o.platform_fee_amount || 0), 0);
    const cardFees = previousCompletedOrders.reduce((acc, o) => acc + Number(o.card_fee_amount || 0), 0);
    const adjustments = previousCompletedOrders.reduce((acc, o) => acc + Number(o.adjustment_amount || 0), 0);
    const net = previousCompletedOrders.reduce((acc, o) => acc + Number(o.net_amount || 0), 0);
    const avgTicket = count > 0 ? gross / count : 0;
    return { count, gross, platformFees, cardFees, adjustments, net, avgTicket };
  }, [previousCompletedOrders]);

  // Deliveries in current period (operational shift aware)
  const currentDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      if (dateRange) {
        return isDateInRange(d.delivery_date, dateRange);
      }
      const opKey = getOperationalDateKey(d.delivery_date);
      if (opKey && /^\d{4}-\d{2}-\d{2}$/.test(opKey)) {
        const [y, m] = opKey.split('-').map(Number);
        return m === selectedMonth && y === selectedYear;
      }
      const dt = new Date(d.delivery_date);
      return dt.getMonth() + 1 === selectedMonth && dt.getFullYear() === selectedYear;
    });
  }, [deliveries, dateRange, selectedMonth, selectedYear]);

  // CRITICAL RULE (Section 14 & 36.12):
  // "No DASHBOARD PRINCIPAL existe um indicador chamado: TAXAS DE MOTOBOYS.
  // NESSE INDICADOR NÃO QUERO OS R$8 DE BASE. Quero SOMENTE O ADICIONAL DOS BAIRROS."
  const courierAdditionalRatesOnly = useMemo(() => {
    return currentDeliveries.reduce((acc, d) => acc + Number(d.additional_rate || 0), 0);
  }, [currentDeliveries]);

  // Insumos / Contas a pagar in current period
  const currentPayables = useMemo(() => {
    return payables.filter((p) => {
      if (dateRange) {
        return isDateInRange(p.due_date, dateRange);
      }
      const dt = new Date(p.due_date + 'T00:00:00');
      return dt.getMonth() + 1 === selectedMonth && dt.getFullYear() === selectedYear;
    });
  }, [payables, dateRange, selectedMonth, selectedYear]);

  const payablesTotal = useMemo(() => {
    return currentPayables.reduce((acc, p) => acc + Number(p.amount), 0);
  }, [currentPayables]);

  const overduePayables = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return payables.filter((p) => {
      if (p.is_paid || p.status === 'paid') return false;
      const due = new Date(p.due_date + 'T00:00:00');
      return due < today;
    });
  }, [payables]);

  const dueTodayPayables = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return payables.filter((p) => !(p.is_paid || p.status === 'paid') && p.due_date === todayStr);
  }, [payables]);

  // Freelancers in current period
  const currentShifts = useMemo(() => {
    return shifts.filter((s) => {
      if (dateRange) {
        return isDateInRange(s.shift_date, dateRange);
      }
      const dt = new Date(s.shift_date + 'T00:00:00');
      return dt.getMonth() + 1 === selectedMonth && dt.getFullYear() === selectedYear;
    });
  }, [shifts, dateRange, selectedMonth, selectedYear]);

  const freelancersPending = useMemo(() => {
    return currentShifts.reduce((acc, s) => acc + Number(s.balance_due || 0), 0);
  }, [currentShifts]);

  const freelancersTotalCost = useMemo(() => {
    return currentShifts.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  }, [currentShifts]);

  // Investments in current period
  const currentInvestments = useMemo(() => {
    return investments.filter((i) => {
      if (dateRange) {
        return isDateInRange(i.investment_date, dateRange);
      }
      const dt = new Date(i.investment_date + 'T00:00:00');
      return dt.getMonth() + 1 === selectedMonth && dt.getFullYear() === selectedYear;
    });
  }, [investments, dateRange, selectedMonth, selectedYear]);

  const investmentsTotal = useMemo(() => {
    return currentInvestments.reduce((acc, i) => acc + Number(i.amount), 0);
  }, [currentInvestments]);

  // Cash outflows in current period (Section 20 & 21)
  const currentCashOutflows = useMemo(() => {
    return cashTransactions.filter((t) => {
      if (t.type === 'inflow') return false;
      if (dateRange) {
        return isDateInRange(t.transaction_date, dateRange);
      }
      const dt = new Date(t.transaction_date + 'T00:00:00');
      return dt.getMonth() + 1 === selectedMonth && dt.getFullYear() === selectedYear;
    });
  }, [cashTransactions, dateRange, selectedMonth, selectedYear]);

  const totalCashOutflow = useMemo(() => {
    return currentCashOutflows.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  }, [currentCashOutflows]);

  // Fixed costs in current period (Custos Fixos / Indiretos recorrentes)
  const currentFixedCosts = useMemo(() => {
    return getResolvedFixedCostsForPeriod(
      fixedCosts,
      fixedCostPayments,
      dateRange,
      selectedMonth,
      selectedYear
    );
  }, [fixedCosts, fixedCostPayments, dateRange, selectedMonth, selectedYear]);

  const fixedCostsTotal = useMemo(() => {
    return currentFixedCosts.reduce((acc, fc) => acc + Number(fc.amount || 0), 0);
  }, [currentFixedCosts]);

  // Vencimentos de Custos Fixos (Alertas no período)
  const overdueFixedCosts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return currentFixedCosts.filter((fc) => {
      if (fc.is_paid) return false;
      const due = new Date(fc.due_date + 'T00:00:00');
      return due < today;
    });
  }, [currentFixedCosts]);

  const dueTodayFixedCosts = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return currentFixedCosts.filter((fc) => !fc.is_paid && fc.due_date === todayStr);
  }, [currentFixedCosts]);

  // Lucro Real (Verdadeiro Lucro Líquido):
  // Faturamento Líquido - Saídas - Taxa de Motoboys - Insumos a Pagar - Investimentos no Mês - Gastos com Freelancer - Custos Fixos
  const realProfit = useMemo(() => {
    const net = orderStats.net;
    const outflows = totalCashOutflow;
    const motoboys = courierAdditionalRatesOnly;
    const payables = payablesTotal;
    const investments = investmentsTotal;
    const freelancers = freelancersTotalCost;
    const fixed = fixedCostsTotal;

    const profit = net - outflows - motoboys - payables - investments - freelancers - fixed;
    const margin = net > 0 ? (profit / net) * 100 : 0;

    return {
      net,
      outflows,
      motoboys,
      payables,
      investments,
      freelancers,
      fixed,
      profit,
      margin
    };
  }, [orderStats.net, totalCashOutflow, courierAdditionalRatesOnly, payablesTotal, investmentsTotal, freelancersTotalCost, fixedCostsTotal]);

  // Monthly Goal & Open Days calculations (Section 22 & 23)
  const currentGoalObj = monthlyGoals.find(
    (g) => g.year === selectedYear && g.month === selectedMonth
  );
  const targetGoal = currentGoalObj ? Number(currentGoalObj.target_amount) : 30000;
  const remainingGoal = Math.max(0, targetGoal - orderStats.gross);
  const percentGoal = targetGoal > 0 ? (orderStats.gross / targetGoal) * 100 : 0;

  const daysAnalysis = useMemo(() => {
    const totalDaysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getMonth() + 1 === selectedMonth && today.getFullYear() === selectedYear;
    const currentDay = isCurrentMonth ? today.getDate() : totalDaysInMonth;

    const closedSet = new Set(closedDays.map((c) => c.closed_date));
    let remainingOpen = 0;
    let pastOpen = 0;

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateObj = new Date(selectedYear, selectedMonth - 1, d);
      // Tuesday = 2
      const isTuesday = dateObj.getDay() === 2;
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isClosed = isTuesday || closedSet.has(dateStr);

      if (!isClosed) {
        if (isCurrentMonth) {
          if (d < currentDay) {
            pastOpen++;
          } else {
            // d >= currentDay: today and upcoming days that are open to sell
            remainingOpen++;
          }
        } else if (today > dateObj) {
          pastOpen++;
        } else {
          remainingOpen++;
        }
      }
    }

    // If today is an open day and has orders, include today in pastOpen for realized average
    const todayStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
    const isTodayClosed = closedSet.has(todayStr) || (new Date(selectedYear, selectedMonth - 1, currentDay).getDay() === 2);
    const hasOrdersToday = orderStats.grossToday > 0;
    const finalPastOpen = (isCurrentMonth && hasOrdersToday && !isTodayClosed) ? pastOpen + 1 : pastOpen;

    return {
      pastOpen: Math.max(1, finalPastOpen),
      remainingOpen: Math.max(0, remainingOpen)
    };
  }, [selectedYear, selectedMonth, closedDays, orderStats.grossToday]);

  const dailyNeeded = daysAnalysis.remainingOpen > 0 && remainingGoal > 0
    ? remainingGoal / daysAnalysis.remainingOpen
    : 0;

  const dailyAverageRealized = orderStats.gross / daysAnalysis.pastOpen;
  const isAheadOfPace = dailyAverageRealized >= dailyNeeded;

  // Platform Breakdown (Section 25)
  const platformSummary = useMemo(() => {
    const defaultChannels = ['iFood', 'AiqFome', 'Cardápio Digital'];
    const channelSet = new Set<string>(defaultChannels);
    completedOrders.forEach((o) => {
      if (o.channel) channelSet.add(o.channel);
    });
    const channels = Array.from(channelSet);

    const rows = channels.map((ch) => {
      const chOrders = completedOrders.filter((o) => o.channel === ch);
      const pedidos = chOrders.length;
      const bruto = chOrders.reduce((acc, o) => acc + Number(o.gross_amount || 0), 0);
      const taxaPlataforma = chOrders.reduce((acc, o) => acc + Number(o.platform_fee_amount || 0), 0);
      const taxasMaquininha = chOrders.reduce((acc, o) => acc + Number(o.card_fee_amount || 0), 0);
      const outrosAjustes = chOrders.reduce((acc, o) => acc + Number(o.adjustment_amount || 0), 0);
      const liquido = chOrders.reduce((acc, o) => acc + Number(o.net_amount || 0), 0);

      return {
        canal: ch,
        pedidos,
        bruto,
        taxaPlataforma,
        taxasMaquininha,
        outrosAjustes,
        liquido
      };
    });

    const totalRow = {
      canal: 'TOTAL GERAL',
      pedidos: orderStats.count,
      bruto: orderStats.gross,
      taxaPlataforma: orderStats.platformFees,
      taxasMaquininha: orderStats.cardFees,
      outrosAjustes: orderStats.adjustments,
      liquido: orderStats.net
    };

    return { rows, totalRow };
  }, [completedOrders, orderStats]);

  // Attention Alerts (Section 28)
  const alerts = useMemo(() => {
    const list: Array<{ id: string; text: string; tab: TabType; type: 'danger' | 'warning' | 'info' }> = [];

    if (overduePayables.length > 0) {
      const val = overduePayables.reduce((acc, p) => acc + Number(p.amount), 0);
      list.push({
        id: 'overdue-bills',
        text: `${overduePayables.length} ${overduePayables.length === 1 ? 'insumo vencido' : 'insumos vencidos'} (${formatCurrency(val)})`,
        tab: 'payables',
        type: 'danger'
      });
    }

    if (overdueFixedCosts.length > 0) {
      const val = overdueFixedCosts.reduce((acc, fc) => acc + Number(fc.amount), 0);
      list.push({
        id: 'overdue-fixed-costs',
        text: `${overdueFixedCosts.length} ${overdueFixedCosts.length === 1 ? 'custo fixo vencido' : 'custos fixos vencidos'} (${formatCurrency(val)})`,
        tab: 'fixed_costs',
        type: 'danger'
      });
    }

    if (dueTodayPayables.length > 0) {
      const val = dueTodayPayables.reduce((acc, p) => acc + Number(p.amount), 0);
      list.push({
        id: 'due-today',
        text: `${dueTodayPayables.length} ${dueTodayPayables.length === 1 ? 'insumo vence hoje' : 'insumos vencem hoje'} (${formatCurrency(val)})`,
        tab: 'payables',
        type: 'warning'
      });
    }

    if (dueTodayFixedCosts.length > 0) {
      const val = dueTodayFixedCosts.reduce((acc, fc) => acc + Number(fc.amount), 0);
      list.push({
        id: 'due-today-fixed-costs',
        text: `${dueTodayFixedCosts.length} ${dueTodayFixedCosts.length === 1 ? 'custo fixo vence hoje' : 'custos fixos vencem hoje'} (${formatCurrency(val)})`,
        tab: 'fixed_costs',
        type: 'warning'
      });
    }

    const pendingOrders = currentOrders.filter((o) => o.has_pending_issue);
    if (pendingOrders.length > 0) {
      list.push({
        id: 'pending-orders',
        text: `${pendingOrders.length} ${pendingOrders.length === 1 ? 'pedido com pendência operacional' : 'pedidos com pendências operacionais'}`,
        tab: 'orders',
        type: 'warning'
      });
    }

    const editedOrders = currentOrders.filter((o) => o.is_manually_edited);
    if (editedOrders.length > 0) {
      list.push({
        id: 'edited-orders',
        text: `${editedOrders.length} ${editedOrders.length === 1 ? 'pedido com alteração manual' : 'pedidos com alterações manuais salvas'}`,
        tab: 'orders',
        type: 'info'
      });
    }

    if (freelancersPending > 0) {
      list.push({
        id: 'freelancers-pending',
        text: `Freelancers com pagamentos pendentes (${formatCurrency(freelancersPending)})`,
        tab: 'freelancers',
        type: 'warning'
      });
    }

    return list;
  }, [overduePayables, overdueFixedCosts, dueTodayPayables, dueTodayFixedCosts, currentOrders, freelancersPending]);

  // Period-over-period variations (exact day or period match - Section 30)
  const comparisonStats = useMemo(() => {
    const prevGross = prevOrderStats.gross;
    const prevCount = prevOrderStats.count;
    const prevNet = prevOrderStats.net;
    const prevTicket = prevOrderStats.avgTicket;

    const currGross = orderStats.gross;
    const currCount = orderStats.count;
    const currNet = orderStats.net;
    const currTicket = orderStats.avgTicket;

    const grossDiff = currGross - prevGross;
    const grossVar = prevGross > 0 ? (grossDiff / prevGross) * 100 : (currGross > 0 ? 100 : 0);

    const countDiff = currCount - prevCount;
    const countVar = prevCount > 0 ? (countDiff / prevCount) * 100 : (currCount > 0 ? 100 : 0);

    const netDiff = currNet - prevNet;
    const netVar = prevNet > 0 ? (netDiff / prevNet) * 100 : (currNet > 0 ? 100 : 0);

    const ticketDiff = currTicket - prevTicket;
    const ticketVar = prevTicket > 0 ? (ticketDiff / prevTicket) * 100 : (currTicket > 0 ? 100 : 0);

    return {
      grossDiff,
      grossVar,
      countDiff,
      countVar,
      netDiff,
      netVar,
      ticketDiff,
      ticketVar,
      hasData: currCount > 0 || prevCount > 0
    };
  }, [orderStats, prevOrderStats]);

  // Channel Breakdown comparison (iFood, AiqFome, Cardápio Digital)
  const channelComparison = useMemo(() => {
    const defaultChannels = ['iFood', 'AiqFome', 'Cardápio Digital'];
    const channelsSet = new Set(defaultChannels);
    completedOrders.forEach((o) => o.channel && channelsSet.add(o.channel));
    previousCompletedOrders.forEach((o) => o.channel && channelsSet.add(o.channel));

    return Array.from(channelsSet).map((ch) => {
      const curr = completedOrders.filter((o) => o.channel === ch);
      const currGross = curr.reduce((acc, o) => acc + Number(o.gross_amount || 0), 0);
      const currCount = curr.length;

      const prev = previousCompletedOrders.filter((o) => o.channel === ch);
      const prevGross = prev.reduce((acc, o) => acc + Number(o.gross_amount || 0), 0);
      const prevCount = prev.length;

      const grossDiff = currGross - prevGross;
      const grossVar = prevGross > 0 ? (grossDiff / prevGross) * 100 : (currGross > 0 ? 100 : 0);
      const countDiff = currCount - prevCount;

      return {
        channel: ch,
        currGross,
        currCount,
        prevGross,
        prevCount,
        grossDiff,
        grossVar,
        countDiff
      };
    }).filter((c) => c.currCount > 0 || c.prevCount > 0);
  }, [completedOrders, previousCompletedOrders]);

  return (
    <div className="page-container">
      {/* Top Welcome & Quick Actions (Section 29) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.85rem', color: '#F8FAFC' }}>Painel Executivo</h1>
            <span className="badge badge-success">Operação Ao Vivo</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Visão consolidada de vendas, taxas, motoboys, insumos, freelancers e metas
          </p>
        </div>

        {/* Quick Actions Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {dateRange && onDateRangeChange && (
            <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
          )}
          <button onClick={onOpenImport} className="btn btn-primary btn-sm">
            <UploadCloud size={15} />
            <span>Importar XLSX</span>
          </button>
          <button onClick={onOpenNewCash} className="btn btn-secondary btn-sm">
            <Wallet size={15} color="#FB7185" />
            <span>+ Saída</span>
          </button>
          <button onClick={onOpenNewPayable} className="btn btn-secondary btn-sm">
            <Receipt size={15} color="#FBBF24" />
            <span>+ Insumo</span>
          </button>
          <button onClick={onOpenNewInvestment} className="btn btn-secondary btn-sm">
            <TrendingUp size={15} color="#A855F7" />
            <span>+ Investimento</span>
          </button>
          <button onClick={onOpenClosedDay} className="btn btn-secondary btn-sm">
            <CalendarOff size={15} color="#FB7185" />
            <span>Dia Fechado</span>
          </button>
        </div>
      </div>

      {/* Attention Alerts Banner (Section 28) */}
      {alerts.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#FBBF24', fontWeight: 700, fontSize: '0.9rem' }}>
            <ShieldAlert size={18} />
            <span>PRECISA DA SUA ATENÇÃO ({alerts.length}):</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {alerts.map((al) => (
              <button
                key={al.id}
                onClick={() => onNavigate(al.tab)}
                className={`btn btn-sm ${
                  al.type === 'danger' ? 'btn-danger' : 
                  al.type === 'warning' ? 'btn-secondary' : 'btn-secondary'
                }`}
                style={{
                  fontSize: '0.78rem',
                  borderColor: al.type === 'danger' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)',
                  color: al.type === 'danger' ? '#FB7185' : '#FBBF24'
                }}
              >
                <span>• {al.text}</span>
                <ArrowRight size={12} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lucro Real (Verdadeiro Lucro Líquido) - Master Executive Card */}
      <div style={{
        background: realProfit.profit >= 0 
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 78, 59, 0.25) 100%)'
          : 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(153, 27, 27, 0.25) 100%)',
        border: `1px solid ${realProfit.profit >= 0 ? 'rgba(52, 211, 153, 0.4)' : 'rgba(248, 113, 113, 0.4)'}`,
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '24px',
        boxShadow: realProfit.profit >= 0 
          ? '0 8px 24px -6px rgba(16, 185, 129, 0.2)'
          : '0 8px 24px -6px rgba(239, 68, 68, 0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: realProfit.profit >= 0 ? 'rgba(52, 211, 153, 0.2)' : 'rgba(248, 113, 113, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: realProfit.profit >= 0 ? '#34D399' : '#F87171'
            }}>
              <Sparkles size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
                  Lucro Real (Verdadeiro Lucro Líquido)
                </h2>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '20px',
                  background: realProfit.profit >= 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)',
                  color: realProfit.profit >= 0 ? '#34D399' : '#F87171',
                  border: `1px solid ${realProfit.profit >= 0 ? 'rgba(52, 211, 153, 0.4)' : 'rgba(248, 113, 113, 0.4)'}`
                }}>
                  {realProfit.margin.toFixed(1)}% de Margem Real
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0, marginTop: '2px' }}>
                Faturamento Líquido descontado de todas as despesas operacionais do período
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '2.2rem',
              fontWeight: 800,
              color: realProfit.profit >= 0 ? '#34D399' : '#F87171',
              letterSpacing: '-0.02em',
              lineHeight: 1.1
            }}>
              {formatCurrency(realProfit.profit)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Sobrou líquido no negócio
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
          gap: '8px',
          paddingTop: '14px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>(+) Faturamento Líquido</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#34D399' }}>{formatCurrency(realProfit.net)}</div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>(-) Saídas do Caixa</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#FB7185' }}>-{formatCurrency(realProfit.outflows)}</div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>(-) Taxas de Motoboys</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#FB7185' }}>-{formatCurrency(realProfit.motoboys)}</div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>(-) Insumos a Pagar</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#FBBF24' }}>-{formatCurrency(realProfit.payables)}</div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>(-) Investimentos</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#A855F7' }}>-{formatCurrency(realProfit.investments)}</div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>(-) Freelancers</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#38BDF8' }}>-{formatCurrency(realProfit.freelancers)}</div>
          </div>

          <div 
            onClick={() => onNavigate('fixed_costs')}
            style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(56, 189, 248, 0.2)' }}
            title="Ver e gerenciar Custos Fixos"
          >
            <div style={{ fontSize: '0.72rem', color: '#38BDF8', fontWeight: 600 }}>(-) Custos Fixos</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#38BDF8' }}>-{formatCurrency(realProfit.fixed)}</div>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards Grid (Section 24) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '12px',
        marginBottom: '24px'
      }}>
        {/* 1. Meta do Mês */}
        <div className="kpi-card" onClick={() => onNavigate('goals')} style={{ cursor: 'pointer' }}>
          <div className="kpi-title">
            <span>Meta do Mês</span>
            <Target size={16} color="#F43F5E" />
          </div>
          <div className="kpi-value" style={{ color: '#F8FAFC' }}>{formatCurrency(targetGoal)}</div>
          <div className="kpi-subtitle" style={{ color: percentGoal >= 100 ? '#34D399' : '#FBBF24', fontWeight: 600 }}>
            {percentGoal.toFixed(1)}% atingido
          </div>
        </div>

        {/* 2. Faturamento Bruto */}
        <div className="kpi-card" onClick={() => onNavigate('orders')} style={{ cursor: 'pointer' }}>
          <div className="kpi-title">
            <span>Faturamento Bruto</span>
            <DollarSign size={16} color="#34D399" />
          </div>
          <div className="kpi-value" style={{ color: '#34D399' }}>{formatCurrency(orderStats.gross)}</div>
          <div className="kpi-subtitle">
            {orderStats.count} pedidos concluídos
          </div>
        </div>

        {/* 3. Faturamento Líquido */}
        <div className="kpi-card" onClick={() => onNavigate('orders')} style={{ cursor: 'pointer', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
          <div className="kpi-title" style={{ color: '#34D399' }}>
            <span>Faturamento Líquido</span>
            <Sparkles size={16} color="#34D399" />
          </div>
          <div className="kpi-value" style={{ color: '#34D399' }}>{formatCurrency(orderStats.net)}</div>
          <div className="kpi-subtitle">Após taxas e ajustes</div>
        </div>

        {/* 4. Ritmo Necessário / Dia Aberto */}
        <div className="kpi-card" onClick={() => onNavigate('goals')} style={{ cursor: 'pointer' }}>
          <div className="kpi-title">
            <span>Ritmo / Dia Aberto</span>
            <Flame size={16} color="#F59E0B" />
          </div>
          <div className="kpi-value" style={{ color: '#FBBF24' }}>{formatCurrency(dailyNeeded)}</div>
          <div className="kpi-subtitle">
            {daysAnalysis.remainingOpen} dias restantes de venda
          </div>
        </div>

        {/* 5. Vendas de Hoje */}
        <div className="kpi-card">
          <div className="kpi-title">
            <span>Faturamento de Hoje</span>
            <Clock size={16} color="#38BDF8" />
          </div>
          <div className="kpi-value" style={{ color: '#38BDF8' }}>{formatCurrency(orderStats.grossToday)}</div>
          <div className="kpi-subtitle">Vendas do dia atual</div>
        </div>

        {/* 6. Ticket Médio */}
        <div className="kpi-card">
          <div className="kpi-title">
            <span>Ticket Médio</span>
            <ShoppingBag size={16} color="#A855F7" />
          </div>
          <div className="kpi-value">{formatCurrency(orderStats.avgTicket)}</div>
          <div className="kpi-subtitle">Por pedido concluído</div>
        </div>

        {/* 7. Saídas */}
        <div className="kpi-card" onClick={() => onNavigate('cash')} style={{ cursor: 'pointer' }}>
          <div className="kpi-title" style={{ color: '#FB7185' }}>
            <span>Saídas</span>
            <Wallet size={16} color="#FB7185" />
          </div>
          <div className="kpi-value" style={{ color: '#FB7185' }}>
            {totalCashOutflow > 0 ? `-${formatCurrency(totalCashOutflow)}` : formatCurrency(0)}
          </div>
          <div className="kpi-subtitle" style={{ color: '#FB7185' }}>
            Despesas pagas no caixa
          </div>
        </div>

        {/* 8. TAXAS DE MOTOBOYS (CRITICAL RULE: ONLY NEIGHBORHOOD ADDITIONALS, NO R$ 8 BASE) */}
        <div className="kpi-card" onClick={() => onNavigate('couriers')} style={{ cursor: 'pointer', borderLeft: '4px solid #F43F5E' }}>
          <div className="kpi-title" style={{ color: '#FB7185' }}>
            <span>Taxas de Motoboys (Adicionais)</span>
            <Bike size={16} color="#FB7185" />
          </div>
          <div className="kpi-value" style={{ color: '#FB7185' }}>
            {formatCurrency(courierAdditionalRatesOnly)}
          </div>
          <div className="kpi-subtitle" style={{ color: '#FB7185' }}>
            Apenas adicional de bairros (sem base R$8)
          </div>
        </div>
      </div>

      {/* Secondary Cards: Insumos, Investimentos, Custos Fixos, Freelancers, Contas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div className="kpi-card" onClick={() => onNavigate('fixed_costs')} style={{ cursor: 'pointer', borderLeft: '4px solid #38BDF8' }}>
          <div className="kpi-title" style={{ color: '#38BDF8' }}>
            <span>Custos Fixos / Indiretos</span>
            <Building2 size={16} color="#38BDF8" />
          </div>
          <div className="kpi-value" style={{ color: '#38BDF8' }}>{formatCurrency(fixedCostsTotal)}</div>
          <div className="kpi-subtitle">{currentFixedCosts.length} despesa{currentFixedCosts.length !== 1 ? 's' : ''} no período</div>
        </div>

        <div className="kpi-card" onClick={() => onNavigate('payables')} style={{ cursor: 'pointer' }}>
          <div className="kpi-title">Insumos a Pagar</div>
          <div className="kpi-value" style={{ color: '#F8FAFC' }}>{formatCurrency(payablesTotal)}</div>
          <div className="kpi-subtitle">{currentPayables.length} contas no mês</div>
        </div>

        <div className="kpi-card" onClick={() => onNavigate('investments')} style={{ cursor: 'pointer' }}>
          <div className="kpi-title">Investimentos no Mês</div>
          <div className="kpi-value" style={{ color: '#F8FAFC' }}>{formatCurrency(investmentsTotal)}</div>
          <div className="kpi-subtitle">{currentInvestments.length} compras cadastradas</div>
        </div>

        <div className="kpi-card" onClick={() => onNavigate('freelancers')} style={{ cursor: 'pointer' }}>
          <div className="kpi-title">Freelancers Pendente</div>
          <div className="kpi-value" style={{ color: freelancersPending > 0 ? '#FBBF24' : '#34D399' }}>
            {formatCurrency(freelancersPending)}
          </div>
          <div className="kpi-subtitle">Custo total: {formatCurrency(freelancersTotalCost)}</div>
        </div>

        <div className="kpi-card" onClick={() => onNavigate('payables')} style={{ cursor: 'pointer', borderColor: overduePayables.length > 0 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)' }}>
          <div className="kpi-title" style={{ color: overduePayables.length > 0 ? '#FB7185' : 'var(--text-secondary)' }}>
            Boletos Vencidos
          </div>
          <div className="kpi-value" style={{ color: overduePayables.length > 0 ? '#FB7185' : '#34D399' }}>
            {overduePayables.length}
          </div>
          <div className="kpi-subtitle">
            {overduePayables.length === 0 ? 'Tudo em dia!' : 'Requer liquidação'}
          </div>
        </div>
      </div>

      {/* Platform Sales Breakdown Table (Section 25) */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="#F43F5E" />
            <span>Resumo de Vendas por Plataforma ({dateRange?.label || `Mês ${selectedMonth}/${selectedYear}`})</span>
          </div>
          <button onClick={() => onNavigate('orders')} className="btn btn-secondary btn-sm">
            Ver Todos os Pedidos <ArrowRight size={13} />
          </button>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plataforma</th>
                <th>Pedidos</th>
                <th>Faturamento Bruto</th>
                <th>Taxa da Plataforma</th>
                <th>Taxas da Maquininha</th>
                <th>Outros Ajustes</th>
                <th>Faturamento Líquido</th>
              </tr>
            </thead>
            <tbody>
              {platformSummary.rows.map((row) => (
                <tr key={row.canal}>
                  <td style={{ fontWeight: 700 }}>
                    <span className={`badge ${
                      row.canal === 'iFood' ? 'badge-danger' :
                      row.canal === 'AiqFome' ? 'badge-warning' : 'badge-info'
                    }`}>
                      {row.canal}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{row.pedidos}</td>
                  <td style={{ fontWeight: 600, color: '#F8FAFC' }}>{formatCurrency(row.bruto)}</td>
                  <td style={{ color: '#FB7185' }}>-{formatCurrency(row.taxaPlataforma)}</td>
                  <td style={{ color: '#FBBF24' }}>-{formatCurrency(row.taxasMaquininha)}</td>
                  <td style={{ color: '#38BDF8' }}>-{formatCurrency(row.outrosAjustes)}</td>
                  <td style={{ fontWeight: 800, color: '#34D399', fontSize: '1rem' }}>
                    {formatCurrency(row.liquido)}
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', fontWeight: 800 }}>
                <td style={{ color: '#F8FAFC' }}>TOTAL GERAL</td>
                <td>{platformSummary.totalRow.pedidos}</td>
                <td style={{ color: '#F8FAFC' }}>{formatCurrency(platformSummary.totalRow.bruto)}</td>
                <td style={{ color: '#FB7185' }}>-{formatCurrency(platformSummary.totalRow.taxaPlataforma)}</td>
                <td style={{ color: '#FBBF24' }}>-{formatCurrency(platformSummary.totalRow.taxasMaquininha)}</td>
                <td style={{ color: '#38BDF8' }}>-{formatCurrency(platformSummary.totalRow.outrosAjustes)}</td>
                <td style={{ color: '#34D399', fontSize: '1.05rem' }}>
                  {formatCurrency(platformSummary.totalRow.liquido)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Month / Day Comparison (Section 30) */}
      {comparisonStats.hasData && (
        <div className="card" style={{ padding: '22px' }}>
          {/* Top Bar of Comparison */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '18px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '14px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <TrendingUp size={20} color="#34D399" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
                  Comparativo de Vendas vs Mês Anterior
                </h3>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                  color: '#38BDF8',
                  fontWeight: 600
                }}>
                  {comparisonInfo.isSingleDay ? 'Dia a Dia' : comparisonInfo.isFullMonth ? 'Mês Fechado' : 'Período Equivalente'}
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Comparando <strong style={{ color: '#F8FAFC' }}>{comparisonInfo.currentLabel}</strong> com <strong style={{ color: '#F8FAFC' }}>{comparisonInfo.previousLabel}</strong> ({comparisonInfo.modeDescription})
              </p>
            </div>

            {/* Toggle Mode for single day comparison */}
            {comparisonInfo.isSingleDay && (
              <div style={{
                display: 'inline-flex',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                gap: '4px'
              }}>
                <button
                  type="button"
                  onClick={() => setComparisonMode('calendar_day')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: comparisonMode === 'calendar_day' ? 'var(--accent-primary)' : 'transparent',
                    color: comparisonMode === 'calendar_day' ? '#FFFFFF' : 'var(--text-secondary)',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Compara o mesmo dia numérico do mês"
                >
                  <Calendar size={13} />
                  <span>Mesmo Dia ({comparisonInfo.targetDayOfWeekName?.slice(0, 3)} vs {comparisonInfo.previousDayOfWeekName?.slice(0, 3)})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setComparisonMode('weekday')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: comparisonMode === 'weekday' ? 'var(--accent-primary)' : 'transparent',
                    color: comparisonMode === 'weekday' ? '#FFFFFF' : 'var(--text-secondary)',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Compara com o mesmo dia da semana no mês anterior"
                >
                  <ArrowUpDown size={13} />
                  <span>Mesmo Dia da Semana ({comparisonInfo.targetDayOfWeekName?.slice(0, 3)} vs {comparisonInfo.targetDayOfWeekName?.slice(0, 3)})</span>
                </button>
              </div>
            )}
          </div>

          {/* 4 KPI Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
            marginBottom: channelComparison.length > 0 ? '18px' : '0'
          }}>
            {/* 1. Faturamento Bruto */}
            <div style={{ backgroundColor: 'var(--bg-input)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Faturamento Bruto</span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: comparisonStats.grossVar >= 0 ? 'rgba(52, 211, 153, 0.12)' : 'rgba(251, 113, 133, 0.12)',
                  color: comparisonStats.grossVar >= 0 ? '#34D399' : '#FB7185'
                }}>
                  {comparisonStats.grossVar >= 0 ? '+' : ''}{comparisonStats.grossVar.toFixed(1)}%
                </span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '6px', color: '#F8FAFC' }}>
                {formatCurrency(orderStats.gross)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Anterior: {formatCurrency(prevOrderStats.gross)}</span>
                <span style={{ color: comparisonStats.grossDiff >= 0 ? '#34D399' : '#FB7185', fontWeight: 600 }}>
                  {comparisonStats.grossDiff >= 0 ? '+' : ''}{formatCurrency(comparisonStats.grossDiff)}
                </span>
              </div>
            </div>

            {/* 2. Total de Pedidos */}
            <div style={{ backgroundColor: 'var(--bg-input)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total de Pedidos</span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: comparisonStats.countVar >= 0 ? 'rgba(52, 211, 153, 0.12)' : 'rgba(251, 113, 133, 0.12)',
                  color: comparisonStats.countVar >= 0 ? '#34D399' : '#FB7185'
                }}>
                  {comparisonStats.countVar >= 0 ? '+' : ''}{comparisonStats.countVar.toFixed(1)}%
                </span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '6px', color: '#F8FAFC' }}>
                {orderStats.count} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>pedidos</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Anterior: {prevOrderStats.count} pedidos</span>
                <span style={{ color: comparisonStats.countDiff >= 0 ? '#34D399' : '#FB7185', fontWeight: 600 }}>
                  {comparisonStats.countDiff >= 0 ? '+' : ''}{comparisonStats.countDiff}
                </span>
              </div>
            </div>

            {/* 3. Faturamento Líquido */}
            <div style={{ backgroundColor: 'var(--bg-input)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Faturamento Líquido</span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: comparisonStats.netVar >= 0 ? 'rgba(52, 211, 153, 0.12)' : 'rgba(251, 113, 133, 0.12)',
                  color: comparisonStats.netVar >= 0 ? '#34D399' : '#FB7185'
                }}>
                  {comparisonStats.netVar >= 0 ? '+' : ''}{comparisonStats.netVar.toFixed(1)}%
                </span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '6px', color: '#34D399' }}>
                {formatCurrency(orderStats.net)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Anterior: {formatCurrency(prevOrderStats.net)}</span>
                <span style={{ color: comparisonStats.netDiff >= 0 ? '#34D399' : '#FB7185', fontWeight: 600 }}>
                  {comparisonStats.netDiff >= 0 ? '+' : ''}{formatCurrency(comparisonStats.netDiff)}
                </span>
              </div>
            </div>

            {/* 4. Ticket Médio */}
            <div style={{ backgroundColor: 'var(--bg-input)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ticket Médio</span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: comparisonStats.ticketVar >= 0 ? 'rgba(52, 211, 153, 0.12)' : 'rgba(251, 113, 133, 0.12)',
                  color: comparisonStats.ticketVar >= 0 ? '#34D399' : '#FB7185'
                }}>
                  {comparisonStats.ticketVar >= 0 ? '+' : ''}{comparisonStats.ticketVar.toFixed(1)}%
                </span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '6px', color: '#F8FAFC' }}>
                {formatCurrency(orderStats.avgTicket)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Anterior: {formatCurrency(prevOrderStats.avgTicket)}</span>
                <span style={{ color: comparisonStats.ticketDiff >= 0 ? '#34D399' : '#FB7185', fontWeight: 600 }}>
                  {comparisonStats.ticketDiff >= 0 ? '+' : ''}{formatCurrency(comparisonStats.ticketDiff)}
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown por Canal de Venda */}
          {channelComparison.length > 0 && (
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '10px',
              padding: '14px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Desempenho por Canal vs Mês Anterior
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                {channelComparison.map((ch) => (
                  <div key={ch.channel} style={{
                    backgroundColor: 'var(--bg-input)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '0.85rem' }}>{ch.channel}</span>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: ch.grossVar >= 0 ? '#34D399' : '#FB7185'
                      }}>
                        {ch.grossVar >= 0 ? '+' : ''}{ch.grossVar.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <span style={{ color: '#F8FAFC', fontWeight: 600 }}>{formatCurrency(ch.currGross)} ({ch.currCount} ped.)</span>
                      <span style={{ color: 'var(--text-muted)' }}>ant: {formatCurrency(ch.prevGross)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fallback note if previous period had 0 orders */}
          {prevOrderStats.count === 0 && (
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              fontSize: '0.8rem',
              color: '#38BDF8',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              ℹ️ No período correspondente do mês anterior ({comparisonInfo.previousLabel}) não constam vendas registradas ou o restaurante esteve fechado.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
