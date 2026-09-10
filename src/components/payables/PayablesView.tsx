import React, { useState, useMemo, useEffect } from 'react';
import { 
  Receipt, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Filter, 
  Check, 
  Trash2, 
  Edit3,
  Calendar,
  X,
  Wallet,
  Layers,
  ArrowRight,
  DollarSign,
  Target,
  TrendingUp,
  Percent,
  ShoppingBag,
  AlertTriangle
} from 'lucide-react';
import { AccountsPayable, SystemSettings, DateRange, MonthlyGoal } from '../../types';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { isDateInRange } from '../../lib/dateUtils';
import { supabase } from '../../lib/supabase';
import { DateRangePicker } from '../common/DateRangePicker';

const PAYABLE_CATEGORIES = [
  'Insumos (Geral)',
  'Salmão / Peixes',
  'Embalagens',
  'Bebidas',
  'Hortifrúti',
  'Descartáveis',
  'Aluguel / Fixos',
  'Energia / Água / Gás',
  'Marketing / Tráfego',
  'Manutenção',
  'Outros'
];

const PAYMENT_METHODS = [
  'Boleto',
  'PIX',
  'Transferência',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Dinheiro'
];

interface InstallmentRow {
  number: number;
  dueDate: string;
  amount: number;
}

interface PayablesViewProps {
  payables: AccountsPayable[];
  settings: SystemSettings;
  onRefresh: () => void;
  selectedMonth: number;
  selectedYear: number;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  isCreateModalOpen?: boolean;
  onCloseCreateModal?: () => void;
  monthlyGoals?: MonthlyGoal[];
}

