import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { 
  SystemSettings, 
  NeighborhoodRate, 
  NeighborhoodAlias, 
  Courier, 
  Order, 
  Delivery, 
  AccountsPayable, 
  Freelancer, 
  FreelancerShift, 
  Investment, 
  CashTransaction, 
  CashInitialBalance,
  MonthlyGoal, 
  ClosedDay, 
  PendingIssue,
  DateRange,
  DateFilterCategory,
  FixedCost
} from './types';
import { getDefaultDateRange } from './lib/dateUtils';
import { Sidebar, TabType } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { PerformanceView } from './components/performance/PerformanceView';
import { OrdersView } from './components/orders/OrdersView';
import { CouriersView } from './components/couriers/CouriersView';
import { PayablesView } from './components/payables/PayablesView';
import { FixedCostsView } from './components/fixed_costs/FixedCostsView';
import { FreelancersView } from './components/freelancers/FreelancersView';
import { ClockInView } from './components/freelancers/ClockInView';
import { InvestmentsView } from './components/investments/InvestmentsView';
import { CashView } from './components/cash/CashView';
import { GoalsView } from './components/goals/GoalsView';
import { SettingsView } from './components/settings/SettingsView';
import { ImportModal } from './components/imports/ImportModal';
import { LoginView } from './components/auth/LoginView';
import { authService, AuthUser } from './lib/auth';

