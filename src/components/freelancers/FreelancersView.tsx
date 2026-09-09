import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Clock, 
  DollarSign, 
  Calendar, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Check, 
  UserPlus,
  CreditCard,
  X,
  Edit3
} from 'lucide-react';
import { Freelancer, FreelancerShift, SystemSettings, DateRange } from '../../types';
import { formatCurrency, formatDate, formatHours } from '../../lib/formatters';
import { isDateInRange } from '../../lib/dateUtils';
import { calculateShiftHours } from '../../lib/calculations';
import { supabase } from '../../lib/supabase';
import { DateRangePicker } from '../common/DateRangePicker';

interface FreelancersViewProps {
  freelancers: Freelancer[];
  shifts: FreelancerShift[];
  settings: SystemSettings;
  onRefresh: () => void;
  selectedMonth: number;
  selectedYear: number;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
}

export const FreelancersView: React.FC<FreelancersViewProps> = ({
  freelancers,
  shifts,
  settings,
  onRefresh,
  selectedMonth,
  selectedYear,
  dateRange,
  onDateRangeChange
}) => {
  const [showFreelancerModal, setShowFreelancerModal] = useState<boolean>(false);
  const [showShiftModal, setShowShiftModal] = useState<boolean>(false);
  const [selectedFreelancerId, setSelectedFreelancerId] = useState<string>('all');

  // Freelancer Form state (create)
  const [freelancerName, setFreelancerName] = useState<string>('');
  const [defaultRate, setDefaultRate] = useState<number>(Number(settings.freelancer_default_rate) || 15);
  const [freelancerPhone, setFreelancerPhone] = useState<string>('');
  const [freelancerPix, setFreelancerPix] = useState<string>('');

  // Shift Form state (create)
  const [shiftDate, setShiftDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [shiftFreelancerId, setShiftFreelancerId] = useState<string>(freelancers[0]?.id || '');
  const [startTime, setStartTime] = useState<string>('18:00');
  const [endTime, setEndTime] = useState<string>('01:30');
  const [breakMinutes, setBreakMinutes] = useState<number>(0);
  const [customHourlyRate, setCustomHourlyRate] = useState<number>(15);
  const [shiftNotes, setShiftNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Edit Shift state
  const [editingShift, setEditingShift] = useState<FreelancerShift | null>(null);
  const [editShiftFreelancerId, setEditShiftFreelancerId] = useState<string>('');
  const [editShiftDate, setEditShiftDate] = useState<string>('');
  const [editStartTime, setEditStartTime] = useState<string>('18:00');
  const [editEndTime, setEditEndTime] = useState<string>('00:00');
  const [editBreakMinutes, setEditBreakMinutes] = useState<number>(0);
  const [editHourlyRate, setEditHourlyRate] = useState<number>(15);
  const [editPaidAmount, setEditPaidAmount] = useState<number>(0);
  const [editShiftNotes, setEditShiftNotes] = useState<string>('');
  const [isSavingShiftEdit, setIsSavingShiftEdit] = useState<boolean>(false);

  // Delete Shift state
  const [deletingShift, setDeletingShift] = useState<FreelancerShift | null>(null);
  const [isDeletingShift, setIsDeletingShift] = useState<boolean>(false);

  // Edit Freelancer state
  const [editingFreelancer, setEditingFreelancer] = useState<Freelancer | null>(null);
  const [editFreelancerName, setEditFreelancerName] = useState<string>('');
  const [editFreelancerRate, setEditFreelancerRate] = useState<number>(15);
  const [editFreelancerPhone, setEditFreelancerPhone] = useState<string>('');
  const [editFreelancerPix, setEditFreelancerPix] = useState<string>('');
  const [isSavingFreelancerEdit, setIsSavingFreelancerEdit] = useState<boolean>(false);

  // Delete Freelancer state
  const [deletingFreelancer, setDeletingFreelancer] = useState<Freelancer | null>(null);
  const [isDeletingFreelancer, setIsDeletingFreelancer] = useState<boolean>(false);

  // Pay Shift Modal state
  const [payingShift, setPayingShift] = useState<FreelancerShift | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState<string>('Pix');
  const [isSavingPay, setIsSavingPay] = useState<boolean>(false);

  // Live calculated hours & amount
  const liveHours = calculateShiftHours(startTime, endTime, breakMinutes);
  const liveTotal = Math.round(liveHours * customHourlyRate * 100) / 100;

  // Live calculated hours & amount for editing shift
  const editShiftLiveHours = calculateShiftHours(editStartTime, editEndTime, editBreakMinutes);
  const editShiftLiveTotal = Math.round(editShiftLiveHours * editHourlyRate * 100) / 100;
  const editShiftLiveBalance = Math.max(0, Math.round((editShiftLiveTotal - editPaidAmount) * 100) / 100);

  // Filter shifts by dateRange (or month) and freelancer
  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      if (dateRange) {
        if (!isDateInRange(s.shift_date, dateRange)) return false;
      } else {
        const dt = new Date(s.shift_date + 'T00:00:00');
        if (dt.getMonth() + 1 !== selectedMonth || dt.getFullYear() !== selectedYear) {
          return false;
        }
      }
      if (selectedFreelancerId !== 'all' && s.freelancer_id !== selectedFreelancerId) {
        return false;
      }
      return true;
    });
  }, [shifts, dateRange, selectedMonth, selectedYear, selectedFreelancerId]);

  // Summaries per freelancer (Section 18)
  const summaries = useMemo(() => {
    const map = new Map<string, {
      freelancer: Freelancer;
      totalHours: number;
      totalAmount: number;
      paidAmount: number;
      balanceDue: number;
    }>();

    freelancers.forEach((f) => {
      map.set(f.id, {
        freelancer: f,
        totalHours: 0,
        totalAmount: 0,
        paidAmount: 0,
        balanceDue: 0
      });
    });

    filteredShifts.forEach((s) => {
      const entry = map.get(s.freelancer_id);
      if (entry) {
        entry.totalHours += Number(s.hours_worked || 0);
        entry.totalAmount += Number(s.total_amount || 0);
        entry.paidAmount += Number(s.paid_amount || 0);
        entry.balanceDue += Number(s.balance_due || (Number(s.total_amount) - Number(s.paid_amount)));
      }
    });

    return Array.from(map.values()).filter((item) => selectedFreelancerId === 'all' || item.freelancer.id === selectedFreelancerId);
  }, [freelancers, filteredShifts, selectedFreelancerId]);

  // Overall totals
  const overallTotals = useMemo(() => {
    const hours = filteredShifts.reduce((acc, s) => acc + Number(s.hours_worked || 0), 0);
    const total = filteredShifts.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
    const paid = filteredShifts.reduce((acc, s) => acc + Number(s.paid_amount || 0), 0);
    const balance = total - paid;
    return { hours, total, paid, balance };
  }, [filteredShifts]);

  const handleCreateFreelancer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freelancerName.trim()) return;

    try {
      const { error } = await supabase.from('freelancers').insert({
        name: freelancerName.trim(),
        default_hourly_rate: Number(defaultRate) || 15,
        phone: freelancerPhone.trim() || null,
        pix_key: freelancerPix.trim() || null,
        is_active: true
      });

      if (error) throw error;
      setFreelancerName('');
      setShowFreelancerModal(false);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao cadastrar freelancer: ' + err.message);
    }
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftFreelancerId) {
      alert('Selecione um freelancer.');
      return;
    }

    setIsSaving(true);
    try {
      const hours = calculateShiftHours(startTime, endTime, breakMinutes);
      const totalAmount = Math.round(hours * customHourlyRate * 100) / 100;

      const { error } = await supabase.from('freelancer_shifts').insert({
        shift_date: shiftDate,
        freelancer_id: shiftFreelancerId,
        start_time: startTime,
        end_time: endTime,
        break_minutes: Number(breakMinutes) || 0,
        hours_worked: hours,
        hourly_rate: Number(customHourlyRate) || 15,
        total_amount: totalAmount,
        paid_amount: 0,
        balance_due: totalAmount,
        payment_status: 'pending',
        notes: shiftNotes.trim() || null
      });

      if (error) throw error;
      setShowShiftModal(false);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao registrar turno: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenPayShift = (s: FreelancerShift) => {
    setPayingShift(s);
    setPayAmount(Number(s.balance_due) || 0);
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayMethod('Pix');
  };

  const handleConfirmPayShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingShift) return;

    const numPay = Number(payAmount);
    if (isNaN(numPay) || numPay <= 0) {
      alert('Informe um valor de pagamento válido maior que zero.');
      return;
    }

    setIsSavingPay(true);
    try {
      const newPaid = Math.min(payingShift.total_amount, Math.round((Number(payingShift.paid_amount || 0) + numPay) * 100) / 100);
      const newBalance = Math.max(0, Math.round((payingShift.total_amount - newPaid) * 100) / 100);
      const newStatus = newBalance === 0 ? 'paid' : 'partially_paid';

      // Update freelancer shift only (no auto cash launch)
      const { error } = await supabase
        .from('freelancer_shifts')
        .update({
          paid_amount: newPaid,
          balance_due: newBalance,
          payment_status: newStatus,
          payment_date: payDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', payingShift.id);

      if (error) throw error;

      setPayingShift(null);
      onRefresh();
    } catch (err: any) {
      console.error('Erro ao pagar turno:', err);
      alert('Erro ao pagar turno: ' + (err.message || String(err)));
    } finally {
      setIsSavingPay(false);
    }
  };

  // --- EDIT & DELETE SHIFT HANDLERS ---
  const openEditShift = (s: FreelancerShift) => {
    setEditingShift(s);
    setEditShiftFreelancerId(s.freelancer_id);
    setEditShiftDate(s.shift_date);
    setEditStartTime(s.start_time);
    setEditEndTime(s.end_time);
    setEditBreakMinutes(s.break_minutes || 0);
    setEditHourlyRate(Number(s.hourly_rate) || 15);
    setEditPaidAmount(Number(s.paid_amount) || 0);
    setEditShiftNotes(s.notes || '');
  };

  const handleSaveEditShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShift) return;
    if (!editShiftFreelancerId) {
      alert('Selecione um freelancer.');
      return;
    }

    setIsSavingShiftEdit(true);
    try {
      const hours = calculateShiftHours(editStartTime, editEndTime, editBreakMinutes);
      const total = Math.round(hours * editHourlyRate * 100) / 100;
      const paid = Math.min(total, Math.max(0, Number(editPaidAmount) || 0));
      const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
      const status = balance === 0 ? 'paid' : (paid > 0 ? 'partially_paid' : 'pending');

      const { error } = await supabase
        .from('freelancer_shifts')
        .update({
          shift_date: editShiftDate,
          freelancer_id: editShiftFreelancerId,
          start_time: editStartTime,
          end_time: editEndTime,
          break_minutes: Number(editBreakMinutes) || 0,
          hours_worked: hours,
          hourly_rate: Number(editHourlyRate) || 0,
          total_amount: total,
          paid_amount: paid,
          balance_due: balance,
          payment_status: status,
          notes: editShiftNotes.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingShift.id);

      if (error) throw error;
      setEditingShift(null);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao atualizar turno: ' + err.message);
    } finally {
      setIsSavingShiftEdit(false);
    }
  };

  const handleConfirmDeleteShift = async () => {
    if (!deletingShift) return;
    setIsDeletingShift(true);
    try {
      const { error } = await supabase
        .from('freelancer_shifts')
        .delete()
        .eq('id', deletingShift.id);

      if (error) throw error;
      setDeletingShift(null);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao excluir turno: ' + err.message);
    } finally {
      setIsDeletingShift(false);
    }
  };

  // --- EDIT & DELETE FREELANCER HANDLERS ---
  const openEditFreelancer = (f: Freelancer) => {
    setEditingFreelancer(f);
    setEditFreelancerName(f.name);
    setEditFreelancerRate(Number(f.default_hourly_rate) || 15);
    setEditFreelancerPhone(f.phone || '');
    setEditFreelancerPix(f.pix_key || '');
  };

  const handleSaveEditFreelancer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFreelancer) return;
    if (!editFreelancerName.trim()) {
      alert('Informe o nome do freelancer.');
      return;
    }

    setIsSavingFreelancerEdit(true);
    try {
      const { error } = await supabase
        .from('freelancers')
        .update({
          name: editFreelancerName.trim(),
          default_hourly_rate: Number(editFreelancerRate) || 15,
          phone: editFreelancerPhone.trim() || null,
          pix_key: editFreelancerPix.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingFreelancer.id);

      if (error) throw error;
      setEditingFreelancer(null);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao atualizar freelancer: ' + err.message);
    } finally {
      setIsSavingFreelancerEdit(false);
    }
  };

  const handleConfirmDeleteFreelancer = async () => {
    if (!deletingFreelancer) return;
    setIsDeletingFreelancer(true);
    try {
      // Excluir turnos do freelancer primeiro para manter integridade
      const { error: shiftsErr } = await supabase
        .from('freelancer_shifts')
        .delete()
        .eq('freelancer_id', deletingFreelancer.id);
      if (shiftsErr) throw shiftsErr;

      const { error } = await supabase
        .from('freelancers')
        .delete()
        .eq('id', deletingFreelancer.id);

      if (error) throw error;
      setDeletingFreelancer(null);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao excluir freelancer: ' + err.message);
    } finally {
      setIsDeletingFreelancer(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={28} color="#A855F7" />
            Controle de Freelancers
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Registro de turnos (com suporte a madrugada), valores/hora, histórico e pagamentos
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {dateRange && onDateRangeChange && (
            <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
          )}
          <select
            className="select"
            value={selectedFreelancerId}
            onChange={(e) => setSelectedFreelancerId(e.target.value)}
            style={{ width: 'auto', minWidth: '180px', padding: '6px 12px', fontSize: '0.875rem' }}
          >
            <option value="all">Todos os Freelancers</option>
            {freelancers.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <button onClick={() => setShowFreelancerModal(true)} className="btn btn-secondary">
            <UserPlus size={16} />
            <span>+ Freelancer</span>
          </button>
          <button onClick={() => setShowShiftModal(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>+ Lançar Turno</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div className="kpi-card">
          <div className="kpi-title">Horas Trabalhadas no Mês</div>
          <div className="kpi-value">{formatHours(overallTotals.hours)}</div>
          <div className="kpi-subtitle">Total acumulado ({overallTotals.hours.toFixed(1)}h)</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Total a Pagar</div>
          <div className="kpi-value" style={{ color: '#F8FAFC' }}>{formatCurrency(overallTotals.total)}</div>
          <div className="kpi-subtitle">Todos os turnos registrados</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title" style={{ color: '#34D399' }}>Já Pago</div>
          <div className="kpi-value" style={{ color: '#34D399' }}>{formatCurrency(overallTotals.paid)}</div>
          <div className="kpi-subtitle">Liquidados</div>
        </div>

        <div className="kpi-card" style={{ borderColor: overallTotals.balance > 0 ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-color)' }}>
          <div className="kpi-title" style={{ color: overallTotals.balance > 0 ? '#FBBF24' : 'var(--text-secondary)' }}>
            Saldo Pendente
          </div>
          <div className="kpi-value" style={{ color: overallTotals.balance > 0 ? '#FBBF24' : '#F8FAFC' }}>
            {formatCurrency(overallTotals.balance)}
          </div>
          <div className="kpi-subtitle" style={{ color: '#FBBF24' }}>
            A ser pago
          </div>
        </div>
      </div>

      {/* Resumo por Freelancer (Section 18 Cards) */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', color: '#F8FAFC' }}>
          Resumo Individual por Freelancer (Mês {selectedMonth}/{selectedYear})
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {summaries.map((item) => (
            <div key={item.freelancer.id} className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#F8FAFC' }}>
                  {item.freelancer.name}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="badge badge-neutral">R$ {item.freelancer.default_hourly_rate.toFixed(2)}/h</span>
                  <button
                    type="button"
                    onClick={() => openEditFreelancer(item.freelancer)}
                    className="btn btn-secondary btn-sm"
                    title="Editar dados do freelancer"
                    style={{ color: '#38BDF8', padding: '4px 7px' }}
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingFreelancer(item.freelancer)}
                    className="btn btn-secondary btn-sm"
                    title="Excluir freelancer"
                    style={{ color: '#FB7185', padding: '4px 7px' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <div>Horas no mês: <strong style={{ color: '#F8FAFC' }}>{formatHours(item.totalHours)}</strong></div>
                <div>Total: <strong style={{ color: '#F8FAFC' }}>{formatCurrency(item.totalAmount)}</strong></div>
                <div>Pago: <strong style={{ color: '#34D399' }}>{formatCurrency(item.paidAmount)}</strong></div>
                <div>Pendente: <strong style={{ color: item.balanceDue > 0 ? '#FBBF24' : '#34D399' }}>{formatCurrency(item.balanceDue)}</strong></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shifts Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Freelancer</th>
              <th>Entrada</th>
              <th>Saída</th>
              <th>Intervalo</th>
              <th>Horas</th>
              <th>Valor/Hora</th>
              <th>Total Turno</th>
              <th>Pago</th>
              <th>Pendente</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredShifts.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Nenhum turno registrado para este período.
                </td>
              </tr>
            ) : (
              filteredShifts.map((s) => {
                const freelancer = freelancers.find((f) => f.id === s.freelancer_id);
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{formatDate(s.shift_date)}</td>
                    <td style={{ fontWeight: 600, color: '#F8FAFC' }}>{freelancer?.name || 'N/A'}</td>
                    <td>{s.start_time}</td>
                    <td>{s.end_time}</td>
                    <td>{s.break_minutes ? `${s.break_minutes} min` : '-'}</td>
                    <td style={{ fontWeight: 600, color: '#38BDF8' }}>{formatHours(s.hours_worked)}</td>
                    <td>{formatCurrency(s.hourly_rate)}</td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(s.total_amount)}</td>
                    <td style={{ color: '#34D399' }}>{formatCurrency(s.paid_amount)}</td>
                    <td style={{ color: s.balance_due > 0 ? '#FBBF24' : 'var(--text-muted)', fontWeight: 600 }}>
                      {formatCurrency(s.balance_due)}
                    </td>
                    <td>
                      <span className={`badge ${
                        s.payment_status === 'paid' ? 'badge-success' :
                        s.payment_status === 'partially_paid' ? 'badge-warning' : 'badge-danger'
                      }`}>
                        {s.payment_status === 'paid' ? 'Pago' : s.payment_status === 'partially_paid' ? 'Parcial' : 'Pendente'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                        {s.balance_due > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenPayShift(s)}
                            className="btn btn-primary btn-sm"
                            title="Dar baixa / Pagar turno"
                            style={{ padding: '5px 8px', fontSize: '0.75rem' }}
                          >
                            <CreditCard size={12} />
                            <span>Pagar</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditShift(s)}
                          className="btn btn-secondary btn-sm"
                          title="Editar turno"
                          style={{ color: '#38BDF8', padding: '5px 8px' }}
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingShift(s)}
                          className="btn btn-secondary btn-sm"
                          title="Excluir turno"
                          style={{ color: '#FB7185', padding: '5px 8px' }}
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

      {/* New Freelancer Modal */}
      {showFreelancerModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Cadastrar Freelancer</h3>
              <button onClick={() => setShowFreelancerModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateFreelancer}>
              <div className="form-group">
                <label className="form-label">Nome Completo *</label>
                <input
                  type="text"
                  className="input"
                  value={freelancerName}
                  onChange={(e) => setFreelancerName(e.target.value)}
                  placeholder="Ex: João Silva"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Valor Padrão por Hora (R$) *</label>
                <input
                  type="number"
                  step="0.50"
                  className="input"
                  value={defaultRate}
                  onChange={(e) => setDefaultRate(parseFloat(e.target.value) || 15)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input
                  type="text"
                  className="input"
                  value={freelancerPhone}
                  onChange={(e) => setFreelancerPhone(e.target.value)}
                  placeholder="(35) 99999-9999"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Chave PIX</label>
                <input
                  type="text"
                  className="input"
                  value={freelancerPix}
                  onChange={(e) => setFreelancerPix(e.target.value)}
                  placeholder="CPF ou Chave PIX"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowFreelancerModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Shift Modal */}
      {showShiftModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Lançar Turno de Freelancer</h3>
              <button onClick={() => setShowShiftModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateShift}>
              <div className="form-group">
                <label className="form-label">Freelancer *</label>
                <select
                  className="select"
                  value={shiftFreelancerId}
                  onChange={(e) => {
                    setShiftFreelancerId(e.target.value);
                    const selected = freelancers.find((f) => f.id === e.target.value);
                    if (selected) setCustomHourlyRate(selected.default_hourly_rate);
                  }}
                  required
                >
                  <option value="">Selecione um freelancer...</option>
                  {freelancers.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} (R$ {f.default_hourly_rate.toFixed(2)}/h)</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Data do Turno *</label>
                  <input
                    type="date"
                    className="input"
                    value={shiftDate}
                    onChange={(e) => setShiftDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Valor por Hora (R$) *</label>
                  <input
                    type="number"
                    step="0.50"
                    className="input"
                    value={customHourlyRate}
                    onChange={(e) => setCustomHourlyRate(parseFloat(e.target.value) || 15)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Entrada (HH:mm) *</label>
                  <input
                    type="time"
                    className="input"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Saída (HH:mm) *</label>
                  <input
                    type="time"
                    className="input"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Intervalo (min)</label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    className="input"
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Real-time calculated display */}
              <div style={{
                backgroundColor: '#0E1524',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                padding: '12px',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Horas Calculadas:</div>
                  <strong style={{ fontSize: '1.1rem', color: '#38BDF8' }}>{formatHours(liveHours)} ({liveHours.toFixed(2)}h)</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total a Pagar:</div>
                  <strong style={{ fontSize: '1.25rem', color: '#34D399' }}>{formatCurrency(liveTotal)}</strong>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Observações</label>
                <input
                  type="text"
                  className="input"
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  placeholder="Ex: Turno de sábado à noite"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowShiftModal(false)} className="btn btn-secondary" disabled={isSaving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar Turno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Shift Modal */}
      {editingShift && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#F8FAFC' }}>
                <Edit3 size={20} color="#38BDF8" />
                Editar Turno de Freelancer
              </h3>
              <button 
                type="button" 
                onClick={() => setEditingShift(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEditShift}>
              <div className="form-group">
                <label className="form-label">Freelancer *</label>
                <select
                  className="select"
                  value={editShiftFreelancerId}
                  onChange={(e) => setEditShiftFreelancerId(e.target.value)}
                  required
                >
                  <option value="">Selecione um freelancer...</option>
                  {freelancers.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} (R$ {f.default_hourly_rate.toFixed(2)}/h)</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Data do Turno *</label>
                  <input
                    type="date"
                    className="input"
                    value={editShiftDate}
                    onChange={(e) => setEditShiftDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Valor por Hora (R$) *</label>
                  <input
                    type="number"
                    step="0.50"
                    className="input"
                    value={editHourlyRate}
                    onChange={(e) => setEditHourlyRate(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Entrada (HH:mm) *</label>
                  <input
                    type="time"
                    className="input"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Saída (HH:mm) *</label>
                  <input
                    type="time"
                    className="input"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Intervalo (min)</label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    className="input"
                    value={editBreakMinutes}
                    onChange={(e) => setEditBreakMinutes(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Real-time calculated display */}
              <div style={{
                backgroundColor: '#0E1524',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '12px',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Horas Recalculadas:</div>
                  <strong style={{ fontSize: '1.1rem', color: '#38BDF8' }}>{formatHours(editShiftLiveHours)} ({editShiftLiveHours.toFixed(2)}h)</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total do Turno:</div>
                  <strong style={{ fontSize: '1.25rem', color: '#34D399' }}>{formatCurrency(editShiftLiveTotal)}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Valor Já Pago (R$)</label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    className="input"
                    value={editPaidAmount}
                    onChange={(e) => setEditPaidAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Saldo Pendente</label>
                  <input
                    type="text"
                    className="input"
                    value={formatCurrency(editShiftLiveBalance)}
                    disabled
                    style={{ backgroundColor: '#0B111E', color: editShiftLiveBalance > 0 ? '#FBBF24' : '#34D399', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Observações</label>
                <input
                  type="text"
                  className="input"
                  value={editShiftNotes}
                  onChange={(e) => setEditShiftNotes(e.target.value)}
                  placeholder="Ex: Turno de sábado à noite"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setEditingShift(null)} className="btn btn-secondary" disabled={isSavingShiftEdit}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSavingShiftEdit}>
                  {isSavingShiftEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Shift Confirmation Modal */}
      {deletingShift && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#FB7185' }}>
                <Trash2 size={20} color="#FB7185" />
                Excluir Turno
              </h3>
              <button 
                type="button" 
                onClick={() => setDeletingShift(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px', lineHeight: 1.5 }}>
              Deseja realmente excluir o turno do dia <strong style={{ color: '#F8FAFC' }}>{formatDate(deletingShift.shift_date)}</strong>{' '}
              ({formatHours(deletingShift.hours_worked)} - {formatCurrency(deletingShift.total_amount)})?
              Esta ação não poderá ser desfeita.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setDeletingShift(null)} className="btn btn-secondary" disabled={isDeletingShift}>
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleConfirmDeleteShift} 
                className="btn btn-danger" 
                disabled={isDeletingShift}
              >
                {isDeletingShift ? 'Excluindo...' : 'Excluir Turno'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Freelancer Modal */}
      {editingFreelancer && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#F8FAFC' }}>
                <Edit3 size={20} color="#38BDF8" />
                Editar Freelancer
              </h3>
              <button 
                type="button" 
                onClick={() => setEditingFreelancer(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEditFreelancer}>
              <div className="form-group">
                <label className="form-label">Nome Completo *</label>
                <input
                  type="text"
                  className="input"
                  value={editFreelancerName}
                  onChange={(e) => setEditFreelancerName(e.target.value)}
                  placeholder="Ex: João Silva"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Valor Padrão por Hora (R$) *</label>
                <input
                  type="number"
                  step="0.50"
                  className="input"
                  value={editFreelancerRate}
                  onChange={(e) => setEditFreelancerRate(parseFloat(e.target.value) || 15)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input
                  type="text"
                  className="input"
                  value={editFreelancerPhone}
                  onChange={(e) => setEditFreelancerPhone(e.target.value)}
                  placeholder="(35) 99999-9999"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Chave PIX</label>
                <input
                  type="text"
                  className="input"
                  value={editFreelancerPix}
                  onChange={(e) => setEditFreelancerPix(e.target.value)}
                  placeholder="CPF ou Chave PIX"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setEditingFreelancer(null)} className="btn btn-secondary" disabled={isSavingFreelancerEdit}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSavingFreelancerEdit}>
                  {isSavingFreelancerEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Freelancer Confirmation Modal */}
      {deletingFreelancer && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#FB7185' }}>
                <Trash2 size={20} color="#FB7185" />
                Excluir Freelancer
              </h3>
              <button 
                type="button" 
                onClick={() => setDeletingFreelancer(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '12px', lineHeight: 1.5 }}>
              Deseja realmente excluir o freelancer <strong style={{ color: '#F8FAFC' }}>{deletingFreelancer.name}</strong>?
            </p>

            {shifts.filter(s => s.freelancer_id === deletingFreelancer.id).length > 0 && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '10px 12px',
                borderRadius: '8px',
                color: '#F87171',
                fontSize: '0.825rem',
                marginBottom: '16px'
              }}>
                Atenção: Existem <strong>{shifts.filter(s => s.freelancer_id === deletingFreelancer.id).length}</strong> turno(s) vinculado(s) a este freelancer no histórico. Eles também serão excluídos.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setDeletingFreelancer(null)} className="btn btn-secondary" disabled={isDeletingFreelancer}>
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleConfirmDeleteFreelancer} 
                className="btn btn-danger" 
                disabled={isDeletingFreelancer}
              >
                {isDeletingFreelancer ? 'Excluindo...' : 'Excluir Freelancer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Shift Modal */}
      {payingShift && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} color="#34D399" />
                Registrar Pagamento do Freelancer
              </h3>
              <button 
                type="button" 
                onClick={() => setPayingShift(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                disabled={isSavingPay}
              >
                <X size={20} />
              </button>
            </div>

            {/* Shift Info Card */}
            {(() => {
              const fl = freelancers.find((f) => f.id === payingShift.freelancer_id);
              return (
                <div style={{
                  backgroundColor: 'rgba(52, 211, 153, 0.08)',
                  border: '1px solid rgba(52, 211, 153, 0.25)',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '1.05rem' }}>
                      {fl?.name || 'Freelancer'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Turno: {formatDate(payingShift.shift_date)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    <span>Horas: <strong>{formatHours(payingShift.hours_worked)}</strong> ({payingShift.start_time} às {payingShift.end_time})</span>
                    <span>Total Turno: <strong>{formatCurrency(payingShift.total_amount)}</strong></span>
                  </div>
                  {Number(payingShift.paid_amount || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#34D399', marginTop: '4px' }}>
                      <span>Já pago anteriormente:</span>
                      <strong>{formatCurrency(payingShift.paid_amount)}</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#FBBF24', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <span>Saldo Devedor Pendente:</span>
                    <strong style={{ fontSize: '0.95rem' }}>{formatCurrency(payingShift.balance_due)}</strong>
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleConfirmPayShift}>
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
                  <label className="form-label">Valor a Pagar (R$) *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600 }}>
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="input"
                      style={{ paddingLeft: '38px', fontWeight: 700, color: '#34D399', fontSize: '1.05rem' }}
                      value={isNaN(payAmount) ? '' : payAmount}
                      onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Forma de Pagamento</label>
                <select
                  className="select"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option value="Pix">Pix</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão de débito">Cartão de Débito</option>
                  <option value="Transferência Bancária">Transferência Bancária</option>
                </select>
              </div>

              {/* Informative notice - only records in Freelancers */}
              <div style={{
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                marginBottom: '16px',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)'
              }}>
                <span style={{ color: '#38BDF8', fontWeight: 600 }}>Registro exclusivo em Freelancers: </span>
                O pagamento será computado apenas nesta categoria, sem lançamento automático na aba de Saídas.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setPayingShift(null)}
                  className="btn btn-secondary"
                  disabled={isSavingPay}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#10B981', borderColor: '#10B981', display: 'flex', alignItems: 'center', gap: '6px' }}
                  disabled={isSavingPay}
                >
                  <Check size={16} />
                  <span>{isSavingPay ? 'Gravando...' : 'Confirmar Pagamento'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