export const PayablesView: React.FC<PayablesViewProps> = ({
  payables,
  settings,
  onRefresh,
  selectedMonth,
  selectedYear,
  dateRange,
  onDateRangeChange,
  isCreateModalOpen = false,
  onCloseCreateModal,
  monthlyGoals = []
}) => {
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(isCreateModalOpen);
  const [editingPayable, setEditingPayable] = useState<AccountsPayable | null>(null);
  const [payingPayable, setPayingPayable] = useState<AccountsPayable | null>(null);
  const [deletingPayable, setDeletingPayable] = useState<AccountsPayable | null>(null);
  const [deleteEntireGroup, setDeleteEntireGroup] = useState<boolean>(false);

  useEffect(() => {
    if (isCreateModalOpen) {
      setShowCreateModal(true);
    }
  }, [isCreateModalOpen]);

  // Filters state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('period');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // --- CREATE FORM STATES ---
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [supplier, setSupplier] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<string>('Salmão / Peixes');
  const [amount, setAmount] = useState<number>(0);
  const [installments, setInstallments] = useState<number>(1);
  const [installmentInterval, setInstallmentInterval] = useState<'15' | '30' | '7' | 'custom'>('15');
  const [customIntervalDays, setCustomIntervalDays] = useState<number>(15);
  const [paymentMethod, setPaymentMethod] = useState<string>('Boleto');
  const [notes, setNotes] = useState<string>('');
  const [customInstallments, setCustomInstallments] = useState<InstallmentRow[]>([]);

  // --- EDIT FORM STATES ---
  const [editSupplier, setEditSupplier] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editCategory, setEditCategory] = useState<string>('Insumos (Geral)');
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('Boleto');
  const [editInstallmentNumber, setEditInstallmentNumber] = useState<number>(1);
  const [editTotalInstallments, setEditTotalInstallments] = useState<number>(1);
  const [editNotes, setEditNotes] = useState<string>('');
  const [editIsPaid, setEditIsPaid] = useState<boolean>(false);
  const [editPaymentDate, setEditPaymentDate] = useState<string>('');

  // --- PAYMENT / BAIXA STATES ---
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payOriginalAmount, setPayOriginalAmount] = useState<number>(0);
  const [payInterestAmount, setPayInterestAmount] = useState<number>(0);
  const [payNotes, setPayNotes] = useState<string>('');
  const [payMethod, setPayMethod] = useState<string>('Boleto');

  // --- BUDGET / GOAL (35% DA META) STATES ---
  const [showGoalModal, setShowGoalModal] = useState<boolean>(false);
  const [editGoalValue, setEditGoalValue] = useState<number>(35000);
  const [isSavingGoal, setIsSavingGoal] = useState<boolean>(false);

  const alertDays = Number(settings.payable_alert_days) || 3;

  // Recalculate preview installments when creation parameters change
  useEffect(() => {
    const num = Math.max(1, Number(installments) || 1);
    if (num > 1) {
      const rows: InstallmentRow[] = [];
      const base = new Date(dueDate + 'T00:00:00');
      const baseAmount = num > 0 ? Math.round((amount / num) * 100) / 100 : 0;
      let accumulated = 0;

      for (let i = 1; i <= num; i++) {
        const itemDate = new Date(base);
        if (installmentInterval === '15') {
          itemDate.setDate(itemDate.getDate() + (i - 1) * 15);
        } else if (installmentInterval === '30') {
          itemDate.setMonth(itemDate.getMonth() + (i - 1));
        } else if (installmentInterval === '7') {
          itemDate.setDate(itemDate.getDate() + (i - 1) * 7);
        } else {
          const days = Math.max(1, customIntervalDays || 15);
          itemDate.setDate(itemDate.getDate() + (i - 1) * days);
        }

        let thisAmount = baseAmount;
        if (i === num) {
          thisAmount = Math.max(0, Math.round((amount - accumulated) * 100) / 100);
        } else {
          accumulated += thisAmount;
        }

        rows.push({
          number: i,
          dueDate: itemDate.toISOString().split('T')[0],
          amount: thisAmount
        });
      }
      setCustomInstallments(rows);
    } else {
      setCustomInstallments([]);
    }
  }, [dueDate, installments, amount, installmentInterval, customIntervalDays]);

  const handleUpdatePreviewRow = (index: number, field: 'dueDate' | 'amount', value: any) => {
    setCustomInstallments((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Compute live status based on date and paid flag
  const computedPayables = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return payables.map((p) => {
      const isActuallyPaid = Boolean(p.is_paid || p.status === 'paid');
      if (isActuallyPaid) {
        return { ...p, is_paid: true, calculatedStatus: 'paid' as const };
      }
      const due = new Date(p.due_date + 'T00:00:00');
      const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return { ...p, is_paid: false, calculatedStatus: 'overdue' as const };
      } else if (diffDays === 0) {
        return { ...p, is_paid: false, calculatedStatus: 'due_today' as const };
      } else if (diffDays <= alertDays) {
        return { ...p, is_paid: false, calculatedStatus: 'due_soon' as const };
      } else {
        return { ...p, is_paid: false, calculatedStatus: 'pending' as const };
      }
    });
  }, [payables, alertDays]);

  // Totals & Alerts
  const stats = useMemo(() => {
    const overdue = computedPayables.filter((p) => p.calculatedStatus === 'overdue');
    const dueToday = computedPayables.filter((p) => p.calculatedStatus === 'due_today');
    const dueSoon = computedPayables.filter((p) => p.calculatedStatus === 'due_soon');
    const paid = computedPayables.filter((p) => p.is_paid);

    const withInterest = paid.filter((p) => Number(p.interest_amount) > 0);
    const interestTotal = withInterest.reduce((acc, p) => acc + Number(p.interest_amount || 0), 0);

    const overdueTotal = overdue.reduce((acc, p) => acc + Number(p.amount), 0);
    const dueTodayTotal = dueToday.reduce((acc, p) => acc + Number(p.amount), 0);
    const dueSoonTotal = dueSoon.reduce((acc, p) => acc + Number(p.amount), 0);
    const paidTotal = paid.reduce((acc, p) => acc + Number(p.amount), 0);

    return {
      overdueCount: overdue.length,
      overdueTotal,
      dueTodayCount: dueToday.length,
      dueTodayTotal,
      dueSoonCount: dueSoon.length,
      dueSoonTotal,
      paidTotal,
      interestTotal,
      interestCount: withInterest.length
    };
  }, [computedPayables]);

  const filteredPayables = useMemo(() => {
    return computedPayables.filter((p) => {
      if (periodFilter === 'period' && dateRange) {
        if (!isDateInRange(p.due_date, dateRange)) return false;
      }

      if (statusFilter === 'overdue' && p.calculatedStatus !== 'overdue') return false;
      if (statusFilter === 'due_today' && p.calculatedStatus !== 'due_today') return false;
      if (statusFilter === 'due_soon' && p.calculatedStatus !== 'due_soon') return false;
      if (statusFilter === 'paid' && !p.is_paid) return false;
      if (statusFilter === 'unpaid' && p.is_paid) return false;
      if (statusFilter === 'with_interest' && (!p.is_paid || !Number(p.interest_amount) || Number(p.interest_amount) <= 0)) return false;

      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;

      return true;
    });
  }, [computedPayables, periodFilter, dateRange, statusFilter, categoryFilter]);

  // --- CONTROLE DE ORÇAMENTO / TETO DE INSUMOS (35% DA META) ---
  const currentGoalObj = useMemo(() => {
    return monthlyGoals.find((g) => g.year === selectedYear && g.month === selectedMonth);
  }, [monthlyGoals, selectedYear, selectedMonth]);

  const monthlyGoalAmount = currentGoalObj ? Number(currentGoalObj.target_amount) : 35000;
  const budgetLimit = Math.round(monthlyGoalAmount * 0.35 * 100) / 100;

  // Insumos do período/mês selecionado (contas pertencentes a este mês/filtro)
  const periodInsumos = useMemo(() => {
    return payables.filter((p) => {
      if (dateRange) {
        return isDateInRange(p.due_date, dateRange);
      }
      const d = new Date(p.due_date + 'T00:00:00');
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [payables, dateRange, selectedMonth, selectedYear]);

  const totalInsumosPeriodo = useMemo(() => {
    return periodInsumos.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  }, [periodInsumos]);

  const paidInsumosPeriodo = useMemo(() => {
    return periodInsumos.filter((p) => p.is_paid || p.status === 'paid').reduce((acc, p) => acc + Number(p.amount || 0), 0);
  }, [periodInsumos]);

  const pendingInsumosPeriodo = useMemo(() => {
    return periodInsumos.filter((p) => !p.is_paid && p.status !== 'paid').reduce((acc, p) => acc + Number(p.amount || 0), 0);
  }, [periodInsumos]);

  // Saldo restante: Quanto ainda posso gastar
  const remainingBudget = Math.round((budgetLimit - totalInsumosPeriodo) * 100) / 100;
  const percentUsed = budgetLimit > 0 ? (totalInsumosPeriodo / budgetLimit) * 100 : 0;
  const isExceeded = remainingBudget < 0;

  const handleOpenEditGoal = () => {
    setEditGoalValue(monthlyGoalAmount);
    setShowGoalModal(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(editGoalValue);
    if (isNaN(val) || val <= 0) {
      alert('Informe um valor de meta válido maior que zero.');
      return;
    }
    setIsSavingGoal(true);
    try {
      const { error } = await supabase.from('monthly_goals').upsert({
        year: selectedYear,
        month: selectedMonth,
        target_amount: val,
        updated_at: new Date().toISOString()
      }, { onConflict: 'year,month' });

      if (error) throw error;
      setShowGoalModal(false);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao atualizar meta: ' + err.message);
    } finally {
      setIsSavingGoal(false);
    }
  };

  // --- ACTIONS HANDLERS ---

  const handleOpenEdit = (p: AccountsPayable) => {
    setEditingPayable(p);
    setEditSupplier(p.supplier || '');
    setEditDescription(p.description || '');
    setEditDueDate(p.due_date);
    setEditAmount(Number(p.amount) || 0);
    setEditCategory(p.category || 'Insumos (Geral)');
    setEditPaymentMethod(p.payment_method || 'Boleto');
    setEditInstallmentNumber(p.installment_number || 1);
    setEditTotalInstallments(p.total_installments || 1);
    setEditNotes(p.notes || '');
    setEditIsPaid(p.is_paid || false);
    setEditPaymentDate(p.payment_date || new Date().toISOString().split('T')[0]);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayable) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('accounts_payable')
        .update({
          supplier: editSupplier.trim(),
          description: editDescription.trim(),
          due_date: editDueDate,
          amount: Number(editAmount),
          category: editCategory,
          payment_method: editPaymentMethod,
          installment_number: Number(editInstallmentNumber),
          total_installments: Number(editTotalInstallments),
          notes: editNotes.trim() || null,
          is_paid: editIsPaid,
          status: editIsPaid ? 'paid' : 'pending',
          payment_date: editIsPaid ? editPaymentDate : null
        })
        .eq('id', editingPayable.id);

      if (error) throw error;
      setEditingPayable(null);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao atualizar conta: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenPay = (p: AccountsPayable) => {
    const orig = (p.original_amount !== undefined && p.original_amount !== null) ? Number(p.original_amount) : Number(p.amount) || 0;
    const existingInterest = Number(p.interest_amount) || 0;
    setPayingPayable(p);
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayOriginalAmount(orig);
    setPayAmount(orig + existingInterest);
    setPayInterestAmount(existingInterest);
    setPayMethod(p.payment_method || 'Boleto');
    setPayNotes(p.notes || '');
  };

  const handleConfirmPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingPayable) return;

    setIsSaving(true);
    try {
      const finalPaid = Number(payAmount) || 0;
      const finalOrig = Number(payOriginalAmount) || 0;
      let finalInterest = 0;
      if (finalPaid > finalOrig) {
        finalInterest = Math.round((finalPaid - finalOrig) * 100) / 100;
      } else if (payInterestAmount > 0) {
        finalInterest = Number(payInterestAmount);
      }

      let updatedNotes = payNotes.trim();
      if (finalInterest > 0 && !updatedNotes.toLowerCase().includes('juros')) {
        updatedNotes = updatedNotes 
          ? `${updatedNotes} | Juros de boleto: ${formatCurrency(finalInterest)}` 
          : `Juros de boleto: ${formatCurrency(finalInterest)}`;
      }

      const { error } = await supabase
        .from('accounts_payable')
        .update({
          is_paid: true,
          status: 'paid',
          payment_date: payDate,
          original_amount: finalOrig,
          interest_amount: finalInterest,
          amount: finalPaid,
          payment_method: payMethod,
          notes: updatedNotes || null,
          linked_cash_id: null
        })
        .eq('id', payingPayable.id);

      if (error) throw error;
      setPayingPayable(null);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao registrar pagamento: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnpay = async (p: AccountsPayable) => {
    if (!confirm(`Deseja desmarcar o pagamento da conta "${p.description}" e reabri-la como pendente?`)) return;
    setIsSaving(true);
    try {
      const origAmount = (p.original_amount !== undefined && p.original_amount !== null) ? Number(p.original_amount) : Number(p.amount);
      const { error } = await supabase
        .from('accounts_payable')
        .update({
          is_paid: false,
          status: 'pending',
          payment_date: null,
          amount: origAmount,
          interest_amount: 0
        })
        .eq('id', p.id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert('Erro ao reabrir conta: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDelete = (p: AccountsPayable) => {
    setDeletingPayable(p);
    setDeleteEntireGroup(false);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPayable) return;

    setIsSaving(true);
    try {
      if (deleteEntireGroup && deletingPayable.group_id) {
        const { error } = await supabase
          .from('accounts_payable')
          .delete()
          .eq('group_id', deletingPayable.group_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('accounts_payable')
          .delete()
          .eq('id', deletingPayable.id);
        if (error) throw error;
      }

      setDeletingPayable(null);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao excluir conta: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreatePayable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier.trim() || !description.trim() || amount <= 0) {
      alert('Preencha os campos obrigatórios com valores válidos.');
      return;
    }

    setIsSaving(true);
    try {
      const numInstallments = Math.max(1, Number(installments) || 1);
      const groupId = crypto.randomUUID();
      const payablesToInsert = [];

      if (numInstallments > 1 && customInstallments.length === numInstallments) {
        for (let i = 0; i < customInstallments.length; i++) {
          const item = customInstallments[i];
          payablesToInsert.push({
            due_date: item.dueDate,
            supplier: supplier.trim(),
            description: `${description.trim()} (${item.number}/${numInstallments})`,
            installment_number: item.number,
            total_installments: numInstallments,
            group_id: groupId,
            amount: Number(item.amount),
            original_amount: Number(item.amount),
            interest_amount: 0,
            status: 'pending',
            is_paid: false,
            payment_method: paymentMethod,
            category,
            notes: notes.trim() || null
          });
        }
      } else {
        const installmentAmount = Math.round((amount / numInstallments) * 100) / 100;
        const baseDueDate = new Date(dueDate + 'T00:00:00');

        for (let i = 1; i <= numInstallments; i++) {
          const itemDueDate = new Date(baseDueDate);
          if (installmentInterval === '15') {
            itemDueDate.setDate(itemDueDate.getDate() + (i - 1) * 15);
          } else if (installmentInterval === '30') {
            itemDueDate.setMonth(itemDueDate.getMonth() + (i - 1));
          } else if (installmentInterval === '7') {
            itemDueDate.setDate(itemDueDate.getDate() + (i - 1) * 7);
          } else {
            const days = Math.max(1, customIntervalDays || 15);
            itemDueDate.setDate(itemDueDate.getDate() + (i - 1) * days);
          }

          payablesToInsert.push({
            due_date: itemDueDate.toISOString().split('T')[0],
            supplier: supplier.trim(),
            description: numInstallments > 1 ? `${description.trim()} (${i}/${numInstallments})` : description.trim(),
            installment_number: i,
            total_installments: numInstallments,
            group_id: groupId,
            amount: installmentAmount,
            original_amount: installmentAmount,
            interest_amount: 0,
            status: 'pending',
            is_paid: false,
            payment_method: paymentMethod,
            category,
            notes: notes.trim() || null
          });
        }
      }

      const { error } = await supabase.from('accounts_payable').insert(payablesToInsert);
      if (error) throw error;

      // Reset form
      setSupplier('');
      setDescription('');
      setAmount(0);
      setInstallments(1);
      setNotes('');
      setShowCreateModal(false);
      if (onCloseCreateModal) onCloseCreateModal();
      onRefresh();
    } catch (err: any) {
      alert('Erro ao salvar conta a pagar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Receipt size={28} color="#FBBF24" />
            Insumos & Contas a Pagar
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Controle de boletos, insumos de sushi, parcelamentos em 15 em 15 dias e alertas de vencimento
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {dateRange && onDateRangeChange && (
            <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
          )}
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>+ Nova Conta / Insumo</span>
          </button>
        </div>
      </div>

      {/* 1. CONTROLE DE ORÇAMENTO / TETO DE INSUMOS (35% DA META) */}
      <div className="card" style={{
        padding: '20px',
        marginBottom: '20px',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: `1px solid ${isExceeded ? 'rgba(239, 68, 68, 0.35)' : 'rgba(56, 189, 248, 0.25)'}`,
        boxShadow: '0 8px 24px -6px rgba(0, 0, 0, 0.35)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow accent */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '180px',
          height: '180px',
          background: isExceeded ? 'radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(52,211,153,0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        {/* Top Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                backgroundColor: isExceeded ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                color: isExceeded ? '#FB7185' : '#38BDF8',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ShoppingBag size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  Controle de Teto de Insumos
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(56, 189, 248, 0.2)',
                    color: '#38BDF8',
                    border: '1px solid rgba(56, 189, 248, 0.3)'
                  }}>
                    35% da Meta
                  </span>
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Limite máximo de gastos com insumos estabelecido em 35% sobre a meta de faturamento do mês ({selectedMonth}/{selectedYear})
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: isExceeded ? 'rgba(239, 68, 68, 0.15)' : percentUsed >= 85 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: isExceeded ? '#FB7185' : percentUsed >= 85 ? '#FBBF24' : '#34D399',
              border: `1px solid ${isExceeded ? 'rgba(239,68,68,0.3)' : percentUsed >= 85 ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`
            }}>
              {isExceeded ? '🚨 Teto Excedido' : percentUsed >= 85 ? '⚠️ Atenção: Próximo ao Limite' : '✅ Dentro do Orçamento'}
            </span>

            <button
              type="button"
              onClick={handleOpenEditGoal}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}
              title="Ajustar Meta Mensal de Faturamento"
            >
              <Target size={14} color="#FBBF24" />
              <span>Ajustar Meta</span>
            </button>
          </div>
        </div>

        {/* 4 Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          {/* Card 1: Meta de Faturamento */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Meta do Mês
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC' }}>
              {formatCurrency(monthlyGoalAmount)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Meta estabelecida ({selectedMonth}/{selectedYear})
            </div>
          </div>

          {/* Card 2: Teto de Insumos (35%) */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <div style={{ fontSize: '0.8rem', color: '#38BDF8', fontWeight: 600, marginBottom: '4px' }}>
              Teto Máximo (35%)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38BDF8' }}>
              {formatCurrency(budgetLimit)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              35% de {formatCurrency(monthlyGoalAmount)}
            </div>
          </div>

          {/* Card 3: Total Comprometido */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Total Comprometido
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FBBF24' }}>
              {formatCurrency(totalInsumosPeriodo)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Pago: {formatCurrency(paidInsumosPeriodo)} | A Pagar: {formatCurrency(pendingInsumosPeriodo)}
            </div>
          </div>

          {/* Card 4: QUANTO AINDA POSSO GASTAR (HERO) */}
          <div style={{
            backgroundColor: isExceeded ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
            padding: '14px',
            borderRadius: '10px',
            border: `1px solid ${isExceeded ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isExceeded ? '#FB7185' : '#34D399', marginBottom: '4px' }}>
              {isExceeded ? '🚨 Orçamento Excedido' : '💰 Quanto Ainda Posso Gastar'}
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: isExceeded ? '#FB7185' : '#34D399' }}>
              {isExceeded ? `-${formatCurrency(Math.abs(remainingBudget))}` : formatCurrency(remainingBudget)}
            </div>
            <div style={{ fontSize: '0.75rem', color: isExceeded ? '#FB7185' : '#34D399', marginTop: '4px', fontWeight: 500 }}>
              {isExceeded ? 'Limite de 35% ultrapassado!' : 'Saldo disponível para novos pedidos'}
            </div>
          </div>
        </div>

        {/* Progress Bar with markers */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            <span>
              Orçamento Utilizado: <strong style={{ color: isExceeded ? '#FB7185' : percentUsed >= 85 ? '#FBBF24' : '#34D399' }}>{percentUsed.toFixed(1)}%</strong>
            </span>
            <span>
              Teto de 35%: <strong>{formatCurrency(budgetLimit)}</strong> (100%)
            </span>
          </div>
          <div style={{
            height: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '5px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{
              width: `${Math.min(100, Math.max(0, percentUsed))}%`,
              height: '100%',
              backgroundColor: isExceeded ? '#EF4444' : percentUsed >= 85 ? '#F59E0B' : '#10B981',
              borderRadius: '5px',
              transition: 'width 0.4s ease'
            }} />
          </div>
        </div>
      </div>

      {/* Alert Cards (Section 17) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div className="kpi-card" style={{ borderColor: stats.overdueCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)' }}>
          <div className="kpi-title" style={{ color: stats.overdueCount > 0 ? '#FB7185' : 'var(--text-secondary)' }}>
            Contas Vencidas
          </div>
          <div className="kpi-value" style={{ color: stats.overdueCount > 0 ? '#FB7185' : '#F8FAFC' }}>
            {formatCurrency(stats.overdueTotal)}
          </div>
          <div className="kpi-subtitle" style={{ color: '#FB7185' }}>
            {stats.overdueCount} {stats.overdueCount === 1 ? 'conta vencida' : 'contas vencidas'}
          </div>
        </div>

        <div className="kpi-card" style={{ borderColor: stats.dueTodayCount > 0 ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-color)' }}>
          <div className="kpi-title" style={{ color: stats.dueTodayCount > 0 ? '#FBBF24' : 'var(--text-secondary)' }}>
            Vencem Hoje
          </div>
          <div className="kpi-value" style={{ color: stats.dueTodayCount > 0 ? '#FBBF24' : '#F8FAFC' }}>
            {formatCurrency(stats.dueTodayTotal)}
          </div>
          <div className="kpi-subtitle" style={{ color: '#FBBF24' }}>
            {stats.dueTodayCount} {stats.dueTodayCount === 1 ? 'conta vence hoje' : 'contas vencem hoje'}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Vencem em até {alertDays} dias</div>
          <div className="kpi-value" style={{ color: '#38BDF8' }}>
            {formatCurrency(stats.dueSoonTotal)}
          </div>
          <div className="kpi-subtitle">
            {stats.dueSoonCount} contas próximas
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title" style={{ color: '#34D399' }}>Total Pago</div>
          <div className="kpi-value" style={{ color: '#34D399' }}>
            {formatCurrency(stats.paidTotal)}
          </div>
          <div className="kpi-subtitle">
            Liquidado no período
          </div>
        </div>

        <div 
          className="kpi-card"
          onClick={() => setStatusFilter(statusFilter === 'with_interest' ? 'all' : 'with_interest')}
          style={{ 
            cursor: 'pointer',
            borderColor: statusFilter === 'with_interest' ? '#FB7185' : stats.interestCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)',
            backgroundColor: statusFilter === 'with_interest' ? 'rgba(239, 68, 68, 0.1)' : undefined,
            transition: 'all 0.2s ease'
          }}
          title="Clique para filtrar apenas boletos pagos com acréscimo de juros"
        >
          <div className="kpi-title" style={{ color: stats.interestCount > 0 ? '#FB7185' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Juros de Boleto</span>
            <AlertTriangle size={14} color={stats.interestCount > 0 ? '#FB7185' : 'var(--text-muted)'} />
          </div>
          <div className="kpi-value" style={{ color: stats.interestCount > 0 ? '#FB7185' : '#F8FAFC' }}>
            {formatCurrency(stats.interestTotal)}
          </div>
          <div className="kpi-subtitle" style={{ color: stats.interestCount > 0 ? '#FB7185' : 'var(--text-muted)' }}>
            {stats.interestCount} {stats.interestCount === 1 ? 'boleto com juros' : 'boletos com juros'} {statusFilter === 'with_interest' ? '(ativo)' : ''}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="select"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            style={{ width: '220px' }}
          >
            <option value="all">Todas as Datas</option>
            <option value="period">Período ({dateRange?.label || `${selectedMonth}/${selectedYear}`})</option>
          </select>

          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '220px' }}
          >
            <option value="all">Todos os Status</option>
            <option value="overdue">⚠️ Vencidas</option>
            <option value="due_today">🔔 Vence Hoje</option>
            <option value="due_soon">⏰ Vencem nos próximos dias</option>
            <option value="unpaid">Em Aberto (não pagas)</option>
            <option value="paid">✅ Pagas</option>
            <option value="with_interest">🚨 Com Juros de Boleto ({stats.interestCount})</option>
          </select>

          <select
            className="select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: '200px' }}
          >
            <option value="all">Todas Categorias</option>
            {PAYABLE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Filter Banner when with_interest is selected */}
      {statusFilter === 'with_interest' && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FB7185', fontSize: '0.88rem', fontWeight: 600 }}>
            <AlertTriangle size={16} />
            <span>Filtrando boletos pagos com acréscimo de juros por atraso ({filteredPayables.length} {filteredPayables.length === 1 ? 'conta encontrada' : 'contas encontradas'})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#F8FAFC' }}>
              Total de juros pagos: <strong style={{ color: '#FB7185' }}>{formatCurrency(stats.interestTotal)}</strong>
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '3px 8px' }}
            >
              Limpar Filtro
            </button>
          </div>
        </div>
      )}

      {/* Payables Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Vencimento</th>
              <th>Fornecedor</th>
              <th>Descrição</th>
              <th>Parcela</th>
              <th>Categoria</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Forma Pag.</th>
              <th>Data Pagamento</th>
              <th style={{ minWidth: '150px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayables.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Nenhuma conta a pagar encontrada.
                </td>
              </tr>
            ) : (
              filteredPayables.map((p) => {
                let badgeClass = 'badge-neutral';
                let statusLabel = 'Pendente';

                if (p.is_paid) {
                  badgeClass = 'badge-success';
                  statusLabel = 'Pago';
                } else if (p.calculatedStatus === 'overdue') {
                  badgeClass = 'badge-danger';
                  statusLabel = 'Vencida';
                } else if (p.calculatedStatus === 'due_today') {
                  badgeClass = 'badge-warning';
                  statusLabel = 'Vence Hoje';
                } else if (p.calculatedStatus === 'due_soon') {
                  badgeClass = 'badge-info';
                  statusLabel = 'A Vencer';
                }

                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, color: p.calculatedStatus === 'overdue' ? '#FB7185' : p.calculatedStatus === 'due_today' ? '#FBBF24' : 'var(--text-primary)' }}>
                      {formatDate(p.due_date)}
                    </td>
                    <td style={{ fontWeight: 600, color: '#F8FAFC' }}>
                      {p.supplier}
                    </td>
                    <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.description}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {p.installment_number}/{p.total_installments}
                    </td>
                    <td>
                      <span className="badge badge-neutral">{p.category}</span>
                    </td>
                    <td style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      <div>{formatCurrency(p.amount)}</div>
                      {Number(p.interest_amount) > 0 && (
                        <div 
                          style={{ 
                            fontSize: '0.7rem', 
                            fontWeight: 600, 
                            color: '#FB7185',
                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '4px',
                            padding: '2px 5px',
                            marginTop: '3px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            cursor: 'help'
                          }}
                          title={`Valor Original: ${formatCurrency(p.original_amount ?? (p.amount - (p.interest_amount || 0)))} | Juros por atraso: ${formatCurrency(p.interest_amount || 0)}`}
                        >
                          <AlertTriangle size={10} />
                          +{formatCurrency(p.interest_amount || 0)} juros
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${badgeClass}`}>{statusLabel}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {p.payment_method || '-'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: p.is_paid ? '#34D399' : 'var(--text-muted)' }}>
                      {p.payment_date ? formatDate(p.payment_date) : '-'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {!p.is_paid ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPay(p)}
                            className="btn btn-primary btn-sm"
                            title="Dar baixa / Pagar conta"
                            style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Check size={13} />
                            <span>Pagar</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUnpay(p)}
                            className="btn btn-secondary btn-sm"
                            title="Clique para desmarcar pagamento e reabrir como pendente"
                            style={{ fontSize: '0.75rem', color: '#34D399', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <CheckCircle2 size={13} /> Pago
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className="btn btn-secondary btn-sm"
                          title="Editar valor, data de vencimento e detalhes"
                          style={{ padding: '6px 8px' }}
                        >
                          <Edit3 size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDelete(p)}
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#FB7185', padding: '6px 8px' }}
                          title="Excluir conta"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 1. EDIT PAYABLE MODAL */}
      {editingPayable && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={20} color="#38BDF8" />
                Editar Conta / Parcela
              </h3>
              <button 
                type="button"
                onClick={() => setEditingPayable(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Data de Vencimento *</label>
                  <input
                    type="date"
                    className="input"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Valor da Parcela (R$) *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600 }}>
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="input"
                      style={{ paddingLeft: '38px', fontWeight: 700, fontSize: '1.05rem', color: '#38BDF8' }}
                      value={isNaN(editAmount) ? '' : editAmount}
                      onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Fornecedor *</label>
                  <input
                    type="text"
                    className="input"
                    value={editSupplier}
                    onChange={(e) => setEditSupplier(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Categoria</label>
                  <select 
                    className="select" 
                    value={editCategory} 
                    onChange={(e) => setEditCategory(e.target.value)}
                  >
                    {PAYABLE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descrição *</label>
                <input
                  type="text"
                  className="input"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Nº da Parcela</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={editInstallmentNumber}
                    onChange={(e) => setEditInstallmentNumber(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Total Parcelas</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={editTotalInstallments}
                    onChange={(e) => setEditTotalInstallments(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Forma Pagamento</label>
                  <select 
                    className="select" 
                    value={editPaymentMethod} 
                    onChange={(e) => setEditPaymentMethod(e.target.value)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Pago Toggle */}
              <div style={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                padding: '12px', 
                borderRadius: '8px', 
                border: '1px solid var(--border-color)',
                marginBottom: '14px'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={editIsPaid}
                    onChange={(e) => setEditIsPaid(e.target.checked)}
                    style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
                  />
                  <span style={{ fontWeight: 600 }}>Esta conta já foi paga / liquidada</span>
                </label>

                {editIsPaid && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                    <label className="form-label">Data Efetiva do Pagamento</label>
                    <input
                      type="date"
                      className="input"
                      value={editPaymentDate}
                      onChange={(e) => setEditPaymentDate(e.target.value)}
                      required={editIsPaid}
                    />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Observações</label>
                <input
                  type="text"
                  className="input"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Ex: Ajuste acordado de vencimento com fornecedor"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="button" 
                  onClick={() => setEditingPayable(null)} 
                  className="btn btn-secondary"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. PAYMENT / DAR BAIXA MODAL */}
      {payingPayable && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} color="#34D399" />
                Registrar Pagamento / Baixa
              </h3>
              <button 
                type="button"
                onClick={() => setPayingPayable(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Boleto details card */}
            <div style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.03)', 
              border: '1px solid var(--border-color)', 
              padding: '14px', 
              borderRadius: '10px', 
              marginBottom: '16px' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '1.05rem' }}>
                    {payingPayable.supplier}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
                    {payingPayable.description} ({payingPayable.installment_number}/{payingPayable.total_installments})
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Valor Original
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#38BDF8' }}>
                    {formatCurrency(payOriginalAmount)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Vencimento: </span>
                  <strong style={{ color: '#F8FAFC' }}>{formatDate(payingPayable.due_date)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Categoria: </span>
                  <strong style={{ color: '#F8FAFC' }}>{payingPayable.category}</strong>
                </div>
              </div>
            </div>

            <form onSubmit={handleConfirmPay}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Data do Pagamento *</label>
                  <input
                    type="date"
                    className="input"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Forma de Pagamento Utilizada</label>
                  <select 
                    className="select" 
                    value={payMethod} 
                    onChange={(e) => setPayMethod(e.target.value)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment & Interest Box */}
              <div style={{ 
                backgroundColor: payAmount > payOriginalAmount ? 'rgba(239, 68, 68, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${payAmount > payOriginalAmount ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)'}`,
                padding: '14px',
                borderRadius: '10px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Valor Pago (Total) *</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>
                        R$
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="input"
                        style={{ 
                          paddingLeft: '34px', 
                          fontWeight: 700, 
                          color: payAmount > payOriginalAmount ? '#FB7185' : '#34D399', 
                          fontSize: '1.05rem' 
                        }}
                        value={isNaN(payAmount) ? '' : payAmount}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setPayAmount(val);
                          if (val > payOriginalAmount) {
                            setPayInterestAmount(Math.round((val - payOriginalAmount) * 100) / 100);
                          } else {
                            setPayInterestAmount(0);
                          }
                        }}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ color: payInterestAmount > 0 ? '#FB7185' : 'var(--text-secondary)' }}>
                      Juros / Multa Boleto (R$)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: payInterestAmount > 0 ? '#FB7185' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>
                        R$
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input"
                        style={{ 
                          paddingLeft: '34px', 
                          fontWeight: 700, 
                          color: payInterestAmount > 0 ? '#FB7185' : 'var(--text-secondary)', 
                          fontSize: '1.05rem',
                          borderColor: payInterestAmount > 0 ? 'rgba(239, 68, 68, 0.4)' : undefined
                        }}
                        value={isNaN(payInterestAmount) ? '' : payInterestAmount}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setPayInterestAmount(val);
                          setPayAmount(Math.round((payOriginalAmount + val) * 100) / 100);
                        }}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Dynamic warning banner if payment is higher than original */}
                {payAmount > payOriginalAmount && (
                  <div style={{ 
                    backgroundColor: 'rgba(239, 68, 68, 0.08)', 
                    border: '1px solid rgba(239, 68, 68, 0.25)', 
                    borderRadius: '8px', 
                    padding: '10px 12px',
                    marginTop: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FB7185', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <AlertTriangle size={14} /> Juros de Boleto Identificado
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#FB7185', backgroundColor: 'rgba(239, 68, 68, 0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                        +{(((payAmount - payOriginalAmount) / (payOriginalAmount || 1)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Valor base do insumo: <strong style={{ color: '#F8FAFC' }}>{formatCurrency(payOriginalAmount)}</strong>
                      <br />
                      Juros por atraso: <strong style={{ color: '#FB7185' }}>+{formatCurrency(payAmount - payOriginalAmount)}</strong>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px' }}>
                      O custo original do insumo será mantido e os juros serão rastreados no controle de juros de boletos.
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Observações do Pagamento</label>
                <input
                  type="text"
                  className="input"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder={payAmount > payOriginalAmount ? "Ex: Boleto pago com juros bancários por atraso" : "Ex: Pago via banco..."}
                />
              </div>

              {/* Informative notice */}
              <div style={{ 
                backgroundColor: 'rgba(56, 189, 248, 0.06)', 
                padding: '10px 12px', 
                borderRadius: '8px', 
                border: '1px solid rgba(56, 189, 248, 0.18)',
                marginBottom: '16px',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)'
              }}>
                <span style={{ color: '#38BDF8', fontWeight: 600 }}>Registro em Insumos: </span>
                A conta será marcada como liquidada com histórico de juros, sem duplicar lançamentos no caixa manual.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="button" 
                  onClick={() => setPayingPayable(null)} 
                  className="btn btn-secondary"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ backgroundColor: '#10B981', borderColor: '#10B981' }}
                  disabled={isSaving}
                >
                  {isSaving ? 'Gravando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. DELETE CONFIRMATION MODAL */}
      {deletingPayable && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#FB7185' }}>
                <Trash2 size={20} color="#FB7185" />
                Excluir Conta
              </h3>
              <button 
                type="button"
                onClick={() => setDeletingPayable(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-primary)', marginBottom: '12px' }}>
              Tem certeza que deseja excluir esta conta?
            </p>

            <div style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.08)', 
              border: '1px solid rgba(239, 68, 68, 0.25)', 
              padding: '12px', 
              borderRadius: '8px', 
              marginBottom: '16px' 
            }}>
              <div style={{ fontWeight: 700, color: '#F8FAFC' }}>
                {deletingPayable.supplier} - {deletingPayable.description}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Vencimento: {formatDate(deletingPayable.due_date)} | Valor: <strong>{formatCurrency(deletingPayable.amount)}</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Parcela: {deletingPayable.installment_number}/{deletingPayable.total_installments}
              </div>
            </div>

            {deletingPayable.total_installments > 1 && deletingPayable.group_id && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={deleteEntireGroup}
                    onChange={(e) => setDeleteEntireGroup(e.target.checked)}
                    style={{ accentColor: '#FB7185', width: '16px', height: '16px' }}
                  />
                  <span>Excluir todas as {deletingPayable.total_installments} parcelas desta compra vinculada</span>
                </label>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button 
                type="button" 
                onClick={() => setDeletingPayable(null)} 
                className="btn btn-secondary"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleConfirmDelete} 
                className="btn btn-primary" 
                style={{ backgroundColor: '#E11D48', borderColor: '#E11D48' }}
                disabled={isSaving}
              >
                {isSaving ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. NEW PAYABLE MODAL (WITH 15-IN-15 DAYS & INTERACTIVE INSTALLMENTS PREVIEW) */}
      {(showCreateModal || isCreateModalOpen) && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={20} color="#FBBF24" />
                Nova Conta / Insumo a Pagar
              </h3>
              <button 
                type="button"
                onClick={() => { setShowCreateModal(false); if (onCloseCreateModal) onCloseCreateModal(); }} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePayable}>
              {/* Budget Helper Notice */}
              <div style={{
                backgroundColor: isExceeded ? 'rgba(239, 68, 68, 0.08)' : 'rgba(56, 189, 248, 0.08)',
                border: `1px solid ${isExceeded ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.25)'}`,
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.82rem'
              }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Teto do Mês (35% da Meta): </span>
                  <strong style={{ color: '#38BDF8' }}>{formatCurrency(budgetLimit)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Saldo Disponível: </span>
                  <strong style={{ color: isExceeded ? '#FB7185' : '#34D399', fontSize: '0.9rem' }}>
                    {isExceeded ? `-${formatCurrency(Math.abs(remainingBudget))}` : formatCurrency(remainingBudget)}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Fornecedor *</label>
                  <input
                    type="text"
                    className="input"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Ex: Distribuidora Salmão..."
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Categoria</label>
                  <select 
                    className="select" 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {PAYABLE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descrição do Gasto *</label>
                <input
                  type="text"
                  className="input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: 20kg Salmão Fresco + Cream Cheese"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Valor Total (R$) *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600 }}>
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="input"
                      style={{ paddingLeft: '38px', fontWeight: 700 }}
                      value={amount || ''}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">1º Vencimento *</label>
                  <input
                    type="date"
                    className="input"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Parcelas (1x a 24x)</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    className="input"
                    value={installments}
                    onChange={(e) => setInstallments(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              {/* SEÇÃO DE INTERVALO DE PARCELAS (QUINZENAL, MENSAL, ETC) */}
              {installments > 1 && (
                <div style={{ 
                  backgroundColor: 'rgba(56, 189, 248, 0.05)', 
                  border: '1px solid rgba(56, 189, 248, 0.2)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  marginBottom: '14px' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38BDF8', fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px' }}>
                    <Layers size={16} />
                    <span>Configuração de Intervalo das Parcelas</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: installmentInterval === 'custom' ? '1fr 1fr' : '1fr', gap: '10px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Intervalo entre Boletos:</label>
                      <select
                        className="select"
                        value={installmentInterval}
                        onChange={(e) => setInstallmentInterval(e.target.value as any)}
                        style={{ width: '100%' }}
                      >
                        <option value="15">📅 De 15 em 15 dias (Quinzenal)</option>
                        <option value="30">📅 De 30 em 30 dias (Mensal)</option>
                        <option value="7">📅 De 7 em 7 dias (Semanal)</option>
                        <option value="custom">⚙️ Personalizado (dias)</option>
                      </select>
                    </div>

                    {installmentInterval === 'custom' && (
                      <div>
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>A cada quantos dias?</label>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          className="input"
                          value={customIntervalDays}
                          onChange={(e) => setCustomIntervalDays(parseInt(e.target.value) || 15)}
                          placeholder="Ex: 21"
                        />
                      </div>
                    )}
                  </div>

                  {/* Pré-visualização e Edição Individual das Parcelas */}
                  <div style={{ marginTop: '12px', borderTop: '1px solid rgba(56, 189, 248, 0.15)', paddingTop: '10px' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Pré-visualização das {installments} parcelas (você pode ajustar datas ou valores individualmente):</span>
                    </div>

                    <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {customInstallments.map((inst, idx) => (
                        <div 
                          key={inst.number} 
                          style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '80px 1fr 1fr', 
                            gap: '8px', 
                            alignItems: 'center',
                            backgroundColor: 'var(--bg-input)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '0.8rem'
                          }}
                        >
                          <span style={{ fontWeight: 600, color: '#FBBF24' }}>
                            {inst.number}/{installments}
                          </span>
                          <input
                            type="date"
                            className="input"
                            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                            value={inst.dueDate}
                            onChange={(e) => handleUpdatePreviewRow(idx, 'dueDate', e.target.value)}
                            required
                          />
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                              R$
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              className="input"
                              style={{ padding: '4px 8px 4px 24px', fontSize: '0.8rem', fontWeight: 600 }}
                              value={inst.amount}
                              onChange={(e) => handleUpdatePreviewRow(idx, 'amount', parseFloat(e.target.value) || 0)}
                              required
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Forma de Pagamento</label>
                  <select 
                    className="select" 
                    value={paymentMethod} 
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Observações</label>
                  <input
                    type="text"
                    className="input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="button" 
                  onClick={() => { setShowCreateModal(false); if (onCloseCreateModal) onCloseCreateModal(); }} 
                  className="btn btn-secondary"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Cadastrar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. QUICK GOAL EDIT MODAL */}
      {showGoalModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#F8FAFC' }}>
                <Target size={20} color="#FBBF24" />
                Ajustar Meta Mensal
              </h3>
              <button 
                type="button" 
                onClick={() => setShowGoalModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveGoal}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Defina a meta de faturamento para <strong>{selectedMonth}/{selectedYear}</strong>. O teto de insumos é calculado automaticamente como <strong>35%</strong> desta meta.
              </p>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Meta de Faturamento (R$) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600 }}>
                    R$
                  </span>
                  <input
                    type="number"
                    step="100"
                    min="1"
                    className="input"
                    style={{ paddingLeft: '38px', fontWeight: 700, fontSize: '1.1rem', color: '#FBBF24' }}
                    value={editGoalValue || ''}
                    onChange={(e) => setEditGoalValue(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.82rem', color: '#38BDF8' }}>
                  Novo teto de insumos (35%): <strong>{formatCurrency(Math.round((editGoalValue || 0) * 0.35 * 100) / 100)}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="btn btn-secondary"
                  disabled={isSavingGoal}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSavingGoal}
                >
                  {isSavingGoal ? 'Salvando...' : 'Salvar Meta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
