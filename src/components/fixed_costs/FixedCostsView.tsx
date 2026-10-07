import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Calendar, 
  X,
  AlertCircle,
  Tag,
  Check,
  AlertTriangle,
  Bell,
  Repeat
} from 'lucide-react';
import { FixedCost, FixedCostPayment, DateRange } from '../../types';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { isDateInRange } from '../../lib/dateUtils';
import { supabase } from '../../lib/supabase';
import { DateRangePicker } from '../common/DateRangePicker';
import { 
  ResolvedFixedCost, 
  getResolvedFixedCostsForPeriod, 
  getFixedCostsForSingleMonth 
} from '../../lib/fixedCostUtils';

const FIXED_COST_CATEGORIES = [
  'Aluguel & Imóvel',
  'Marketing & Tráfego',
  'Internet & Telefonia',
  'Sistemas & Software',
  'Serviços Contábeis',
  'Energia, Água & Gás',
  'Segurança & Monitoramento',
  'Taxas & Licenças',
  'Outros Custos Indiretos'
];

const PAYMENT_METHODS = [
  'PIX',
  'Boleto',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Transferência',
  'Débito Automático',
  'Dinheiro'
];

interface FixedCostsViewProps {
  fixedCosts: FixedCost[];
  fixedCostPayments?: FixedCostPayment[];
  onRefresh: () => void;
  selectedMonth: number;
  selectedYear: number;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  isCreateModalOpen?: boolean;
  onCloseCreateModal?: () => void;
  alertDays?: number;
}

