import React, { useState, useMemo } from 'react';
import { X, Check, DollarSign, Calendar, Copy, CheckCheck, AlertCircle, CheckCircle2, User, Layers } from 'lucide-react';
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
      retainedCashTotal,
      totalToPay: Math.max(0, totalToPay)
    };
  }, [itemsToProcess]);

  // Group by Courier for individual summary cards & Pix keys
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
          retained_cash: numRetained,
          total_paid: numPaid,
          paid_amount: numPaid,
          total_amount: effectiveTotalAmount,
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
          console.error('Erro ao registrar courier_daily_payments no lote:', payErr);
          throw payErr;
        }

        // Mark deliveries of this day as paid
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
            console.error('Erro ao atualizar status nas entregas no lote:', delivErr);
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
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '24px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10B981'
            }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F8FAFC', margin: 0 }}>
                Concluir Pagamento em Lote
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                {itemsToProcess.length} {itemsToProcess.length === 1 ? 'diária selecionada' : 'diárias selecionadas'} • Total: <strong style={{ color: '#10B981' }}>{formatCurrency(summary.totalToPay)}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Global Financial Metrics Cards */}
        <div style={{
          backgroundColor: 'var(--bg-input)',
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '18px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: summary.retainedCashTotal > 0 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
            gap: '10px'
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>DIÁRIAS</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F8FAFC', marginTop: '2px' }}>
                {itemsToProcess.length}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {summary.totalDeliveries} corridas
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL BRUTO</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F8FAFC', marginTop: '2px' }}>
                {formatCurrency(summary.grossTotal)}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Base + Adicionais
              </div>
            </div>

            {summary.retainedCashTotal > 0 && (
              <div>
                <div style={{ fontSize: '0.72rem', color: '#F43F5E', fontWeight: 600 }}>DINHEIRO RETIDO</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F43F5E', marginTop: '2px' }}>
                  -{formatCurrency(summary.retainedCashTotal)}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Abatido de Daniel
                </div>
              </div>
            )}

            <div style={{
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              borderRadius: '8px',
              padding: '6px 10px',
              border: '1px solid rgba(16, 185, 129, 0.35)'
            }}>
              <div style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700 }}>LÍQUIDO A PAGAR</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10B981', marginTop: '2px' }}>
                {formatCurrency(summary.totalToPay)}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#34D399' }}>
                Total a transferir
              </div>
            </div>
          </div>
        </div>

        {/* If some items were already paid, option to filter */}
        {paidItems.length > 0 && pendingItems.length > 0 && (
          <div style={{
            backgroundColor: 'rgba(251, 191, 36, 0.08)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#CBD5E1' }}>
              <AlertCircle size={16} color="#FBBF24" style={{ flexShrink: 0 }} />
              <span>
                Você selecionou <strong>{pendingItems.length} diária(s) pendente(s)</strong> e <strong>{paidItems.length} já paga(s)</strong>.
              </span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#F8FAFC', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={onlyPending}
                onChange={(e) => setOnlyPending(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Pagar apenas as pendentes ({pendingItems.length})</span>
            </label>
          </div>
        )}

        {/* Breakdown by Courier Card List */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={13} />
            <span>Valores por Entregador ({courierGroups.length}):</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {courierGroups.map((grp) => {
              const formattedDates = grp.dates
                .map((d) => d.split('-').reverse().slice(0, 2).join('/'))
                .join(', ');

              return (
                <div
                  key={grp.courierName}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#F8FAFC' }}>
                      {grp.courierName}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {grp.items.length} {grp.items.length === 1 ? 'diária' : 'diárias'} ({formattedDates}) • {grp.totalDeliveries} entregas
                      {grp.retainedCash > 0 && (
                        <span style={{ color: '#F43F5E', marginLeft: '6px' }}>
                          (-{formatCurrency(grp.retainedCash)} retido)
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Pix key copy if available */}
                    {grp.courier?.pix_key ? (
                      <button
                        type="button"
                        onClick={() => handleCopyPix(grp.courier!.pix_key!, grp.courierName)}
                        className="btn btn-secondary btn-sm"
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          borderColor: copiedPixCourierId === grp.courierName ? '#10B981' : undefined,
                          color: copiedPixCourierId === grp.courierName ? '#10B981' : undefined
                        }}
                        title={`Chave Pix: ${grp.courier.pix_key}`}
                      >
                        {copiedPixCourierId === grp.courierName ? <CheckCheck size={12} /> : <Copy size={12} />}
                        <span>{copiedPixCourierId === grp.courierName ? 'Copiado!' : 'Copiar Pix'}</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sem chave Pix</span>
                    )}

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: grp.totalToPay >= 0 ? '#10B981' : '#F43F5E' }}>
                        {formatCurrency(Math.max(0, grp.totalToPay))}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>líquido</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleConfirmBatchPayment}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                Forma de Pagamento
              </label>
              <select
                className="form-control"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={isSubmitting}
                style={{ fontSize: '0.85rem' }}
              >
                <option value="Pix">Pix</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Transferência Bancária">Transferência Bancária</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                Data do Pagamento
              </label>
              <input
                type="date"
                className="form-control"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                disabled={isSubmitting}
                style={{ fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              Observações (Opcional)
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex: Pagamento semanal consolidado via Pix"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              style={{ fontSize: '0.85rem' }}
            />
          </div>

          {progressText && (
            <div style={{
              fontSize: '0.8rem',
              color: '#38BDF8',
              marginBottom: '14px',
              textAlign: 'center',
              fontWeight: 600
            }}>
              {progressText}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || itemsToProcess.length === 0}
              style={{
                backgroundColor: '#10B981',
                borderColor: '#10B981',
                color: '#0B0F19',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px'
              }}
            >
              <CheckCircle2 size={18} />
              <span>
                {isSubmitting
                  ? 'Concluindo pagamentos...'
                  : `Confirmar e Marcar ${itemsToProcess.length} ${itemsToProcess.length === 1 ? 'Diária como Paga' : 'Diárias como Pagas'}`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
