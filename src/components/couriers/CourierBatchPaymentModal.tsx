import React, { useState, useMemo } from 'react';
import { X, DollarSign, Calendar, Copy, CheckCheck, AlertCircle, CheckCircle2, User, Layers, Wallet, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Courier, Delivery, CourierDailyPayment } from '../../types';
import { formatCurrency } from '../../lib/formatters';
import { getLocalDateKey, formatDateBR } from '../../lib/dateUtils';

export interface SettlementBatchItem {
  dateStr: string;
  courierName: string;
  courier?: Courier | null;
  deliveries: Delivery[];
  totalDeliveries: number;
  baseTotal: number;
  additionalsTotal: number;
  grossTotal: number;
  ordersCashTotal: number;
  retainedCash: number;
  totalToPay: number;
  isDaniel: boolean;
  payment?: CourierDailyPayment | null;
  isPaid: boolean;
}

interface CourierBatchPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedSettlements: SettlementBatchItem[];
}

export const CourierBatchPaymentModal: React.FC<CourierBatchPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  selectedSettlements
}) => {
  const [paymentMethod, setPaymentMethod] = useState<string>('Pix');
  const [paymentDate, setPaymentDate] = useState<string>(() => getLocalDateKey(new Date()));
  const [notes, setNotes] = useState<string>('');
  const [onlyPending, setOnlyPending] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedPixCourierId, setCopiedPixCourierId] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string>('');

  // Partition pending vs paid items
  const pendingItems = useMemo(() => selectedSettlements.filter((s) => !s.isPaid), [selectedSettlements]);
  const paidItems = useMemo(() => selectedSettlements.filter((s) => s.isPaid), [selectedSettlements]);

  // Target items to be paid based on toggle
  const itemsToProcess = useMemo(() => {
    if (pendingItems.length === 0) return selectedSettlements;
    return onlyPending ? pendingItems : selectedSettlements;
  }, [selectedSettlements, pendingItems, onlyPending]);

  // Summation for items to process
  const summary = useMemo(() => {
    let totalDeliveries = 0;
    let baseTotal = 0;
    let additionalsTotal = 0;
    let grossTotal = 0;
    let retainedCashTotal = 0;
    let totalToPay = 0;

    itemsToProcess.forEach((item) => {
      totalDeliveries += item.totalDeliveries;
      baseTotal += item.baseTotal;
      additionalsTotal += item.additionalsTotal;
      grossTotal += item.grossTotal;
      retainedCashTotal += item.retainedCash || 0;
      totalToPay += item.totalToPay;
    });

    return {
      totalDeliveries,
      baseTotal,
      additionalsTotal,
      grossTotal,
      retainedCashTotal: Math.round(retainedCashTotal * 100) / 100,
      totalToPay: Math.max(0, Math.round(totalToPay * 100) / 100)
    };
  }, [itemsToProcess]);

  // Group items by courier for clear multi-courier payout visualization
  const courierGroups = useMemo(() => {
    const map = new Map<string, {
      courierName: string;
      courier?: Courier | null;
      items: SettlementBatchItem[];
      totalDeliveries: number;
      grossTotal: number;
      retainedCash: number;
      totalToPay: number;
      dates: string[];
    }>();

    itemsToProcess.forEach((item) => {
      const key = item.courierName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          courierName: item.courierName,
          courier: item.courier,
          items: [],
          totalDeliveries: 0,
          grossTotal: 0,
          retainedCash: 0,
          totalToPay: 0,
          dates: []
        });
      }

      const grp = map.get(key)!;
      grp.items.push(item);
      grp.totalDeliveries += item.totalDeliveries;
      grp.grossTotal += item.grossTotal;
      grp.retainedCash += item.retainedCash || 0;
      grp.totalToPay += item.totalToPay;
      grp.dates.push(item.dateStr);
    });

    return Array.from(map.values()).sort((a, b) => b.totalToPay - a.totalToPay);
  }, [itemsToProcess]);

  if (!isOpen) return null;

  const handleCopyPix = (pixKey: string, courierKey: string) => {
    navigator.clipboard.writeText(pixKey);
    setCopiedPixCourierId(courierKey);
    setTimeout(() => setCopiedPixCourierId(null), 2500);
  };

  const handleConfirmBatchPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (itemsToProcess.length === 0) return;

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const paidDateIso = paymentDate
        ? new Date(`${paymentDate}T12:00:00`).toISOString()
        : nowIso;

      let processedCount = 0;
      const total = itemsToProcess.length;

      for (const item of itemsToProcess) {
        processedCount++;
        setProgressText(`Processando ${processedCount} de ${total}: ${item.courierName} (${item.dateStr.split('-').reverse().join('/')})...`);

        const numRetained = item.isDaniel ? (Number(item.retainedCash) || 0) : 0;
        const numPaid = Math.max(0, item.totalToPay);
        const effectiveTotalAmount = item.isDaniel ? item.totalToPay : item.grossTotal;

        const payload = {
          courier_id: item.courier?.id || null,
          courier_name: item.courierName,
          payment_date: item.dateStr,
          delivery_count: item.totalDeliveries,
          total_deliveries: item.totalDeliveries,
          base_total: item.baseTotal,
          base_amount: item.baseTotal,
          additional_total: item.additionalsTotal,
          additional_amount: item.additionalsTotal,
          retained_cash: Math.round(numRetained * 100) / 100,
          total_paid: Math.round(numPaid * 100) / 100,
          paid_amount: Math.round(numPaid * 100) / 100,
          total_amount: Math.round(effectiveTotalAmount * 100) / 100,
          payment_method: paymentMethod,
          is_paid: true,
          paid_at: paidDateIso,
          paid_by: 'Administrador',
          notes: notes.trim(),
          updated_at: nowIso
        };

        const { data: savedPayment, error: payErr } = await supabase
          .from('courier_daily_payments')
          .upsert(payload, { onConflict: 'courier_name,payment_date' })
          .select()
          .maybeSingle();

        if (payErr) {
          console.error(`Erro ao salvar diária de ${item.courierName} (${item.dateStr}):`, payErr);
          throw payErr;
        }

        // Mark deliveries of this courier on this day as paid
        const deliveryIds = item.deliveries.map((d) => d.id);
        if (deliveryIds.length > 0) {
          const { error: delivErr } = await supabase
            .from('deliveries')
            .update({
              is_paid: true,
              payment_id: savedPayment?.id || null
            })
            .in('id', deliveryIds);

          if (delivErr) {
            console.error(`Erro ao marcar entregas como pagas de ${item.courierName}:`, delivErr);
          }
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao registrar pagamento em lote: ' + (err.message || String(err)));
    } finally {
      setIsSubmitting(false);
      setProgressText('');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(7, 11, 20, 0.82)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#111827',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '92vh',
        overflowY: 'auto',
        padding: '26px 28px',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34D399',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
            }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#F8FAFC', margin: 0, letterSpacing: '-0.02em' }}>
                  Concluir Pagamento em Lote
                </h3>
                <span style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34D399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  {itemsToProcess.length} {itemsToProcess.length === 1 ? 'diária' : 'diárias'}
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: '4px 0 0 0' }}>
                Liquidação financeira consolidada de diárias e conciliação de entregas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94A3B8',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Global Financial Metrics Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: summary.retainedCashTotal > 0 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '20px'
        }}>
          {/* 1. Diárias */}
          <div style={{
            backgroundColor: '#1E293B',
            borderRadius: '14px',
            padding: '14px 16px',
            border: '1px solid rgba(255, 255, 255, 0.07)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>
              <Layers size={13} color="#38BDF8" />
              <span>Diárias</span>
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#F8FAFC', marginTop: '4px' }}>
              {itemsToProcess.length}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>
              {summary.totalDeliveries} corridas
            </div>
          </div>

          {/* 2. Bruto */}
          <div style={{
            backgroundColor: '#1E293B',
            borderRadius: '14px',
            padding: '14px 16px',
            border: '1px solid rgba(255, 255, 255, 0.07)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>
              <DollarSign size={13} color="#FBBF24" />
              <span>Total Bruto</span>
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#F8FAFC', marginTop: '4px' }}>
              {formatCurrency(summary.grossTotal)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>
              Base + Adicionais
            </div>
          </div>

          {/* 3. Dinheiro Retido */}
          {summary.retainedCashTotal > 0 && (
            <div style={{
              backgroundColor: 'rgba(244, 63, 94, 0.08)',
              borderRadius: '14px',
              padding: '14px 16px',
              border: '1px solid rgba(244, 63, 94, 0.25)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: '#FB7185', fontWeight: 700, textTransform: 'uppercase' }}>
                <Wallet size={13} color="#F43F5E" />
                <span>Dinheiro Retido</span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#F43F5E', marginTop: '4px' }}>
                -{formatCurrency(summary.retainedCashTotal)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#FB7185', marginTop: '2px' }}>
                Abatido em mãos (Daniel)
              </div>
            </div>
          )}

          {/* 4. Líquido a Pagar */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.22) 100%)',
            borderRadius: '14px',
            padding: '14px 16px',
            border: '1.5px solid rgba(16, 185, 129, 0.45)',
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: '#34D399', fontWeight: 800, textTransform: 'uppercase' }}>
              <Sparkles size={13} color="#34D399" />
              <span>Líquido a Pagar</span>
            </div>
            <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#34D399', marginTop: '4px', letterSpacing: '-0.02em' }}>
              {formatCurrency(summary.totalToPay)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#A7F3D0', marginTop: '2px', fontWeight: 600 }}>
              Total a transferir
            </div>
          </div>
        </div>

        {/* If some items were already paid, option to filter */}
        {paidItems.length > 0 && pendingItems.length > 0 && (
          <div style={{
            backgroundColor: 'rgba(251, 191, 36, 0.08)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: '12px',
            padding: '10px 16px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#E2E8F0' }}>
              <AlertCircle size={16} color="#FBBF24" style={{ flexShrink: 0 }} />
              <span>
                Seleção mista: <strong>{pendingItems.length} pendente(s)</strong> e <strong>{paidItems.length} já paga(s)</strong>.
              </span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#F8FAFC', cursor: 'pointer', margin: 0, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={onlyPending}
                onChange={(e) => setOnlyPending(e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#10B981' }}
              />
              <span>Processar apenas pendentes ({pendingItems.length})</span>
            </label>
          </div>
        )}

        {/* Breakdown by Courier Card List */}
        <div style={{ marginBottom: '22px' }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.04em' }}>
            <User size={13} color="#38BDF8" />
            <span>Valores por Entregador ({courierGroups.length}):</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
            {courierGroups.map((grp) => {
              const formattedDates = grp.dates
                .map((d) => d.split('-').reverse().slice(0, 2).join('/'))
                .join(', ');

              return (
                <div
                  key={grp.courierName}
                  style={{
                    backgroundColor: '#1E293B',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(56, 189, 248, 0.15)',
                      color: '#38BDF8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.9rem'
                    }}>
                      {grp.courierName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#F8FAFC' }}>
                        {grp.courierName}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '2px' }}>
                        {grp.items.length} {grp.items.length === 1 ? 'diária' : 'diárias'} ({formattedDates}) • {grp.totalDeliveries} entregas
                        {grp.retainedCash > 0 && (
                          <span style={{ color: '#FB7185', marginLeft: '6px', fontWeight: 600 }}>
                            (-{formatCurrency(grp.retainedCash)} retido)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {/* Pix key copy if available */}
                    {grp.courier?.pix_key ? (
                      <button
                        type="button"
                        onClick={() => handleCopyPix(grp.courier!.pix_key!, grp.courierName)}
                        className="btn btn-secondary btn-sm"
                        style={{
                          fontSize: '0.74rem',
                          padding: '4px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          borderColor: copiedPixCourierId === grp.courierName ? '#10B981' : 'rgba(255, 255, 255, 0.15)',
                          color: copiedPixCourierId === grp.courierName ? '#10B981' : '#F8FAFC',
                          backgroundColor: copiedPixCourierId === grp.courierName ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          fontWeight: 600
                        }}
                        title={`Chave Pix: ${grp.courier.pix_key}`}
                      >
                        {copiedPixCourierId === grp.courierName ? <CheckCheck size={13} color="#10B981" /> : <Copy size={13} />}
                        <span>{copiedPixCourierId === grp.courierName ? 'Copiado!' : 'Copiar Chave Pix'}</span>
                      </button>
                    ) : (
                      <span style={{
                        fontSize: '0.72rem',
                        color: '#94A3B8',
                        backgroundColor: 'rgba(148, 163, 184, 0.1)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontWeight: 600
                      }}>
                        Sem chave Pix
                      </span>
                    )}

                    <div style={{ textAlign: 'right', minWidth: '100px' }}>
                      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: grp.totalToPay >= 0 ? '#34D399' : '#FB7185' }}>
                        {formatCurrency(Math.max(0, grp.totalToPay))}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600 }}>líquido a transferir</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleConfirmBatchPayment}>
          <div style={{
            backgroundColor: '#1E293B',
            borderRadius: '14px',
            padding: '16px 18px',
            marginBottom: '20px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                  Forma de Pagamento
                </label>
                <select
                  className="form-control"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: '#0F172A',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#F8FAFC',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    width: '100%',
                    outline: 'none'
                  }}
                >
                  <option value="Pix">Pix</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Transferência Bancária">Transferência Bancária</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                  Data do Pagamento
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: '#0F172A',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#F8FAFC',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    width: '100%',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                Observações (Opcional)
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Ex: Acerto semanal consolidado das diárias de motoboy"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
                style={{
                  backgroundColor: '#0F172A',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  color: '#F8FAFC',
                  fontSize: '0.85rem',
                  width: '100%',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {progressText && (
            <div style={{
              fontSize: '0.82rem',
              color: '#38BDF8',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              marginBottom: '16px',
              textAlign: 'center',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <span className="spinner" style={{ width: '14px', height: '14px' }}></span>
              <span>{progressText}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '11px 20px',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: '10px'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || itemsToProcess.length === 0}
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.9rem',
                padding: '12px 24px',
                borderRadius: '10px',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: (isSubmitting || itemsToProcess.length === 0) ? 'not-allowed' : 'pointer',
                opacity: (isSubmitting || itemsToProcess.length === 0) ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
            >
              <CheckCircle2 size={18} />
              <span>
                {isSubmitting
                  ? 'Concluindo pagamentos...'
                  : `Confirmar Pagamento (${formatCurrency(summary.totalToPay)})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