export const FixedCostsView: React.FC<FixedCostsViewProps> = ({
  fixedCosts,
  fixedCostPayments = [],
  onRefresh,
  selectedMonth,
  selectedYear,
  dateRange,
  onDateRangeChange,
  isCreateModalOpen = false,
  onCloseCreateModal,
  alertDays = 3
}) => {
  // Modal states
  const [showModal, setShowModal] = useState<boolean>(isCreateModalOpen);
  const [editingItem, setEditingItem] = useState<FixedCost | ResolvedFixedCost | null>(null);
  const [deletingItem, setDeletingItem] = useState<FixedCost | ResolvedFixedCost | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    category: FIXED_COST_CATEGORIES[0],
    amount: '',
    due_date: new Date().toISOString().split('T')[0],
    recurrence: 'monthly' as 'monthly' | 'yearly' | 'one_time',
    is_paid: true,
    payment_method: 'PIX',
    notes: ''
  });

  // Filter states
  const [periodFilter, setPeriodFilter] = useState<string>('period');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // React to prop change
  React.useEffect(() => {
    if (isCreateModalOpen) {
      handleOpenCreate();
    }
  }, [isCreateModalOpen]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      category: FIXED_COST_CATEGORIES[0],
      amount: '',
      due_date: new Date().toISOString().split('T')[0],
      recurrence: 'monthly',
      is_paid: true,
      payment_method: 'PIX',
      notes: ''
    });
    setErrorMsg(null);
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: FixedCost | ResolvedFixedCost) => {
    const original = fixedCosts.find(fc => fc.id === ((item as any).originalId || item.id)) || item;
    setEditingItem(original);
    setFormData({
      name: original.name,
      category: original.category || 'Outros Custos Indiretos',
      amount: String(original.amount),
      due_date: original.due_date,
      recurrence: original.recurrence || 'monthly',
      is_paid: item.is_paid,
      payment_method: item.payment_method || 'PIX',
      notes: original.notes || ''
    });
    setErrorMsg(null);
    setShowModal(true);
  };

  // 1. Resolve fixed costs for the active period (supporting recurring monthly costs)
  const resolvedFixedCosts = useMemo(() => {
    if (periodFilter === 'all') {
      return getFixedCostsForSingleMonth(fixedCosts, fixedCostPayments, selectedYear, selectedMonth);
    }
    return getResolvedFixedCostsForPeriod(
      fixedCosts,
      fixedCostPayments,
      dateRange,
      selectedMonth,
      selectedYear
    );
  }, [fixedCosts, fixedCostPayments, periodFilter, dateRange, selectedMonth, selectedYear]);

  // 2. Compute live status based on due date and is_paid flag for this month
  const computedFixedCosts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return resolvedFixedCosts.map((c) => {
      if (c.is_paid) {
        return { ...c, calculatedStatus: 'paid' as const, diffDays: null };
      }

      const due = new Date(c.due_date + 'T00:00:00');
      const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return { ...c, calculatedStatus: 'overdue' as const, diffDays };
      } else if (diffDays === 0) {
        return { ...c, calculatedStatus: 'due_today' as const, diffDays };
      } else if (diffDays <= alertDays) {
        return { ...c, calculatedStatus: 'due_soon' as const, diffDays };
      } else {
        return { ...c, calculatedStatus: 'pending' as const, diffDays };
      }
    });
  }, [resolvedFixedCosts, alertDays]);

  // 3. Filter fixed costs according to search, category and status
  const filteredCosts = useMemo(() => {
    return computedFixedCosts.filter((cost) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = cost.name.toLowerCase().includes(q);
        const matchesCat = cost.category.toLowerCase().includes(q);
        const matchesNotes = cost.notes ? cost.notes.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesCat && !matchesNotes) return false;
      }

      // Category
      if (categoryFilter !== 'all' && cost.category !== categoryFilter) {
        return false;
      }

      // Status
      if (statusFilter === 'overdue' && cost.calculatedStatus !== 'overdue') return false;
      if (statusFilter === 'due_today' && cost.calculatedStatus !== 'due_today') return false;
      if (statusFilter === 'due_soon' && cost.calculatedStatus !== 'due_soon') return false;
      if (statusFilter === 'paid' && !cost.is_paid) return false;
      if (statusFilter === 'unpaid' && cost.is_paid) return false;

      return true;
    });
  }, [computedFixedCosts, searchQuery, categoryFilter, statusFilter]);

  // Totals & Alerts calculations
  const stats = useMemo(() => {
    const total = filteredCosts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paid = filteredCosts.filter(c => c.is_paid).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const pending = filteredCosts.filter(c => !c.is_paid).reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const overdue = computedFixedCosts.filter(c => c.calculatedStatus === 'overdue');
    const dueToday = computedFixedCosts.filter(c => c.calculatedStatus === 'due_today');
    const dueSoon = computedFixedCosts.filter(c => c.calculatedStatus === 'due_soon');

    const overdueTotal = overdue.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const dueTodayTotal = dueToday.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const dueSoonTotal = dueSoon.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      total,
      paid,
      pending,
      count: filteredCosts.length,
      overdueCount: overdue.length,
      overdueTotal,
      dueTodayCount: dueToday.length,
      dueTodayTotal,
      dueSoonCount: dueSoon.length,
      dueSoonTotal
    };
  }, [filteredCosts, computedFixedCosts]);

  // Save / Submit (Create or Edit)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg('Por favor, informe a descrição ou nome do custo fixo.');
      return;
    }

    const numAmount = parseFloat(formData.amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Informe um valor válido maior que zero.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      if (editingItem) {
        const targetId = (editingItem as any).originalId || editingItem.id;
        // Update existing base cost
        const { error } = await supabase
          .from('fixed_costs')
          .update({
            name: formData.name.trim(),
            category: formData.category,
            amount: numAmount,
            due_date: formData.due_date,
            recurrence: formData.recurrence,
            payment_method: formData.payment_method,
            notes: formData.notes.trim() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', targetId);

        if (error) throw error;

        // Also update payment record for this month
        const activeYM = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        await supabase
          .from('fixed_cost_payments')
          .upsert({
            fixed_cost_id: targetId,
            year_month: activeYM,
            is_paid: formData.is_paid,
            paid_amount: numAmount,
            payment_date: formData.is_paid ? new Date().toISOString().split('T')[0] : null,
            payment_method: formData.payment_method,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'fixed_cost_id,year_month'
          });
      } else {
        // Insert new
        const { data: inserted, error } = await supabase
          .from('fixed_costs')
          .insert({
            name: formData.name.trim(),
            category: formData.category,
            amount: numAmount,
            due_date: formData.due_date,
            recurrence: formData.recurrence,
            is_paid: formData.is_paid,
            payment_method: formData.payment_method,
            notes: formData.notes.trim() || null
          })
          .select()
          .single();

        if (error) throw error;

        if (inserted) {
          const ym = formData.due_date.slice(0, 7);
          await supabase
            .from('fixed_cost_payments')
            .upsert({
              fixed_cost_id: inserted.id,
              year_month: ym,
              is_paid: formData.is_paid,
              paid_amount: numAmount,
              payment_date: formData.is_paid ? new Date().toISOString().split('T')[0] : null,
              payment_method: formData.payment_method,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'fixed_cost_id,year_month'
            });
        }
      }

      setShowModal(false);
      if (onCloseCreateModal) onCloseCreateModal();
      onRefresh();
    } catch (err: any) {
      console.error('Error saving fixed cost:', err);
      setErrorMsg(err.message || 'Erro ao salvar custo fixo.');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Paid status directly from list (saves per-month in fixed_cost_payments)
  const handleTogglePaid = async (item: ResolvedFixedCost) => {
    try {
      const newPaid = !item.is_paid;
      const todayStr = new Date().toISOString().split('T')[0];
      const targetId = item.originalId || item.id;
      const targetYM = item.year_month;

      // 1. Upsert into fixed_cost_payments for this specific month
      const { error: pError } = await supabase
        .from('fixed_cost_payments')
        .upsert({
          fixed_cost_id: targetId,
          year_month: targetYM,
          is_paid: newPaid,
          paid_amount: Number(item.amount),
          payment_date: newPaid ? todayStr : null,
          payment_method: item.payment_method || 'PIX',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'fixed_cost_id,year_month'
        });

      if (pError) throw pError;

      // 2. Also keep base fixed_costs in sync if it is the registration month
      const origYM = item.due_date ? item.due_date.slice(0, 7) : '';
      if (origYM === targetYM) {
        await supabase
          .from('fixed_costs')
          .update({
            is_paid: newPaid,
            payment_date: newPaid ? todayStr : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', targetId);
      }

      onRefresh();
    } catch (err: any) {
      console.error('Error toggling paid state:', err);
      alert('Erro ao atualizar status de pagamento: ' + (err.message || 'Erro desconhecido'));
    }
  };

  // Delete item
  const handleDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      const targetId = (deletingItem as any).originalId || deletingItem.id;
      const { error } = await supabase
        .from('fixed_costs')
        .delete()
        .eq('id', targetId);

      if (error) throw error;
      setDeletingItem(null);
      onRefresh();
    } catch (err: any) {
      console.error('Error deleting fixed cost:', err);
      alert('Erro ao excluir custo fixo: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="page-container">
      {/* Top Header & Filters */}
      <div className="view-header">
        <div className="view-header-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38BDF8'
            }}>
              <Building2 size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', color: '#F8FAFC', margin: 0 }}>Custos Fixos & Indiretos</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '2px 0 0 0' }}>
                Custos fixos recorrentes para todos os meses a partir do cadastro • Baixa individual mensal
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons & Date Range */}
        <div className="view-toolbar">
          {dateRange && onDateRangeChange && (
            <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
          )}
          <button 
            onClick={handleOpenCreate} 
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} />
            <span>Novo Custo Fixo</span>
          </button>
        </div>
      </div>

      {/* Alert Cards (Vencimentos & Alertas) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        {/* Contas Vencidas */}
        <div className="kpi-card" style={{ borderColor: stats.overdueCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)' }}>
          <div className="kpi-title" style={{ color: stats.overdueCount > 0 ? '#FB7185' : 'var(--text-secondary)' }}>
            <span>Custos Vencidos</span>
            <AlertCircle size={16} color={stats.overdueCount > 0 ? '#FB7185' : 'var(--text-muted)'} />
          </div>
          <div className="kpi-value" style={{ color: stats.overdueCount > 0 ? '#FB7185' : '#F8FAFC' }}>
            {formatCurrency(stats.overdueTotal)}
          </div>
          <div className="kpi-subtitle" style={{ color: '#FB7185' }}>
            {stats.overdueCount} {stats.overdueCount === 1 ? 'custo vencido' : 'custos vencidos'}
          </div>
        </div>

        {/* Vencem Hoje */}
        <div className="kpi-card" style={{ borderColor: stats.dueTodayCount > 0 ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-color)' }}>
          <div className="kpi-title" style={{ color: stats.dueTodayCount > 0 ? '#FBBF24' : 'var(--text-secondary)' }}>
            <span>Vencem Hoje</span>
            <Bell size={16} color={stats.dueTodayCount > 0 ? '#FBBF24' : 'var(--text-muted)'} />
          </div>
          <div className="kpi-value" style={{ color: stats.dueTodayCount > 0 ? '#FBBF24' : '#F8FAFC' }}>
            {formatCurrency(stats.dueTodayTotal)}
          </div>
          <div className="kpi-subtitle" style={{ color: '#FBBF24' }}>
            {stats.dueTodayCount} {stats.dueTodayCount === 1 ? 'custo vence hoje' : 'custos vencem hoje'}
          </div>
        </div>

        {/* Vencem em breve */}
        <div className="kpi-card">
          <div className="kpi-title" style={{ color: stats.dueSoonCount > 0 ? '#38BDF8' : 'var(--text-secondary)' }}>
            <span>Vencem em até {alertDays} dias</span>
            <Clock size={16} color={stats.dueSoonCount > 0 ? '#38BDF8' : 'var(--text-muted)'} />
          </div>
          <div className="kpi-value" style={{ color: '#38BDF8' }}>
            {formatCurrency(stats.dueSoonTotal)}
          </div>
          <div className="kpi-subtitle">
            {stats.dueSoonCount} {stats.dueSoonCount === 1 ? 'custo próximo' : 'custos próximos'}
          </div>
        </div>

        {/* Total Liquidado / Pago */}
        <div className="kpi-card">
          <div className="kpi-title" style={{ color: '#34D399' }}>
            <span>Total Liquidado</span>
            <CheckCircle2 size={16} color="#34D399" />
          </div>
          <div className="kpi-value" style={{ color: '#34D399' }}>
            {formatCurrency(stats.paid)}
          </div>
          <div className="kpi-subtitle">
            Baixados como pagos
          </div>
        </div>

        {/* Deduzido do Lucro Real */}
        <div className="kpi-card" style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))' }}>
          <div className="kpi-title" style={{ color: '#FBBF24' }}>
            <span>Deduzido do Lucro Real</span>
            <DollarSign size={16} color="#FBBF24" />
          </div>
          <div className="kpi-value" style={{ color: '#FBBF24' }}>
            -{formatCurrency(stats.total)}
          </div>
          <div className="kpi-subtitle">
            {stats.count} despesas no período
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ padding: '14px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={16} color="#64748B" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text"
              placeholder="Buscar custo fixo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
              style={{ paddingLeft: '36px' }}
            />
          </div>

          {/* Period Filter */}
          <select
            className="select"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            style={{ width: '220px' }}
          >
            <option value="all">Todas as Datas</option>
            <option value="period">Período ({dateRange?.label || `${selectedMonth}/${selectedYear}`})</option>
          </select>

          {/* Status Filter com Alertas */}
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '200px' }}
          >
            <option value="all">Todos os Status</option>
            <option value="overdue">⚠️ Vencidos</option>
            <option value="due_today">🔔 Vence Hoje</option>
            <option value="due_soon">⏰ Vencem nos próximos {alertDays} dias</option>
            <option value="unpaid">Em Aberto (não pagos)</option>
            <option value="paid">✅ Pagos</option>
          </select>

          {/* Category Filter */}
          <select
            className="select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: '200px' }}
          >
            <option value="all">Todas as Categorias</option>
            {FIXED_COST_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {(searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' || periodFilter !== 'period') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
                setStatusFilter('all');
                setPeriodFilter('period');
              }}
              className="btn btn-secondary btn-sm"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Main Table / List */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Custo Fixo</th>
                <th>Categoria</th>
                <th>Vencimento</th>
                <th>Forma de Pgto</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredCosts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)' }}>
                    <Building2 size={36} style={{ opacity: 0.3, marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontSize: '0.95rem' }}>Nenhum custo fixo encontrado para o período ou filtros selecionados.</p>
                  </td>
                </tr>
              ) : (
                filteredCosts.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, color: '#F8FAFC', fontSize: '0.95rem' }}>
                            {item.name}
                          </span>
                          {item.recurrence !== 'one_time' ? (
                            <span style={{
                              fontSize: '0.68rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(56, 189, 248, 0.12)',
                              color: '#38BDF8',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}>
                              <Repeat size={10} /> Mensal
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '0.68rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(148, 163, 184, 0.12)',
                              color: '#94A3B8',
                              fontWeight: 600
                            }}>
                              Único
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {item.notes}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: '#CBD5E1',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                      }}>
                        <Tag size={11} color="#38BDF8" />
                        {item.category}
                      </span>
                    </td>

                    <td>
                      <span style={{
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        color: item.calculatedStatus === 'overdue' ? '#FB7185' :
                               item.calculatedStatus === 'due_today' ? '#FBBF24' :
                               item.calculatedStatus === 'due_soon' ? '#38BDF8' : '#E2E8F0'
                      }}>
                        {formatDate(item.due_date)}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {item.payment_method || 'Não especificado'}
                      </span>
                    </td>

                    <td>
                      <button
                        onClick={() => handleTogglePaid(item)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0
                        }}
                        title="Clique para alternar o status"
                      >
                        {item.is_paid ? (
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={12} /> Pago
                          </span>
                        ) : item.calculatedStatus === 'overdue' ? (
                          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={12} /> Vencido
                          </span>
                        ) : item.calculatedStatus === 'due_today' ? (
                          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Bell size={12} /> Vence Hoje
                          </span>
                        ) : item.calculatedStatus === 'due_soon' ? (
                          <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} /> Vence em {item.diffDays}d
                          </span>
                        ) : (
                          <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} /> A Vencer
                          </span>
                        )}
                      </button>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#38BDF8' }}>
                        {formatCurrency(item.amount)}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="btn-icon"
                          title="Editar Custo Fixo"
                          style={{
                            background: 'rgba(56, 189, 248, 0.1)',
                            border: '1px solid rgba(56, 189, 248, 0.2)',
                            color: '#38BDF8',
                            padding: '6px',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          <Edit3 size={15} />
                        </button>

                        <button
                          onClick={() => setDeletingItem(item)}
                          className="btn-icon"
                          title="Excluir Custo Fixo"
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#F87171',
                            padding: '6px',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Criar / Editar Custo Fixo (Padrão do Sistema) */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38BDF8'
                }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC' }}>
                    {editingItem ? 'Editar Custo Fixo' : 'Novo Custo Fixo'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {editingItem ? 'Atualize as informações da despesa indireta' : 'Cadastre uma nova despesa indireta da Umami Zen'}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setShowModal(false);
                  if (onCloseCreateModal) onCloseCreateModal();
                }} 
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              {errorMsg && (
                <div style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#FCA5A5',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Nome do Custo */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Nome do Custo / Despesa *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aluguel, Marketing, Internet, Cardápio Web..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                />
              </div>

              {/* Categoria e Valor */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Categoria *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="select"
                  >
                    {FIXED_COST_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Valor (R$) *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600 }}>
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0,00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="input"
                      style={{ paddingLeft: '38px', fontWeight: 700, color: '#38BDF8', fontSize: '1.05rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Data de Vencimento e Forma de Pagamento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Data de Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="input"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Forma de Pagamento</label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="select"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Recorrência */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Recorrência do Custo</label>
                <select
                  value={formData.recurrence}
                  onChange={(e) => setFormData({ ...formData, recurrence: e.target.value as any })}
                  className="select"
                >
                  <option value="monthly">🔁 Mensal (Fixo em todos os meses a partir deste - Padrão)</option>
                  <option value="one_time">📅 Pagamento Único (Apenas neste mês)</option>
                  <option value="yearly">📆 Anual (Repete uma vez ao ano)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Custos mensais se repetem automaticamente em todos os meses seguintes, mantendo o dia de vencimento.
                </span>
              </div>

              {/* Status Pago Toggle (Padrão Insumos / Sistema) */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#F8FAFC' }}>
                    Status do Pagamento
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Marque se este custo já foi pago neste mês
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={formData.is_paid}
                    onChange={(e) => setFormData({ ...formData, is_paid: e.target.checked })}
                    style={{ accentColor: 'var(--accent-primary)', width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    color: formData.is_paid ? '#34D399' : '#FBBF24',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: formData.is_paid ? 'rgba(52, 211, 153, 0.12)' : 'rgba(251, 191, 36, 0.12)'
                  }}>
                    {formData.is_paid ? 'Já Pago' : 'Pendente'}
                  </span>
                </label>
              </div>

              {/* Observações */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Observações (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Conta vinculada, vencimento todo dia 10, etc."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    if (onCloseCreateModal) onCloseCreateModal();
                  }}
                  className="btn btn-secondary"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Cadastrar Custo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão (Padrão do Sistema) */}
      {deletingItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#FB7185', margin: 0 }}>
                <Trash2 size={20} color="#FB7185" />
                Excluir Custo Fixo
              </h3>
              <button 
                type="button"
                onClick={() => setDeletingItem(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-primary)', marginBottom: '12px', fontSize: '0.92rem' }}>
              Tem certeza que deseja excluir este custo fixo?
            </p>

            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '12px 14px',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '1rem' }}>
                {deletingItem.name}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Categoria: {deletingItem.category} | Vencimento: {formatDate(deletingItem.due_date)}
              </div>
              <div style={{ fontSize: '0.95rem', color: '#38BDF8', fontWeight: 700, marginTop: '4px' }}>
                Valor: {formatCurrency(deletingItem.amount)}
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
              Esta ação recalculará instantaneamente o Dashboard e o Lucro Real.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="btn btn-secondary"
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="btn btn-primary"
                style={{ backgroundColor: '#E11D48', borderColor: '#E11D48' }}
                disabled={isDeleting}
              >
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
