import React, { useState, useMemo } from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  Plus, 
  DollarSign, 
  Calendar, 
  Tag, 
  Trash2, 
  Layers, 
  Settings,
  X,
  Edit3
} from 'lucide-react';
import { CashTransaction, CashInitialBalance, DateRange } from '../../types';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { isDateInRange } from '../../lib/dateUtils';
import { supabase } from '../../lib/supabase';
import { DateRangePicker } from '../common/DateRangePicker';

interface CashViewProps {
  transactions: CashTransaction[];
  initialBalances: CashInitialBalance[];
  onRefresh: () => void;
  selectedMonth: number;
  selectedYear: number;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  isCreateModalOpen?: boolean;
  onCloseCreateModal?: () => void;
}

const DEFAULT_CASH_CATEGORIES = [
  'Supermercado',
  'Hortifruti / Feira',
  'Limpeza / Higiene',
  'Embalagens e Descartáveis',
  'Alimentação Funcionários',
  'Combustível / Transporte',
  'Manutenção / Reparos',
  'Papelaria / Escritório',
  'Gás de Cozinha',
  'Pequenas Compras Emergenciais',
  'Outros'
];

export const CashView: React.FC<CashViewProps> = ({
  transactions,
  initialBalances,
  onRefresh,
  selectedMonth,
  selectedYear,
  dateRange,
  onDateRangeChange,
  isCreateModalOpen = false,
  onCloseCreateModal
}) => {
  const [showModal, setShowModal] = useState<boolean>(isCreateModalOpen);
  const [showInitialBalanceModal, setShowInitialBalanceModal] = useState<boolean>(false);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CASH_CATEGORIES);

  // Create form state (sempre saída)
  const [transactionDate, setTransactionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<string>('Supermercado');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Dinheiro');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Edit Transaction state
  const [editingTransaction, setEditingTransaction] = useState<CashTransaction | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('Supermercado');
  const [editCustomCategory, setEditCustomCategory] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('Dinheiro');
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Delete Transaction state
  const [deletingTransaction, setDeletingTransaction] = useState<CashTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Initial balance form
  const [initialAmount, setInitialAmount] = useState<number>(0);
  const [initialDate, setInitialDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Initial Balance for the current context
  const latestInitialBalance = useMemo(() => {
    if (initialBalances.length === 0) return 0;
    return Number(initialBalances[0].initial_amount) || 0;
  }, [initialBalances]);

  // Filter transactions by dateRange (or month) - Apenas Saídas
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Regra explícita: fluxo de caixa é estritamente controle de saídas
      if (t.type === 'inflow') return false;
      if (dateRange) {
        return isDateInRange(t.transaction_date, dateRange);
      }
      const dt = new Date(t.transaction_date + 'T00:00:00');
      return dt.getMonth() + 1 === selectedMonth && dt.getFullYear() === selectedYear;
    });
  }, [transactions, dateRange, selectedMonth, selectedYear]);

  // Calculations (100% focado em saídas)
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    let spentToday = 0;
    let totalOutflow = 0;
    const byCategory = new Map<string, number>();

    filteredTransactions.forEach((t) => {
      const val = Number(t.amount);
      totalOutflow += val;
      byCategory.set(t.category, (byCategory.get(t.category) || 0) + val);
      if (t.transaction_date === todayStr) {
        spentToday += val;
      }
    });

    const currentBalance = latestInitialBalance - totalOutflow;
    const countOutflows = filteredTransactions.length;

    let topCategory = '-';
    let topCategoryVal = 0;
    byCategory.forEach((val, cat) => {
      if (val > topCategoryVal) {
        topCategoryVal = val;
        topCategory = cat;
      }
    });

    return {
      totalOutflow,
      spentToday,
      countOutflows,
      currentBalance,
      topCategory,
      topCategoryVal,
      byCategory
    };
  }, [filteredTransactions, latestInitialBalance]);

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || amount <= 0) {
      alert('Informe descrição e valor válidos.');
      return;
    }

    setIsSaving(true);
    try {
      const finalCat = category === '__custom__' ? customCategory.trim() : category;
      if (!finalCat) {
        alert('Informe a categoria.');
        setIsSaving(false);
        return;
      }

      if (category === '__custom__' && !categories.includes(finalCat)) {
        setCategories((prev) => [...prev, finalCat]);
      }

      const { error } = await supabase.from('cash_transactions').insert({
        transaction_date: transactionDate,
        type: 'outflow', // Sempre saída conforme regra do restaurante
        category: finalCat,
        description: description.trim(),
        amount: Number(amount),
        payment_method: paymentMethod,
        origin_type: 'manual',
        notes: notes.trim() || null
      });

      if (error) throw error;

      setDescription('');
      setAmount(0);
      setNotes('');
      setShowModal(false);
      if (onCloseCreateModal) onCloseCreateModal();
      onRefresh();
    } catch (err: any) {
      alert('Erro ao lançar saída no caixa: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openEditTransaction = (t: CashTransaction) => {
    setEditingTransaction(t);
    setEditDate(t.transaction_date);
    if (categories.includes(t.category)) {
      setEditCategory(t.category);
      setEditCustomCategory('');
    } else {
      setEditCategory('__custom__');
      setEditCustomCategory(t.category);
    }
    setEditDescription(t.description || '');
    setEditAmount(Number(t.amount) || 0);
    setEditPaymentMethod(t.payment_method || 'Dinheiro');
    setEditNotes(t.notes || '');
  };

  const handleSaveEditTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;
    if (!editDescription.trim() || editAmount <= 0) {
      alert('Informe descrição e valor válidos.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const finalCat = editCategory === '__custom__' ? editCustomCategory.trim() : editCategory;
      if (!finalCat) {
        alert('Informe a categoria.');
        setIsSavingEdit(false);
        return;
      }

      if (editCategory === '__custom__' && !categories.includes(finalCat)) {
        setCategories((prev) => [...prev, finalCat]);
      }

      const { error } = await supabase
        .from('cash_transactions')
        .update({
          transaction_date: editDate,
          type: 'outflow',
          category: finalCat,
          description: editDescription.trim(),
          amount: Number(editAmount),
          payment_method: editPaymentMethod,
          notes: editNotes.trim() || null
        })
        .eq('id', editingTransaction.id);

      if (error) throw error;
      setEditingTransaction(null);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao atualizar saída: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTransaction) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('cash_transactions')
        .delete()
        .eq('id', deletingTransaction.id);

      if (error) throw error;
      setDeletingTransaction(null);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao excluir saída: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveInitialBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('cash_initial_balance').insert({
        balance_date: initialDate,
        initial_amount: Number(initialAmount) || 0,
        notes: 'Fundo inicial de troco cadastrado pelo gestor'
      });

      if (error) throw error;
      setShowInitialBalanceModal(false);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao definir saldo inicial: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wallet size={28} color="#38BDF8" />
            Fluxo de Caixa
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Controle de pequenas despesas e saídas operacionais diárias do caixa
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {dateRange && onDateRangeChange && (
            <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
          )}
          <button onClick={() => setShowInitialBalanceModal(true)} className="btn btn-secondary">
            <Settings size={15} />
            <span>Definir Saldo Inicial</span>
          </button>

          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>+ Lançar Saída</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (Somente Saídas) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div className="kpi-card" style={{ borderColor: 'rgba(251, 113, 133, 0.4)' }}>
          <div className="kpi-title" style={{ color: '#FB7185' }}>Total de Saídas no Período</div>
          <div className="kpi-value" style={{ color: '#FB7185' }}>-{formatCurrency(stats.totalOutflow)}</div>
          <div className="kpi-subtitle">Despesas pagas no caixa</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title" style={{ color: '#FBBF24' }}>Gasto Hoje</div>
          <div className="kpi-value" style={{ color: '#FBBF24' }}>{formatCurrency(stats.spentToday)}</div>
          <div className="kpi-subtitle">Saídas do dia atual</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title" style={{ color: '#38BDF8' }}>Lançamentos de Saída</div>
          <div className="kpi-value" style={{ color: '#F8FAFC' }}>{stats.countOutflows}</div>
          <div className="kpi-subtitle">
            {stats.topCategory !== '-' ? `Maior gasto: ${stats.topCategory}` : 'Nenhuma saída'}
          </div>
        </div>

        <div className="kpi-card" style={{ borderColor: latestInitialBalance > 0 ? 'rgba(56, 189, 248, 0.4)' : 'var(--border-color)' }}>
          <div className="kpi-title" style={{ color: latestInitialBalance > 0 ? '#38BDF8' : 'var(--text-secondary)' }}>
            Saldo em Caixa (Fundo de Troco)
          </div>
          <div className="kpi-value" style={{ color: stats.currentBalance >= 0 ? '#38BDF8' : '#FB7185' }}>
            {formatCurrency(stats.currentBalance)}
          </div>
          <div className="kpi-subtitle">
            {latestInitialBalance > 0 ? `Fundo inicial: ${formatCurrency(latestInitialBalance)}` : 'Saldo inicial não configurado'}
          </div>
        </div>
      </div>

      {/* Expenses by Category */}
      {stats.byCategory.size > 0 && (
        <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={16} /> Gastos por Categoria no Mês
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            {Array.from(stats.byCategory.entries()).map(([cat, val]) => (
              <div key={cat} style={{ backgroundColor: 'var(--bg-input)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cat}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#F8FAFC', marginTop: '2px' }}>
                  {formatCurrency(val)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions Table (Somente Saídas) */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Categoria</th>
              <th>Descrição</th>
              <th>Valor da Saída</th>
              <th>Forma Pagamento</th>
              <th>Origem</th>
              <th>Observação</th>
              <th style={{ textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Nenhuma saída de caixa registrada neste período.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{formatDate(t.transaction_date)}</td>
                  <td>
                    <span className="badge badge-neutral">{t.category}</span>
                  </td>
                  <td style={{ fontWeight: 600, color: '#F8FAFC' }}>{t.description}</td>
                  <td style={{ fontWeight: 700, fontSize: '0.95rem', color: '#FB7185' }}>
                    -{formatCurrency(t.amount)}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {t.payment_method || 'Dinheiro'}
                  </td>
                  <td>
                    <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                      {t.origin_type === 'accounts_payable' ? 'Insumo Vinculado' :
                       t.origin_type === 'investments' ? 'Investimento' : 'Manual'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.notes || '-'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={() => openEditTransaction(t)}
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#38BDF8', padding: '5px 8px' }}
                        title="Editar saída do caixa"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingTransaction(t)}
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#FB7185', padding: '5px 8px' }}
                        title="Excluir saída do caixa"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New Outflow Modal */}
      {(showModal || isCreateModalOpen) && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#F8FAFC' }}>
                <ArrowUpRight size={20} color="#FB7185" />
                Nova Saída do Caixa
              </h3>
              <button 
                type="button"
                onClick={() => { setShowModal(false); if (onCloseCreateModal) onCloseCreateModal(); }} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Data da Saída *</label>
                  <input
                    type="date"
                    className="input"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Valor da Saída (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={amount || ''}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Categoria *</label>
                  <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__custom__">+ Nova Categoria...</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Forma de Pagamento</label>
                  <select className="select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="Dinheiro">Dinheiro (gaveta)</option>
                    <option value="Pix">PIX</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              {category === '__custom__' && (
                <div className="form-group">
                  <label className="form-label">Nome da Nova Categoria *</label>
                  <input
                    type="text"
                    className="input"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Ex: Gelo, Sacolas..."
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Descrição *</label>
                <input
                  type="text"
                  className="input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Compra de cebolinha e gergelim no hortifruti"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Observações</label>
                <input
                  type="text"
                  className="input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="button" 
                  onClick={() => { setShowModal(false); if (onCloseCreateModal) onCloseCreateModal(); }} 
                  className="btn btn-secondary" 
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar Saída'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Outflow Modal */}
      {editingTransaction && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#F8FAFC' }}>
                <Edit3 size={20} color="#38BDF8" />
                Editar Saída do Caixa
              </h3>
              <button 
                type="button"
                onClick={() => setEditingTransaction(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditTransaction}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Data da Saída *</label>
                  <input
                    type="date"
                    className="input"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Valor da Saída (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={editAmount || ''}
                    onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Categoria *</label>
                  <select className="select" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__custom__">+ Nova Categoria...</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Forma de Pagamento</label>
                  <select className="select" value={editPaymentMethod} onChange={(e) => setEditPaymentMethod(e.target.value)}>
                    <option value="Dinheiro">Dinheiro (gaveta)</option>
                    <option value="Pix">PIX</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              {editCategory === '__custom__' && (
                <div className="form-group">
                  <label className="form-label">Nome da Nova Categoria *</label>
                  <input
                    type="text"
                    className="input"
                    value={editCustomCategory}
                    onChange={(e) => setEditCustomCategory(e.target.value)}
                    placeholder="Ex: Gelo, Sacolas..."
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Descrição *</label>
                <input
                  type="text"
                  className="input"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Ex: Compra de cebolinha e gergelim no hortifruti"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Observações</label>
                <input
                  type="text"
                  className="input"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Opcional"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="button" 
                  onClick={() => setEditingTransaction(null)} 
                  className="btn btn-secondary" 
                  disabled={isSavingEdit}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSavingEdit}>
                  {isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTransaction && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#FB7185' }}>
                <Trash2 size={20} color="#FB7185" />
                Excluir Saída do Caixa
              </h3>
              <button 
                type="button" 
                onClick={() => setDeletingTransaction(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px', lineHeight: 1.5 }}>
              Deseja realmente excluir a saída <strong style={{ color: '#F8FAFC' }}>"{deletingTransaction.description}"</strong> de valor <strong style={{ color: '#FB7185' }}>{formatCurrency(deletingTransaction.amount)}</strong> do dia {formatDate(deletingTransaction.transaction_date)}?
              Esta ação não poderá ser desfeita.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setDeletingTransaction(null)} className="btn btn-secondary" disabled={isDeleting}>
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleConfirmDelete} 
                className="btn btn-danger" 
                disabled={isDeleting}
              >
                {isDeleting ? 'Excluindo...' : 'Excluir Saída'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Initial Balance Modal */}
      {showInitialBalanceModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Definir Saldo Inicial</h3>
              <button onClick={() => setShowInitialBalanceModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveInitialBalance}>
              <div className="form-group">
                <label className="form-label">Data do Saldo Inicial</label>
                <input
                  type="date"
                  className="input"
                  value={initialDate}
                  onChange={(e) => setInitialDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Valor Inicial em Caixa (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={initialAmount || ''}
                  onChange={(e) => setInitialAmount(parseFloat(e.target.value) || 0)}
                  placeholder="Ex: 500.00"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowInitialBalanceModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar Saldo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
