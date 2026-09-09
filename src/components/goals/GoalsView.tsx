import React, { useState, useMemo } from 'react';
import { 
  Target, 
  CalendarOff, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  X,
  Edit2
} from 'lucide-react';
import { MonthlyGoal, ClosedDay, Order, DateRange } from '../../types';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { isDateInRange, getLocalDateKey } from '../../lib/dateUtils';
import { supabase } from '../../lib/supabase';
import { DateRangePicker } from '../common/DateRangePicker';

interface GoalsViewProps {
  monthlyGoals: MonthlyGoal[];
  closedDays: ClosedDay[];
  orders: Order[];
  onRefresh: () => void;
  selectedMonth: number;
  selectedYear: number;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  isClosedDayModalOpen?: boolean;
  onCloseClosedDayModal?: () => void;
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  monthlyGoals,
  closedDays,
  orders,
  onRefresh,
  selectedMonth,
  selectedYear,
  dateRange,
  onDateRangeChange,
  isClosedDayModalOpen = false,
  onCloseClosedDayModal
}) => {
  const [showGoalModal, setShowGoalModal] = useState<boolean>(false);
  const [showClosedDayModal, setShowClosedDayModal] = useState<boolean>(isClosedDayModalOpen);

  // Goal Form
  const currentGoalObj = monthlyGoals.find(
    (g) => g.year === selectedYear && g.month === selectedMonth
  );
  const [goalAmount, setGoalAmount] = useState<number>(currentGoalObj ? Number(currentGoalObj.target_amount) : 30000);

  // Closed Day Form (Create)
  const [closedDate, setClosedDate] = useState<string>(getLocalDateKey());
  const [closedReason, setClosedReason] = useState<string>('Feriado');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const isSelectedDateTuesday = useMemo(() => {
    if (!closedDate) return false;
    const [y, m, d] = closedDate.split('-').map(Number);
    return new Date(y, m - 1, d).getDay() === 2;
  }, [closedDate]);

  const isSelectedDateAlreadyClosed = useMemo(() => {
    if (!closedDate) return false;
    return closedDays.some((c) => c.closed_date === closedDate);
  }, [closedDate, closedDays]);

  // Edit Closed Day Form
  const [editingClosedDay, setEditingClosedDay] = useState<ClosedDay | null>(null);
  const [editClosedDate, setEditClosedDate] = useState<string>('');
  const [editClosedReason, setEditClosedReason] = useState<string>('Feriado');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Delete Closed Day Confirmation
  const [deletingClosedDay, setDeletingClosedDay] = useState<ClosedDay | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // 1. Calculate Gross Revenue of Completed Orders for the selected Period
  const completedOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.is_canceled) return false;
      if (dateRange) {
        return isDateInRange(o.order_date, dateRange);
      }
      const d = new Date(o.order_date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [orders, dateRange, selectedMonth, selectedYear]);

  const accumulatedRevenue = useMemo(() => {
    return completedOrders.reduce((acc, o) => acc + Number(o.gross_amount || 0), 0);
  }, [completedOrders]);

  // 2. Calculate Days: Total days in month, Past Open Days, Remaining Open Days
  const daysAnalysis = useMemo(() => {
    const totalDaysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getMonth() + 1 === selectedMonth && today.getFullYear() === selectedYear;
    const currentDayNumber = isCurrentMonth ? today.getDate() : totalDaysInMonth;

    const closedDatesSet = new Set(closedDays.map((c) => c.closed_date));

    let totalOpenDaysInMonth = 0;
    let pastOpenDays = 0;
    let remainingOpenDays = 0;
    let manualClosedInMonthCount = 0;

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dayDate = new Date(selectedYear, selectedMonth - 1, day);
      // Tuesday check: getDay() === 2 is Tuesday!
      const isTuesday = dayDate.getDay() === 2;
      const dateString = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isManuallyClosed = closedDatesSet.has(dateString);

      if (isManuallyClosed && !isTuesday) {
        manualClosedInMonthCount++;
      }

      const isOpen = !isTuesday && !isManuallyClosed;

      if (isOpen) {
        totalOpenDaysInMonth++;
        if (isCurrentMonth) {
          if (day < currentDayNumber) {
            pastOpenDays++;
          } else {
            // day >= currentDayNumber: today and upcoming days that are open to sell
            remainingOpenDays++;
          }
        } else if (today > dayDate) {
          pastOpenDays++;
        } else {
          remainingOpenDays++;
        }
      }
    }

    // Check if today (currentDayNumber) is an open day and already has orders
    const todayDateString = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(currentDayNumber).padStart(2, '0')}`;
    const isTodayClosed = closedDatesSet.has(todayDateString) || (new Date(selectedYear, selectedMonth - 1, currentDayNumber).getDay() === 2);
    const hasOrdersToday = completedOrders.some((o) => o.order_date.startsWith(todayDateString));
    
    // For pastOpenDays (which calculates realized daily average):
    // If today is open and has orders, we add 1 so today's revenue is averaged across today
    const finalPastOpenDays = (isCurrentMonth && hasOrdersToday && !isTodayClosed) 
      ? pastOpenDays + 1 
      : pastOpenDays;

    return {
      totalDaysInMonth,
      totalOpenDaysInMonth,
      manualClosedInMonthCount,
      pastOpenDays: Math.max(1, finalPastOpenDays),
      remainingOpenDays: Math.max(0, remainingOpenDays)
    };
  }, [selectedYear, selectedMonth, closedDays, completedOrders]);

  // 3. Goal Metrics (Sections 22 & 23)
  const target = currentGoalObj ? Number(currentGoalObj.target_amount) : goalAmount;
  const remainingToGoal = Math.max(0, target - accumulatedRevenue);
  const percentAchieved = target > 0 ? (accumulatedRevenue / target) * 100 : 0;

  const dailyRateNeeded = daysAnalysis.remainingOpenDays > 0 && remainingToGoal > 0 
    ? remainingToGoal / daysAnalysis.remainingOpenDays 
    : 0;

  const dailyAverageRealized = accumulatedRevenue / daysAnalysis.pastOpenDays;
  const isAheadOfPace = dailyAverageRealized >= dailyRateNeeded;
  const paceDifference = Math.abs(dailyAverageRealized - dailyRateNeeded);

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { error } = await supabase.from('monthly_goals').upsert({
        year: selectedYear,
        month: selectedMonth,
        target_amount: Number(goalAmount) || 0
      }, { onConflict: 'year,month' });

      if (error) throw error;
      setShowGoalModal(false);
      await onRefresh();
    } catch (err: any) {
      alert('Erro ao salvar meta: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateClosedDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSelectedDateAlreadyClosed) {
      alert('Esta data já está cadastrada como dia fechado.');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('closed_days').insert({
        closed_date: closedDate,
        reason: closedReason.trim() || 'Não abrimos'
      });

      if (error) throw error;
      setShowClosedDayModal(false);
      if (onCloseClosedDayModal) onCloseClosedDayModal();
      await onRefresh();
    } catch (err: any) {
      alert('Erro ao registrar dia fechado: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openEditClosedDay = (cd: ClosedDay) => {
    setEditingClosedDay(cd);
    setEditClosedDate(cd.closed_date);
    setEditClosedReason(cd.reason || 'Feriado');
  };

  const handleSaveEditClosedDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClosedDay) return;
    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from('closed_days')
        .update({
          closed_date: editClosedDate,
          reason: editClosedReason.trim() || 'Não abrimos'
        })
        .eq('id', editingClosedDay.id);

      if (error) throw error;
      setEditingClosedDay(null);
      await onRefresh();
    } catch (err: any) {
      alert('Erro ao atualizar dia fechado: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDeleteClosedDay = async () => {
    if (!deletingClosedDay) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('closed_days')
        .delete()
        .eq('id', deletingClosedDay.id);

      if (error) throw error;
      setDeletingClosedDay(null);
      await onRefresh();
    } catch (err: any) {
      alert('Erro ao excluir dia fechado: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Target size={28} color="#F43F5E" />
            Metas de Faturamento & Ritmo Diário
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Acompanhamento em tempo real com dedução automática de terças-feiras e dias fechados
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {dateRange && onDateRangeChange && (
            <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
          )}
          <button 
            onClick={() => {
              setClosedDate(getLocalDateKey());
              setShowClosedDayModal(true);
            }} 
            className="btn btn-secondary"
          >
            <CalendarOff size={16} color="#FB7185" />
            <span>Informar Dia Fechado</span>
          </button>

          <button onClick={() => setShowGoalModal(true)} className="btn btn-primary">
            <Edit2 size={15} />
            <span>Definir Meta Mensal</span>
          </button>
        </div>
      </div>

      {/* Progress Bar & Pace Banner (Section 26) */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px', background: 'linear-gradient(135deg, #131B2A 0%, #0F172A 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Progresso da Meta Mensal ({selectedMonth}/{selectedYear})
            </span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F8FAFC', marginTop: '2px' }}>
              {formatCurrency(accumulatedRevenue)} / {formatCurrency(target)}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: percentAchieved >= 100 ? '#34D399' : '#FBBF24' }}>
              {percentAchieved.toFixed(1)}%
            </span>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {remainingToGoal === 0 ? 'Meta atingida! 🎉' : `Falta ${formatCurrency(remainingToGoal)}`}
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div style={{
          width: '100%',
          height: '14px',
          backgroundColor: '#1E293B',
          borderRadius: '999px',
          overflow: 'hidden',
          marginBottom: '16px'
        }}>
          <div style={{
            width: `${Math.min(100, percentAchieved)}%`,
            height: '100%',
            background: percentAchieved >= 100 
              ? 'linear-gradient(90deg, #10B981, #34D399)' 
              : 'linear-gradient(90deg, #F43F5E, #F59E0B)',
            borderRadius: '999px',
            transition: 'width 0.4s ease'
          }} />
        </div>

        {/* Pace Indicator Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: isAheadOfPace ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
          border: `1px solid ${isAheadOfPace ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
          padding: '12px 16px',
          borderRadius: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isAheadOfPace ? (
              <CheckCircle2 size={20} color="#34D399" />
            ) : (
              <AlertCircle size={20} color="#FB7185" />
            )}
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: isAheadOfPace ? '#34D399' : '#FB7185' }}>
              {isAheadOfPace ? 'ACIMA DO RITMO NECESSÁRIO' : 'ABAIXO DO RITMO NECESSÁRIO'}
            </span>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Média atual: <strong style={{ color: '#F8FAFC' }}>{formatCurrency(dailyAverageRealized)}/dia</strong> vs Necessário:{' '}
            <strong style={{ color: '#F8FAFC' }}>{formatCurrency(dailyRateNeeded)}/dia</strong> (Diferença: {formatCurrency(paceDifference)})
          </div>
        </div>
      </div>

      {/* KPI Cards (Section 22) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div className="kpi-card">
          <div className="kpi-title">Quanto Preciso Vender / Dia Aberto</div>
          <div className="kpi-value" style={{ color: '#FBBF24' }}>
            {formatCurrency(dailyRateNeeded)}
          </div>
          <div className="kpi-subtitle">
            {daysAnalysis.remainingOpenDays > 0 
              ? `Meta recalculada para os ${daysAnalysis.remainingOpenDays} dias restantes`
              : 'Meta do mês já finalizada'}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Dias de Funcionamento Restantes</div>
          <div className="kpi-value" style={{ color: '#38BDF8' }}>
            {daysAnalysis.remainingOpenDays} dias
          </div>
          <div className="kpi-subtitle">
            De {daysAnalysis.totalOpenDaysInMonth} dias abertos no mês {daysAnalysis.manualClosedInMonthCount > 0 ? `(${daysAnalysis.manualClosedInMonthCount} ${daysAnalysis.manualClosedInMonthCount === 1 ? 'dia fechado deduzido' : 'dias fechados deduzidos'})` : '(sem terças)'}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Média Diária Realizada</div>
          <div className="kpi-value" style={{ color: '#34D399' }}>
            {formatCurrency(dailyAverageRealized)}
          </div>
          <div className="kpi-subtitle">Nos {daysAnalysis.pastOpenDays} dias abertos com vendas até aqui</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Quanto Falta para a Meta</div>
          <div className="kpi-value" style={{ color: remainingToGoal > 0 ? '#FB7185' : '#34D399' }}>
            {formatCurrency(remainingToGoal)}
          </div>
          <div className="kpi-subtitle">
            {remainingToGoal === 0 ? 'Meta atingida! 🎉' : 'Restante do mês'}
          </div>
        </div>
      </div>

      {/* Section 23: Dias Fechados List & Rules */}
      <div className="card">
        <div className="card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarOff size={20} color="#FB7185" />
            <span>Dias de Restaurante Fechado</span>
          </div>
          <button 
            onClick={() => {
              setClosedDate(getLocalDateKey());
              setShowClosedDayModal(true);
            }} 
            className="btn btn-secondary btn-sm"
          >
            <Plus size={14} /> Informar Dia Fechado
          </button>
        </div>

        <div style={{
          backgroundColor: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '0.8rem',
          color: '#38BDF8',
          marginBottom: '16px'
        }}>
          <strong>Regra fixa da casa:</strong> O restaurante não abre às terças-feiras (já deduzidas automaticamente de todos os cálculos). Cadastre abaixo dias em que excepcionalmente não abriu ou não vai abrir (ex: feriados, manutenções, imprevistos). Cada dia lançado é deduzido imediatamente dos dias de funcionamento e a meta diária é recalculada em tempo real.
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data do Fechamento</th>
                <th>Dia da Semana</th>
                <th>Motivo Informado</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {closedDays.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    Nenhum dia fechado extraordinário cadastrado. Apenas as terças-feiras estão sendo consideradas fechadas.
                  </td>
                </tr>
              ) : (
                closedDays.map((cd) => {
                  const [y, m, dNum] = cd.closed_date.split('-').map(Number);
                  const d = new Date(y, m - 1, dNum);
                  const dayOfWeek = d.toLocaleDateString('pt-BR', { weekday: 'long' });
                  return (
                    <tr key={cd.id}>
                      <td style={{ fontWeight: 600 }}>{formatDate(cd.closed_date)}</td>
                      <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{dayOfWeek}</td>
                      <td style={{ color: '#F8FAFC' }}>{cd.reason || 'Não abrimos'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => openEditClosedDay(cd)}
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#38BDF8', padding: '5px 8px' }}
                            title="Editar dia fechado"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingClosedDay(cd)}
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#FB7185', padding: '5px 8px' }}
                            title="Excluir dia fechado"
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
      </div>

      {/* Goal Modal */}
      {showGoalModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Definir Meta de Faturamento</h3>
              <button onClick={() => setShowGoalModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveGoal}>
              <div className="form-group">
                <label className="form-label">Mês / Ano</label>
                <input
                  type="text"
                  className="input"
                  value={`${selectedMonth}/${selectedYear}`}
                  disabled
                  style={{ opacity: 0.7 }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Meta Bruta Mensal (R$) *</label>
                <input
                  type="number"
                  step="100"
                  className="input"
                  value={goalAmount || ''}
                  onChange={(e) => setGoalAmount(parseFloat(e.target.value) || 0)}
                  placeholder="Ex: 30000.00"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowGoalModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar Meta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Closed Day Modal */}
      {(showClosedDayModal || isClosedDayModalOpen) && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Informar Dia Fechado</h3>
              <button 
                onClick={() => { setShowClosedDayModal(false); if (onCloseClosedDayModal) onCloseClosedDayModal(); }} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateClosedDay}>
              <div className="form-group">
                <label className="form-label">Data em que o restaurante não abriu ou não vai abrir *</label>
                <input
                  type="date"
                  className="input"
                  value={closedDate}
                  onChange={(e) => setClosedDate(e.target.value)}
                  required
                />
                {isSelectedDateTuesday && (
                  <div style={{ color: '#F59E0B', fontSize: '0.8rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} />
                    <span>Terça-feira já é folga fixa semanal e já está deduzida automaticamente de todos os cálculos.</span>
                  </div>
                )}
                {isSelectedDateAlreadyClosed && (
                  <div style={{ color: '#FB7185', fontSize: '0.8rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} />
                    <span>Esta data já está lançada na tabela de dias fechados.</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Motivo do Fechamento</label>
                <select
                  className="select"
                  value={closedReason}
                  onChange={(e) => setClosedReason(e.target.value)}
                >
                  <option value="Manutenção interna">Manutenção interna</option>
                  <option value="Feriado">Feriado</option>
                  <option value="Problema interno">Problema interno</option>
                  <option value="Evento especial">Evento especial</option>
                  <option value="Outro motivo">Outro motivo</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="button" 
                  onClick={() => { setShowClosedDayModal(false); if (onCloseClosedDayModal) onCloseClosedDayModal(); }} 
                  className="btn btn-secondary"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar Dia Fechado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Closed Day Modal */}
      {editingClosedDay && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#F8FAFC' }}>
                <Edit2 size={20} color="#38BDF8" />
                Editar Dia Fechado
              </h3>
              <button 
                type="button"
                onClick={() => setEditingClosedDay(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEditClosedDay}>
              <div className="form-group">
                <label className="form-label">Data em que o restaurante não abriu *</label>
                <input
                  type="date"
                  className="input"
                  value={editClosedDate}
                  onChange={(e) => setEditClosedDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Motivo do Fechamento</label>
                <select
                  className="select"
                  value={editClosedReason}
                  onChange={(e) => setEditClosedReason(e.target.value)}
                >
                  <option value="Feriado">Feriado</option>
                  <option value="Manutenção interna">Manutenção interna</option>
                  <option value="Problema interno">Problema interno</option>
                  <option value="Evento especial">Evento especial</option>
                  <option value="Outro motivo">Outro motivo</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="button" 
                  onClick={() => setEditingClosedDay(null)} 
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

      {/* Delete Closed Day Confirmation Modal */}
      {deletingClosedDay && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#FB7185' }}>
                <Trash2 size={20} color="#FB7185" />
                Excluir Dia Fechado
              </h3>
              <button 
                type="button"
                onClick={() => setDeletingClosedDay(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px', lineHeight: 1.5 }}>
              Deseja realmente remover o dia fechado <strong style={{ color: '#F8FAFC' }}>{formatDate(deletingClosedDay.closed_date)}</strong>{' '}
              ({deletingClosedDay.reason || 'Fechamento extraordinário'})?
              Este dia voltará a ser considerado como dia útil de funcionamento no cálculo do ritmo diário e da meta.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => setDeletingClosedDay(null)} 
                className="btn btn-secondary" 
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleConfirmDeleteClosedDay} 
                className="btn btn-danger" 
                disabled={isDeleting}
              >
                {isDeleting ? 'Excluindo...' : 'Excluir Dia Fechado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
