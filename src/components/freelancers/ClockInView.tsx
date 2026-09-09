import React, { useState } from 'react';
import { Clock, CheckCircle2, User, ArrowLeft } from 'lucide-react';
import { Freelancer } from '../../types';
import { supabase } from '../../lib/supabase';
import { calculateShiftHours } from '../../lib/calculations';
import { formatHours } from '../../lib/formatters';

interface ClockInViewProps {
  freelancers: Freelancer[];
  onBackToDashboard: () => void;
  onSuccess: () => void;
}

export const ClockInView: React.FC<ClockInViewProps> = ({
  freelancers,
  onBackToDashboard,
  onSuccess
}) => {
  const [selectedFreelancerId, setSelectedFreelancerId] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState<string>('18:00');
  const [endTime, setEndTime] = useState<string>('01:30');
  const [breakMinutes, setBreakMinutes] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const hoursWorked = calculateShiftHours(startTime, endTime, breakMinutes);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFreelancerId) {
      alert('Por favor, selecione o seu nome.');
      return;
    }

    setIsSaving(true);
    try {
      const selected = freelancers.find((f) => f.id === selectedFreelancerId);
      const hourlyRate = selected ? selected.default_hourly_rate : 15.0;
      const totalAmount = Math.round(hoursWorked * hourlyRate * 100) / 100;

      const { error } = await supabase.from('freelancer_shifts').insert({
        shift_date: date,
        freelancer_id: selectedFreelancerId,
        start_time: startTime,
        end_time: endTime,
        break_minutes: breakMinutes,
        hours_worked: hoursWorked,
        hourly_rate: hourlyRate,
        total_amount: totalAmount,
        paid_amount: 0,
        balance_due: totalAmount,
        payment_status: 'pending',
        notes: notes.trim() || null
      });

      if (error) throw error;

      setIsSubmitted(true);
      onSuccess();
    } catch (err: any) {
      alert('Erro ao registrar ponto: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-main)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '460px',
        width: '100%',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '32px 24px',
        boxShadow: 'var(--shadow-lg)'
      }}>
        {/* Top Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            color: '#FBBF24',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px auto'
          }}>
            <Clock size={28} />
          </div>
          <h2 style={{ fontSize: '1.4rem', color: '#F8FAFC' }}>Registro de Horário</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Informe seus dados de entrada e saída do turno
          </p>
        </div>

        {isSubmitted ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ color: '#34D399', marginBottom: '12px' }}>
              <CheckCircle2 size={54} style={{ margin: '0 auto' }} />
            </div>
            <h3 style={{ fontSize: '1.2rem', color: '#F8FAFC', marginBottom: '8px' }}>
              Turno Registrado com Sucesso!
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Foram computadas <strong>{formatHours(hoursWorked)}</strong> de trabalho para este dia.
            </p>
            <button
              onClick={() => {
                setIsSubmitted(false);
                setSelectedFreelancerId('');
                setNotes('');
              }}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              Registrar Outro Turno
            </button>
            <button
              onClick={onBackToDashboard}
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '10px' }}
            >
              Voltar ao Painel Geral
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Freelancer Name Selection */}
            <div className="form-group">
              <label className="form-label">Selecione o seu nome *</label>
              <select
                className="select"
                value={selectedFreelancerId}
                onChange={(e) => setSelectedFreelancerId(e.target.value)}
                required
              >
                <option value="">Escolha seu nome...</option>
                {freelancers.filter((f) => f.is_active).map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="form-group">
              <label className="form-label">Data do Turno *</label>
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {/* Times */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Horário de Entrada *</label>
                <input
                  type="time"
                  className="input"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Horário de Saída *</label>
                <input
                  type="time"
                  className="input"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Break */}
            <div className="form-group">
              <label className="form-label">Intervalo de descanso (minutos)</label>
              <input
                type="number"
                min="0"
                step="5"
                className="input"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 0)}
              />
            </div>

            {/* Summary Preview */}
            <div style={{
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              padding: '12px 14px',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Calculado:</span>
              <strong style={{ fontSize: '1.1rem', color: '#38BDF8' }}>
                {formatHours(hoursWorked)} ({hoursWorked.toFixed(2)}h)
              </strong>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Observações (opcional)</label>
              <input
                type="text"
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Saí 30min mais tarde para fechar cozinha"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isSaving}>
              {isSaving ? 'Gravando...' : 'Confirmar e Bater Ponto'}
            </button>

            <button
              type="button"
              onClick={onBackToDashboard}
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '10px' }}
            >
              <ArrowLeft size={15} />
              Voltar ao Painel Geral
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
