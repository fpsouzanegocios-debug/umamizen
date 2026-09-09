import React, { useState, useEffect } from 'react';
import { X, Check, DollarSign, Calendar, Copy, CheckCheck, AlertCircle, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Courier, Delivery, CourierDailyPayment } from '../../types';
import { formatCurrency } from '../../lib/formatters';

interface CourierPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  courierName: string;
  courier?: Courier | null;
  dateStr: string; // YYYY-MM-DD
  dayDeliveries: Delivery[];
  existingPayment?: CourierDailyPayment | null;
}

export const CourierPaymentModal: React.FC<CourierPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  courierName,
  courier,
  dateStr,
  dayDeliveries,
  existingPayment
}) => {
  const [paidAmount, setPaidAmount] = useState<number | string>(0);
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Pix');
  const [notes, setNotes] = useState<string>('');
  const [copiedPix, setCopiedPix] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Calculations for this day
  const totalDeliveries = dayDeliveries.length;
  const baseTotal = dayDeliveries.reduce((acc, d) => acc + (Number(d.base_rate) || 8.00), 0);
  const additionalsTotal = dayDeliveries.reduce((acc, d) => acc + (Number(d.additional_rate) || 0), 0);
  const totalToPay = baseTotal + additionalsTotal;

  useEffect(() => {
    if (isOpen) {
      if (existingPayment && existingPayment.is_paid) {
        setPaidAmount(Number(existingPayment.paid_amount) || totalToPay);
        setPaymentDate(existingPayment.payment_date || dateStr);
        setPaymentMethod(existingPayment.payment_method || 'Pix');
        setNotes(existingPayment.notes || '');
      } else {
        setPaidAmount(totalToPay);
        const today = new Date().toISOString().slice(0, 10);
        setPaymentDate(today);
        setPaymentMethod('Pix');
        setNotes('');
      }
      setCopiedPix(false);
    }
  }, [isOpen, existingPayment, totalToPay, dateStr]);

  if (!isOpen) return null;

  const handleCopyPix = () => {
    if (courier?.pix_key) {
      navigator.clipboard.writeText(courier.pix_key);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2500);
    }
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const numPaid = Number(paidAmount) || totalToPay;

      // 1. Upsert courier_daily_payments with all column aliases for full database compatibility
      const payload = {
        courier_id: courier?.id || null,
        courier_name: courierName,
        payment_date: dateStr,
        delivery_count: totalDeliveries,
        total_deliveries: totalDeliveries,
        base_total: baseTotal,
        base_amount: baseTotal,
        additional_total: additionalsTotal,
        additional_amount: additionalsTotal,
        total_paid: numPaid,
        paid_amount: numPaid,
        total_amount: totalToPay,
        payment_method: paymentMethod,
        is_paid: true,
        paid_at: new Date().toISOString(),
        paid_by: 'Administrador',
        notes: notes.trim(),
        updated_at: new Date().toISOString()
      };

      const { data: savedPayment, error: payErr } = await supabase
        .from('courier_daily_payments')
        .upsert(payload, { onConflict: 'courier_name,payment_date' })
        .select()
        .maybeSingle();

      if (payErr) {
        console.error('Erro ao registrar courier_daily_payments:', payErr);
        throw payErr;
      }

      // 2. Mark all deliveries of this courier on this day as paid
      const deliveryIds = dayDeliveries.map((d) => d.id);
      if (deliveryIds.length > 0) {
        const { error: delivErr } = await supabase
          .from('deliveries')
          .update({
            is_paid: true,
            payment_id: savedPayment?.id || null
          })
          .in('id', deliveryIds);

        if (delivErr) console.error('Erro ao atualizar status nas entregas:', delivErr);
      }

      // Close modal and notify parent immediately
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao registrar pagamento: ' + (err.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const [confirmUnmark, setConfirmUnmark] = useState<boolean>(false);

  const handleUnmarkPayment = async () => {
    setIsSubmitting(true);
    try {
      // 1. Delete courier_daily_payments record
      if (existingPayment?.id) {
        const { error: idDelErr } = await supabase
          .from('courier_daily_payments')
          .delete()
          .eq('id', existingPayment.id);
        if (idDelErr) console.error('Erro ao excluir por id:', idDelErr);
      }

      // Also ensure deleted by courier_name and payment_date
      const { error: matchDelErr } = await supabase
        .from('courier_daily_payments')
        .delete()
        .ilike('courier_name', courierName)
        .eq('payment_date', dateStr);
      if (matchDelErr) console.error('Erro ao excluir por data/nome:', matchDelErr);

      // 2. Mark deliveries of this day as unpaid
      const deliveryIds = dayDeliveries.map((d) => d.id);
      if (deliveryIds.length > 0) {
        const { error: delivErr } = await supabase
          .from('deliveries')
          .update({
            is_paid: false,
            payment_id: null
          })
          .in('id', deliveryIds);

        if (delivErr) console.error('Erro ao desmarcar entregas:', delivErr);
      }

      setConfirmUnmark(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao desmarcar pagamento:', err);
      alert('Erro ao desmarcar pagamento: ' + (err.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDay = dateStr.split('-').reverse().join('/');

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '560px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: existingPayment?.is_paid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: existingPayment?.is_paid ? '#10B981' : '#38BDF8'
            }}>
              <DollarSign size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC' }}>
                {existingPayment?.is_paid ? 'Acerto de Diária Pago' : 'Marcar Dia como Pago'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Motoboy: <strong style={{ color: '#38BDF8' }}>{courierName}</strong> • Data: <strong>{formattedDay}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Resumo do Dia */}
        <div style={{
          backgroundColor: 'var(--bg-input)',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '16px'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px' }}>
            EXTRATO DO DIA ({formattedDay})
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Entregas</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{totalDeliveries}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Base (R$ 8)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#F8FAFC' }}>
                {formatCurrency(baseTotal)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Adicionais Bairros</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#FBBF24' }}>
                +{formatCurrency(additionalsTotal)}
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '10px',
            borderTop: '1px solid var(--border-color)'
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#34D399' }}>
              TOTAL CALCULADO DO DIA:
            </span>
            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#34D399' }}>
              {formatCurrency(totalToPay)}
            </span>
          </div>
        </div>

        {/* Chave Pix do Motoboy */}
        {courier?.pix_key && (
          <div style={{
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CHAVE PIX DO MOTOBOY</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#38BDF8' }}>
                {courier.pix_key}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyPix}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {copiedPix ? <CheckCheck size={14} color="#10B981" /> : <Copy size={14} />}
              <span>{copiedPix ? 'Copiado!' : 'Copiar Pix'}</span>
            </button>
          </div>
        )}

        <form onSubmit={handleConfirmPayment}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Valor Pago (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                style={{ fontWeight: 700, color: '#34D399', fontSize: '1.1rem' }}
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Data do Pagamento *</label>
              <input
                type="date"
                className="input"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Forma de Pagamento *</label>
              <select
                className="select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                required
              >
                <option value="Pix">Pix</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Transferência Bancária">Transferência Bancária</option>
                <option value="Cartão de débito">Cartão de débito</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Observações / Comprovante</label>
              <input
                type="text"
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Pago às 23h30 via Pix Nubank"
              />
            </div>
          </div>

          {/* Aviso contextual de exclusividade */}
          <div style={{
            backgroundColor: 'rgba(56, 189, 248, 0.05)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '18px',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} color="#38BDF8" style={{ flexShrink: 0 }} />
            <span>
              <strong>Controle exclusivo em Motoboys:</strong> O pagamento será registrado nesta categoria para controle de diárias, sem lançamento automático na aba Saídas.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div>
              {existingPayment?.is_paid && (
                confirmUnmark ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <span style={{ fontSize: '0.78rem', color: '#FCA5A5', fontWeight: 600 }}>Reabrir dia?</span>
                    <button
                      type="button"
                      onClick={handleUnmarkPayment}
                      disabled={isSubmitting}
                      className="btn btn-danger btn-sm"
                      style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                    >
                      {isSubmitting ? 'Reabrindo...' : 'Sim, Reabrir'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmUnmark(false)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmUnmark(true)}
                    disabled={isSubmitting}
                    className="btn btn-secondary btn-sm"
                    style={{ color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                  >
                    <RotateCcw size={14} />
                    <span>Desmarcar Pagamento (Reabrir Dia)</span>
                  </button>
                )
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{ backgroundColor: '#10B981', borderColor: '#10B981', minWidth: '170px' }}
              >
                <Check size={16} />
                <span>{isSubmitting ? 'Salvando...' : (existingPayment?.is_paid ? 'Atualizar Pagamento' : 'Confirmar como Pago')}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
