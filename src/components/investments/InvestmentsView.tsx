import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Plus, 
  Tag, 
  Calendar, 
  DollarSign, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Layers,
  X,
  Edit3,
  Check
} from 'lucide-react';
import { Investment, DateRange } from '../../types';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { isDateInRange } from '../../lib/dateUtils';
import { supabase } from '../../lib/supabase';
import { DateRangePicker } from '../common/DateRangePicker';

interface InvestmentsViewProps {
  investments: Investment[];
  onRefresh: () => void;
  selectedMonth: number;
  selectedYear: number;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  isCreateModalOpen?: boolean;
  onCloseCreateModal?: () => void;
}

const DEFAULT_CATEGORIES = [
  'Embalagens',
  'Equipamentos',
  'Utensílios',
  'Gráfica',
  'Marketing',
  'Móveis',
  'Tecnologia',
  'Reforma',
  'Outros'
];

export const InvestmentsView: React.FC<InvestmentsViewProps> = ({
  investments,
  onRefresh,
  selectedMonth,
  selectedYear,
  dateRange,
  onDateRangeChange,
  isCreateModalOpen = false,
  onCloseCreateModal
}) => {
  const [showModal, setShowModal] = useState<boolean>(isCreateModalOpen);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  // Form states
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<string>('Equipamentos');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [supplier, setSupplier] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [installments, setInstallments] = useState<number>(1);
  const [status, setStatus] = useState<'paid' | 'pending'>('paid');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Filter investments
  const filteredInvestments = useMemo(() => {
    return investments.filter((inv) => {
      if (dateRange) {
        if (!isDateInRange(inv.investment_date, dateRange)) return false;
      } else {
        const dt = new Date(inv.investment_date + 'T00:00:00');
        if (dt.getMonth() + 1 !== selectedMonth || dt.getFullYear() !== selectedYear) {
          return false;
        }
      }
      if (selectedCategory !== 'all' && inv.category !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [investments, dateRange, selectedMonth, selectedYear, selectedCategory]);

  // Totals (Month, Year, Paid, Pending)
  const stats = useMemo(() => {
    const monthTotal = filteredInvestments.reduce((acc, i) => acc + Number(i.amount), 0);
    const paidTotal = filteredInvestments.filter((i) => i.status === 'paid').reduce((acc, i) => acc + Number(i.amount), 0);
    const pendingTotal = filteredInvestments.filter((i) => i.status === 'pending').reduce((acc, i) => acc + Number(i.amount), 0);

    // Year total
    const yearInvestments = investments.filter((inv) => {
      const dt = new Date(inv.investment_date + 'T00:00:00');
      return dt.getFullYear() === selectedYear;
    });
    const yearTotal = yearInvestments.reduce((acc, i) => acc + Number(i.amount), 0);

    // Group by category
    const byCat = new Map<string, number>();
    filteredInvestments.forEach((i) => {
      byCat.set(i.category, (byCat.get(i.category) || 0) + Number(i.amount));
    });

    return { monthTotal, yearTotal, paidTotal, pendingTotal, byCat };
  }, [filteredInvestments, investments, selectedYear]);

  const handleCreateInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || amount <= 0) {
      alert('Informe a descrição e valor válidos.');
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

      const numInstallments = Math.max(1, Number(installments) || 1);
      const installmentAmount = Math.round((amount / numInstallments) * 100) / 100;
      const baseDate = new Date(date + 'T00:00:00');
      const groupId = crypto.randomUUID();

      const itemsToInsert = [];

      for (let i = 1; i <= numInstallments; i++) {
        const itemDate = new Date(baseDate);
        itemDate.setMonth(itemDate.getMonth() + (i - 1));
        const dateStr = itemDate.toISOString().split('T')[0];

        itemsToInsert.push({
          investment_date: dateStr,
          category: finalCat,
          supplier: supplier.trim() || null,
          description: numInstallments > 1 ? `${description.trim()} (${i}/${numInstallments})` : description.trim(),
          installment_number: i,
          total_installments: numInstallments,
          group_id: groupId,
          amount: installmentAmount,
          status,
          payment_date: status === 'paid' ? dateStr : null,
          notes: notes.trim() || null
        });
      }

      const { error } = await supabase.from('investments').insert(itemsToInsert);
      if (error) throw error;

      // Reset
      setDescription('');
      setSupplier('');
      setAmount(0);
      setInstallments(1);
      setNotes('');
      setShowModal(false);
      if (onCloseCreateModal) onCloseCreateModal();
      onRefresh();
    } catch (err: any) {
      alert('Erro ao salvar investimento: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Edit states
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editSupplier, setEditSupplier] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<'paid' | 'pending'>('paid');
  const [editNotes, setEditNotes] = useState<string>('');
  const [isEditingSaving, setIsEditingSaving] = useState<boolean>(false);

  const openEditModal = (inv: Investment) => {
    setEditingInvestment(inv);
    setEditDate(inv.investment_date);
    setEditCategory(inv.category);
    setEditSupplier(inv.supplier || '');
    setEditDescription(inv.description);
    setEditAmount(Number(inv.amount));
    setEditStatus(inv.status);
    setEditNotes(inv.notes || '');
  };

  const handleToggleStatus = async (inv: Investment) => {
    const newStatus = inv.status === 'paid' ? 'pending' : 'paid';
    const newPaymentDate = newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null;
    try {
      const { error } = await supabase
        .from('investments')
        .update({ status: newStatus, payment_date: newPaymentDate })
        .eq('id', inv.id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert('Erro ao atualizar status: ' + err.message);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvestment) return;
    if (!editDescription.trim() || editAmount <= 0) {
      alert('Informe a descrição e valor válidos.');
      return;
    }

    setIsEditingSaving(true);
    try {
      const paymentDate = editStatus === 'paid' ? (editingInvestment.payment_date || editDate) : null;
      const { error } = await supabase
        .from('investments')
        .update({
          investment_date: editDate,
          category: editCategory,
          supplier: editSupplier.trim() || null,
          description: editDescription.trim(),
          amount: editAmount,
          status: editStatus,
          payment_date: paymentDate,
          notes: editNotes.trim() || null
        })
        .eq('id', editingInvestment.id);

      if (error) throw error;
      setEditingInvestment(null);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao atualizar investimento: ' + err.message);
    } finally {
      setIsEditingSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este registro de investimento?')) return;
    try {
      const { error } = await supabase.from('investments').delete().eq('id', id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp size={28} color="#10B981" />
            Investimentos da Empresa
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Controle de equipamentos, reformas, marketing, embalagens e melhorias patrimoniais
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {dateRange && onDateRangeChange && (
            <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
          )}
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>+ Novo Investimento</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div className="kpi-card">
          <div className="kpi-title">Investimentos do Mês</div>
          <div className="kpi-value" style={{ color: '#F8FAFC' }}>{formatCurrency(stats.monthTotal)}</div>
          <div className="kpi-subtitle">Mês {selectedMonth}/{selectedYear}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Total no Ano {selectedYear}</div>
          <div className="kpi-value" style={{ color: '#38BDF8' }}>{formatCurrency(stats.yearTotal)}</div>
          <div className="kpi-subtitle">Acumulado do ano</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title" style={{ color: '#34D399' }}>Total Pago</div>
          <div className="kpi-value" style={{ color: '#34D399' }}>{formatCurrency(stats.paidTotal)}</div>
          <div className="kpi-subtitle">Liquidado no período</div>
        </div>

        <div className="kpi-card" style={{ borderColor: stats.pendingTotal > 0 ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-color)' }}>
          <div className="kpi-title" style={{ color: stats.pendingTotal > 0 ? '#FBBF24' : 'var(--text-secondary)' }}>
            Total Pendente
          </div>
          <div className="kpi-value" style={{ color: stats.pendingTotal > 0 ? '#FBBF24' : '#F8FAFC' }}>
            {formatCurrency(stats.pendingTotal)}
          </div>
          <div className="kpi-subtitle" style={{ color: '#FBBF24' }}>
            A pagar
          </div>
        </div>
      </div>

      {/* Breakdown by Category */}
      {stats.byCat.size > 0 && (
        <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={16} /> Distribuição por Categoria (Mês {selectedMonth})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            {Array.from(stats.byCat.entries()).map(([cat, total]) => (
              <div key={cat} style={{ backgroundColor: 'var(--bg-input)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cat}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '2px', color: '#F8FAFC' }}>
                  {formatCurrency(total)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Categoria</th>
              <th>Descrição</th>
              <th>Fornecedor</th>
              <th>Parcela</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Data Pagamento</th>
              <th>Observação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvestments.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Nenhum investimento registrado para este mês.
                </td>
              </tr>
            ) : (
              filteredInvestments.map((inv) => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 600 }}>{formatDate(inv.investment_date)}</td>
                  <td>
                    <span className="badge badge-neutral">{inv.category}</span>
                  </td>
                  <td style={{ fontWeight: 600, color: '#F8FAFC' }}>{inv.description}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{inv.supplier || '-'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{inv.installment_number}/{inv.total_installments}</td>
                  <td style={{ fontWeight: 700, fontSize: '0.95rem' }}>{formatCurrency(inv.amount)}</td>
                  <td>
                    <span className={`badge ${inv.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                      {inv.status === 'paid' ? 'Pago' : 'Pendente'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: inv.payment_date ? '#34D399' : 'var(--text-muted)' }}>
                    {inv.payment_date ? formatDate(inv.payment_date) : '-'}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {inv.notes || '-'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={() => handleToggleStatus(inv)}
                        className={`btn btn-sm ${inv.status === 'paid' ? 'btn-secondary' : 'btn-primary'}`}
                        style={{ 
                          fontSize: '0.75rem', 
                          padding: '4px 8px',
                          color: inv.status === 'paid' ? '#94A3B8' : '#10B981',
                          borderColor: inv.status === 'paid' ? undefined : 'rgba(16, 185, 129, 0.4)'
                        }}
                        title={inv.status === 'paid' ? 'Reabrir / Marcar Pendente' : 'Marcar como Pago'}
                      >
                        {inv.status === 'paid' ? <Clock size={13} /> : <Check size={13} />}
                      </button>
                      <button
                        onClick={() => openEditModal(inv)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', color: '#38BDF8' }}
                        title="Editar Investimento"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(inv.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', color: '#FB7185' }}
                        title="Excluir"
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

      {/* New Investment Modal */}
      {(showModal || isCreateModalOpen) && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Novo Investimento</h3>
              <button 
                onClick={() => { setShowModal(false); if (onCloseCreateModal) onCloseCreateModal(); }} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateInvestment}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Data *</label>
                  <input
                    type="date"
                    className="input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Categoria *</label>
                  <select
                    className="select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__custom__">+ Nova Categoria...</option>
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
                    placeholder="Ex: Fachada, Uniformes..."
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Descrição do Investimento *</label>
                <input
                  type="text"
                  className="input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Esteira de sushi nova / Embalagens personalizadas 5000 un"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Fornecedor / Empresa</label>
                  <input
                    type="text"
                    className="input"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Ex: Gráfica Express"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Valor Total (R$) *</label>
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

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Status</label>
                  <select
                    className="select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'paid' | 'pending')}
                  >
                    <option value="paid">Já Pago</option>
                    <option value="pending">Pendente</option>
                  </select>
                </div>
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
                  {isSaving ? 'Salvando...' : 'Salvar Investimento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Investment Modal */}
      {editingInvestment && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Editar Investimento</h3>
              <button 
                onClick={() => setEditingInvestment(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Data *</label>
                  <input
                    type="date"
                    className="input"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Categoria *</label>
                  <input
                    type="text"
                    className="input"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descrição do Investimento *</label>
                <input
                  type="text"
                  className="input"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Fornecedor / Empresa</label>
                  <input
                    type="text"
                    className="input"
                    value={editSupplier}
                    onChange={(e) => setEditSupplier(e.target.value)}
                    placeholder="Ex: Gráfica Express"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Valor (R$) *</label>
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

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="select"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'paid' | 'pending')}
                >
                  <option value="paid">Já Pago</option>
                  <option value="pending">Pendente</option>
                </select>
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
                  onClick={() => setEditingInvestment(null)} 
                  className="btn btn-secondary"
                  disabled={isEditingSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isEditingSaving}>
                  {isEditingSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