const DEFAULT_SETTINGS: SystemSettings = {
  id: 1,
  ifood_fee_pct: 15.00,
  aiqfome_fee_pct: 15.00,
  card_debit_fee_pct: 1.64,
  card_credit_fee_pct: 3.53,
  site_free_shipping_cost: 8.00,
  coupon_suggested_amount: 10.00,
  courier_base_rate: 8.00,
  freelancer_default_rate: 15.00,
  fixed_closed_day: 'tuesday',
  payable_alert_days: 3,
  updated_at: new Date().toISOString()
};

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => authService.getCurrentUser());
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
  };

  // Per-category independent date filters (ensuring no global cross-category overwrite)
  const [categoryDateRanges, setCategoryDateRanges] = useState<Record<DateFilterCategory, DateRange>>({
    dashboard: getDefaultDateRange(),
    performance: getDefaultDateRange(),
    orders: getDefaultDateRange(),
    couriers: getDefaultDateRange(),
    payables: getDefaultDateRange(),
    fixed_costs: getDefaultDateRange(),
    freelancers: getDefaultDateRange(),
    investments: getDefaultDateRange(),
    cash: getDefaultDateRange(),
    goals: getDefaultDateRange(),
  });

  const handleCategoryDateRangeChange = useCallback((category: DateFilterCategory, newRange: DateRange) => {
    setCategoryDateRanges((prev) => ({
      ...prev,
      [category]: newRange,
    }));
  }, []);

  const activeCategoryRange = (activeTab in categoryDateRanges)
    ? categoryDateRanges[activeTab as DateFilterCategory]
    : undefined;

  const handleActiveCategoryDateRangeChange = useCallback((newRange: DateRange) => {
    if (activeTab in categoryDateRanges) {
      handleCategoryDateRangeChange(activeTab as DateFilterCategory, newRange);
    }
  }, [activeTab, handleCategoryDateRangeChange]);

  // Global Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importModalTab, setImportModalTab] = useState<'import' | 'history'>('import');
  const [isClosedDayModalOpen, setIsClosedDayModalOpen] = useState<boolean>(false);
  const [isNewCashModalOpen, setIsNewCashModalOpen] = useState<boolean>(false);
  const [isNewPayableModalOpen, setIsNewPayableModalOpen] = useState<boolean>(false);
  const [isNewInvestmentModalOpen, setIsNewInvestmentModalOpen] = useState<boolean>(false);
  const [isNewFixedCostModalOpen, setIsNewFixedCostModalOpen] = useState<boolean>(false);

  const handleOpenImport = (tab: 'import' | 'history' = 'import') => {
    setImportModalTab(tab);
    setIsImportModalOpen(true);
  };

  // Data states
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [neighborhoodRates, setNeighborhoodRates] = useState<NeighborhoodRate[]>([]);
  const [neighborhoodAliases, setNeighborhoodAliases] = useState<NeighborhoodAlias[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [payables, setPayables] = useState<AccountsPayable[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [shifts, setShifts] = useState<FreelancerShift[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [initialBalances, setInitialBalances] = useState<CashInitialBalance[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([]);
  const [closedDays, setClosedDays] = useState<ClosedDay[]>([]);
  const [pendingIssues, setPendingIssues] = useState<PendingIssue[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAllData = useCallback(async () => {
    try {
      // 1. Settings
      const { data: sData } = await supabase.from('settings').select('*').limit(1).single();
      if (sData) setSettings(sData);

      // 2. Neighborhood Rates & Aliases
      const { data: nrData } = await supabase.from('neighborhood_rates').select('*').order('name');
      if (nrData) setNeighborhoodRates(nrData);

      const { data: naData } = await supabase.from('neighborhood_aliases').select('*');
      if (naData) setNeighborhoodAliases(naData);

      // 3. Couriers
      const { data: cData } = await supabase.from('couriers').select('*').order('name');
      if (cData) setCouriers(cData);

      // 4. Orders
      const { data: oData } = await supabase.from('orders').select('*').order('order_date', { ascending: false });
      if (oData) setOrders(oData);

      // 5. Deliveries
      const { data: dData } = await supabase.from('deliveries').select('*').order('delivery_date', { ascending: false });
      if (dData) setDeliveries(dData);

      // 6. Payables
      const { data: pData } = await supabase.from('accounts_payable').select('*').order('due_date', { ascending: true });
      if (pData) setPayables(pData);

      // 6.1. Fixed Costs (Custos Fixos)
      const { data: fcData } = await supabase.from('fixed_costs').select('*').order('due_date', { ascending: true });
      if (fcData) setFixedCosts(fcData);

      // 7. Freelancers & Shifts
      const { data: fData } = await supabase.from('freelancers').select('*').order('name');
      if (fData) setFreelancers(fData);

      const { data: fsData } = await supabase.from('freelancer_shifts').select('*').order('shift_date', { ascending: false });
      if (fsData) setShifts(fsData);

      // 8. Investments
      const { data: iData } = await supabase.from('investments').select('*').order('investment_date', { ascending: false });
      if (iData) setInvestments(iData);

      // 9. Cash Transactions & Initial Balance
      const { data: ctData } = await supabase.from('cash_transactions').select('*').order('transaction_date', { ascending: false });
      if (ctData) setCashTransactions(ctData);

      const { data: cibData } = await supabase.from('cash_initial_balance').select('*').order('created_at', { ascending: false });
      if (cibData) setInitialBalances(cibData);

      // 10. Goals & Closed Days
      const { data: mgData } = await supabase.from('monthly_goals').select('*');
      if (mgData) setMonthlyGoals(mgData);

      const { data: cdData } = await supabase.from('closed_days').select('*').order('closed_date');
      if (cdData) setClosedDays(cdData);

      // 11. Pending Issues
      const { data: piData } = await supabase.from('pending_issues').select('*').eq('status', 'open');
      if (piData) setPendingIssues(piData);
    } catch (err) {
      console.error('Error fetching data from Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Umami Zen - Gestão Financeira e Operacional';
    if (currentUser) {
      fetchAllData();
    } else {
      setIsLoading(false);
    }
  }, [currentUser, fetchAllData]);

  // Se não estiver autenticado, exibe obrigatoriamente a tela de Login
  if (!currentUser) {
    return <LoginView onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const pendingOrdersCount = orders.filter((o) => o.has_pending_issue).length;

  // Contadores de alerta para a barra lateral (vencidas ou vencendo dentro do prazo configurado)
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const alertDaysLimit = settings.payable_alert_days || 3;

  const payablesAlertCount = payables.filter((p) => {
    if (p.is_paid || p.status === 'paid') return false;
    const due = new Date(p.due_date + 'T00:00:00');
    const diffDays = Math.ceil((due.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= alertDaysLimit;
  }).length;

  const fixedCostsAlertCount = fixedCosts.filter((fc) => {
    if (fc.is_paid) return false;
    const due = new Date(fc.due_date + 'T00:00:00');
    const diffDays = Math.ceil((due.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= alertDaysLimit;
  }).length;

  // Render isolated Clock-In view for Freelancers (Section 18 & 33)
  if (activeTab === 'clockin') {
    return (
      <ClockInView
        freelancers={freelancers}
        onBackToDashboard={() => setActiveTab('dashboard')}
        onSuccess={fetchAllData}
      />
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        pendingCount={pendingOrdersCount}
        payablesAlertCount={payablesAlertCount}
        fixedCostsAlertCount={fixedCostsAlertCount}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <Header
          activeTab={activeTab}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenImport={() => handleOpenImport('import')}
          onOpenClosedDay={() => setIsClosedDayModalOpen(true)}
          onOpenNewCash={() => { setActiveTab('cash'); setIsNewCashModalOpen(true); }}
          onOpenNewPayable={() => { setActiveTab('payables'); setIsNewPayableModalOpen(true); }}
          onOpenNewInvestment={() => { setActiveTab('investments'); setIsNewInvestmentModalOpen(true); }}
          dateRange={activeCategoryRange}
          onDateRangeChange={handleActiveCategoryDateRangeChange}
          selectedMonth={activeCategoryRange ? activeCategoryRange.startDate.getMonth() + 1 : 9}
          selectedYear={activeCategoryRange ? activeCategoryRange.startDate.getFullYear() : 2026}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* View Switcher */}
        <main style={{ flex: 1 }}>
          {activeTab === 'dashboard' && (
            <DashboardView
              orders={orders}
              deliveries={deliveries}
              payables={payables}
              shifts={shifts}
              investments={investments}
              cashTransactions={cashTransactions}
              initialBalances={initialBalances}
              monthlyGoals={monthlyGoals}
              closedDays={closedDays}
              settings={settings}
              fixedCosts={fixedCosts}
              selectedMonth={categoryDateRanges.dashboard.startDate.getMonth() + 1}
              selectedYear={categoryDateRanges.dashboard.startDate.getFullYear()}
              dateRange={categoryDateRanges.dashboard}
              onDateRangeChange={(range) => handleCategoryDateRangeChange('dashboard', range)}
              onNavigate={setActiveTab}
              onOpenImport={() => handleOpenImport('import')}
              onOpenClosedDay={() => setIsClosedDayModalOpen(true)}
              onOpenNewCash={() => { setActiveTab('cash'); setIsNewCashModalOpen(true); }}
              onOpenNewPayable={() => { setActiveTab('payables'); setIsNewPayableModalOpen(true); }}
              onOpenNewInvestment={() => { setActiveTab('investments'); setIsNewInvestmentModalOpen(true); }}
            />
          )}

          {activeTab === 'performance' && (
            <PerformanceView
              orders={orders}
              deliveries={deliveries}
              payables={payables}
              fixedCosts={fixedCosts}
              shifts={shifts}
              investments={investments}
              cashTransactions={cashTransactions}
              settings={settings}
              selectedMonth={categoryDateRanges.performance.startDate.getMonth() + 1}
              selectedYear={categoryDateRanges.performance.startDate.getFullYear()}
              dateRange={categoryDateRanges.performance}
              onDateRangeChange={(range) => handleCategoryDateRangeChange('performance', range)}
              onRefresh={fetchAllData}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersView
              orders={orders}
              onRefresh={fetchAllData}
              settings={settings}
              neighborhoodRates={neighborhoodRates}
              couriers={couriers}
              selectedMonth={categoryDateRanges.orders.startDate.getMonth() + 1}
              selectedYear={categoryDateRanges.orders.startDate.getFullYear()}
              dateRange={categoryDateRanges.orders}
              onDateRangeChange={(range) => handleCategoryDateRangeChange('orders', range)}
              onOpenImport={handleOpenImport}
            />
          )}

          {activeTab === 'couriers' && (
            <CouriersView
              couriers={couriers}
              deliveries={deliveries}
              orders={orders}
              neighborhoodRates={neighborhoodRates}
              settings={settings}
              onRefresh={fetchAllData}
              selectedMonth={categoryDateRanges.couriers.startDate.getMonth() + 1}
              selectedYear={categoryDateRanges.couriers.startDate.getFullYear()}
              dateRange={categoryDateRanges.couriers}
              onDateRangeChange={(range) => handleCategoryDateRangeChange('couriers', range)}
            />
          )}

          {activeTab === 'payables' && (
            <PayablesView
              payables={payables}
              settings={settings}
              onRefresh={fetchAllData}
              selectedMonth={categoryDateRanges.payables.startDate.getMonth() + 1}
              selectedYear={categoryDateRanges.payables.startDate.getFullYear()}
              dateRange={categoryDateRanges.payables}
              onDateRangeChange={(range) => handleCategoryDateRangeChange('payables', range)}
              isCreateModalOpen={isNewPayableModalOpen}
              onCloseCreateModal={() => setIsNewPayableModalOpen(false)}
              monthlyGoals={monthlyGoals}
            />
          )}

          {activeTab === 'fixed_costs' && (
            <FixedCostsView
              fixedCosts={fixedCosts}
              onRefresh={fetchAllData}
              selectedMonth={categoryDateRanges.fixed_costs.startDate.getMonth() + 1}
              selectedYear={categoryDateRanges.fixed_costs.startDate.getFullYear()}
              dateRange={categoryDateRanges.fixed_costs}
              onDateRangeChange={(range) => handleCategoryDateRangeChange('fixed_costs', range)}
              isCreateModalOpen={isNewFixedCostModalOpen}
              onCloseCreateModal={() => setIsNewFixedCostModalOpen(false)}
              alertDays={settings.payable_alert_days || 3}
            />
          )}

          {activeTab === 'freelancers' && (
            <FreelancersView
              freelancers={freelancers}
              shifts={shifts}
              settings={settings}
              onRefresh={fetchAllData}
              selectedMonth={categoryDateRanges.freelancers.startDate.getMonth() + 1}
              selectedYear={categoryDateRanges.freelancers.startDate.getFullYear()}
              dateRange={categoryDateRanges.freelancers}
              onDateRangeChange={(range) => handleCategoryDateRangeChange('freelancers', range)}
            />
          )}

          {activeTab === 'investments' && (
            <InvestmentsView
              investments={investments}
              onRefresh={fetchAllData}
              selectedMonth={categoryDateRanges.investments.startDate.getMonth() + 1}
              selectedYear={categoryDateRanges.investments.startDate.getFullYear()}
              dateRange={categoryDateRanges.investments}
              onDateRangeChange={(range) => handleCategoryDateRangeChange('investments', range)}
              isCreateModalOpen={isNewInvestmentModalOpen}
              onCloseCreateModal={() => setIsNewInvestmentModalOpen(false)}
            />
          )}

          {activeTab === 'cash' && (
            <CashView
              transactions={cashTransactions}
              initialBalances={initialBalances}
              onRefresh={fetchAllData}
              selectedMonth={categoryDateRanges.cash.startDate.getMonth() + 1}
              selectedYear={categoryDateRanges.cash.startDate.getFullYear()}
              dateRange={categoryDateRanges.cash}
              onDateRangeChange={(range) => handleCategoryDateRangeChange('cash', range)}
              isCreateModalOpen={isNewCashModalOpen}
              onCloseCreateModal={() => setIsNewCashModalOpen(false)}
            />
          )}

          {activeTab === 'goals' && (
            <GoalsView
              monthlyGoals={monthlyGoals}
              closedDays={closedDays}
              orders={orders}
              onRefresh={fetchAllData}
              selectedMonth={categoryDateRanges.goals.startDate.getMonth() + 1}
              selectedYear={categoryDateRanges.goals.startDate.getFullYear()}
              dateRange={categoryDateRanges.goals}
              onDateRangeChange={(range) => handleCategoryDateRangeChange('goals', range)}
              isClosedDayModalOpen={isClosedDayModalOpen}
              onCloseClosedDayModal={() => setIsClosedDayModalOpen(false)}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              neighborhoodRates={neighborhoodRates}
              neighborhoodAliases={neighborhoodAliases}
              onRefresh={fetchAllData}
            />
          )}
        </main>
      </div>

      {/* Global Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchAllData}
        settings={settings}
        neighborhoodRates={neighborhoodRates}
        neighborhoodAliases={neighborhoodAliases}
        initialTab={importModalTab}
      />
    </div>
  );
};
export default App;
