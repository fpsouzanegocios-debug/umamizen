import React, { useState, useEffect } from 'react';
import { X, PlusCircle, Calculator, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Order, NeighborhoodRate, Courier, SystemSettings, ChannelType } from '../../types';
import { calculateOrderFinances, calculateDeliveryRates } from '../../lib/calculations';
import { formatCurrency } from '../../lib/formatters';

interface OrderCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orders: Order[];
  settings: SystemSettings;
  neighborhoodRates: NeighborhoodRate[];
  couriers: Courier[];
}

export const OrderCreateModal: React.FC<OrderCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  orders,
  settings,
  neighborhoodRates,
  couriers
}) => {
  if (!isOpen) return null;

  // Compute next order number automatically
  const getNextOrderNumber = () => {
    const nums = orders
      .map((o) => parseInt(o.order_number, 10))
      .filter((n) => !isNaN(n) && n > 0);
    const maxNum = nums.length > 0 ? Math.max(...nums) : 2396;
    return String(maxNum + 1);
  };

  const getTodayDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getCurrentTime = () => {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  };

  const getNewExternalId = () => {
    return `MAN-${Date.now().toString().slice(-6)}`;
  };

  // Form State
  const [orderNumber, setOrderNumber] = useState<string>(getNextOrderNumber());
  const [externalOrderId, setExternalOrderId] = useState<string>(getNewExternalId());
  const [orderDate, setOrderDate] = useState<string>(getTodayDate());
  const [orderTime, setOrderTime] = useState<string>(getCurrentTime());
  const [channel, setChannel] = useState<ChannelType>('Balcão / WhatsApp');
  const [status, setStatus] = useState<string>('Concluído');

  // Customer info
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  // Financial values
  const [grossAmount, setGrossAmount] = useState<number | ''>('');
  const [finalPayment, setFinalPayment] = useState<string>('Pix');

  // Delivery & Logistics
  const [neighborhoodName, setNeighborhoodName] = useState<string>('');
  const [courierName, setCourierName] = useState<string>('');
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [isFreeDelivery, setIsFreeDelivery] = useState<boolean>(false);
  const [freeDeliveryCost, setFreeDeliveryCost] = useState<number>(0);
  const [neighborhoodFee, setNeighborhoodFee] = useState<number>(0);

  // Coupon / Discount
  const [couponName, setCouponName] = useState<string>('');
  const [couponAmount, setCouponAmount] = useState<number>(0);
  const [couponAlreadyDiscounted, setCouponAlreadyDiscounted] = useState<boolean>(true);

  // Notes
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-adjust free delivery when channel or gross amount or delivery fee changes
  useEffect(() => {
    const numGross = Number(grossAmount) || 0;
    if (channel === 'Cardápio Digital') {
      if (deliveryFee === 0 || numGross >= 49.90) {
        setIsFreeDelivery(true);
        setFreeDeliveryCost(Number(settings?.site_free_shipping_cost) || 8.00);
        setNeighborhoodFee(deliveryFee);
      } else {
        setIsFreeDelivery(false);
        setFreeDeliveryCost(0);
        setNeighborhoodFee(deliveryFee > 7.99 ? deliveryFee - 7.99 : 0);
      }
    }
  }, [channel, grossAmount, deliveryFee, settings]);

  // When neighborhood changes, auto-suggest delivery fee if available
  const handleNeighborhoodChange = (name: string) => {
    setNeighborhoodName(name);
    const matched = neighborhoodRates.find((r) => r.name.toLowerCase() === name.trim().toLowerCase());
    if (matched && deliveryFee === 0) {
      if (channel === 'Cardápio Digital') {
        const numGross = Number(grossAmount) || 0;
        if (numGross >= 49.90) {
          // Additional neighborhood rate
          setDeliveryFee(matched.additional_rate || 0);
        } else {
          setDeliveryFee(matched.total_rate || 7.99);
        }
      } else {
        setDeliveryFee(matched.total_rate || 8.00);
      }
    }
  };

  // Toggle Free Delivery manually
  const handleToggleFreeDelivery = (free: boolean) => {
    setIsFreeDelivery(free);
    if (free) {
      setFreeDeliveryCost(Number(settings?.site_free_shipping_cost) || 8.00);
      setNeighborhoodFee(deliveryFee);
    } else {
      setFreeDeliveryCost(0);
      setNeighborhoodFee(deliveryFee > 7.99 ? deliveryFee - 7.99 : 0);
    }
  };

  // Live recalculated finances
  const liveFinances = calculateOrderFinances({
    channel,
    grossAmount: Number(grossAmount) || 0,
    paymentMethod: finalPayment,
    deliveryFee: Number(deliveryFee) || 0,
    neighborhoodFee: Number(neighborhoodFee) || 0,
    isFreeDelivery,
    freeDeliveryCost: Number(freeDeliveryCost) || 0,
    couponAmount: Number(couponAmount) || 0,
    couponName,
    couponAlreadyDiscounted,
    settings
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const numGross = Number(grossAmount);
    if (isNaN(numGross) || numGross <= 0) {
      setErrorMessage('Por favor, informe um valor bruto válido maior que zero.');
      return;
    }

    if (!orderNumber.trim()) {
      setErrorMessage('Por favor, informe o número do pedido.');
      return;
    }

    if (!externalOrderId.trim()) {
      setErrorMessage('Por favor, informe o ID de referência do pedido.');
      return;
    }

    setIsSaving(true);
    try {
      const [y, m, d] = orderDate.split('-').map(Number);
      const [h, min] = (orderTime || '12:00').split(':').map(Number);
      const fullDateTime = new Date(y, m - 1, d, h || 0, min || 0, 0).toISOString();
      const isCanceled = status.toLowerCase().includes('cancelad');

      // Check if external_order_id already exists
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('external_order_id', externalOrderId.trim())
        .maybeSingle();

      if (existingOrder) {
        throw new Error(`Já existe um pedido com o ID de referência "${externalOrderId.trim()}". Por favor altere o ID.`);
      }

      // Match neighborhood rate
      const matchedRate = neighborhoodRates.find(
        (r) => r.name.toLowerCase() === neighborhoodName.trim().toLowerCase()
      );

      // Match courier
      const matchedCourier = couriers.find(
        (c) => c.name.toLowerCase() === courierName.trim().toLowerCase()
      );

      const newOrderId = crypto.randomUUID();

      // 1. Insert into orders table
      const { error: insertOrderError } = await supabase
        .from('orders')
        .insert({
          id: newOrderId,
          order_number: orderNumber.trim(),
          external_order_id: externalOrderId.trim(),
          customer_name: customerName.trim() || 'Cliente Balcão',
          customer_phone: customerPhone.trim() || null,
          order_date: fullDateTime,
          channel,
          original_payment_method: finalPayment,
          final_payment_method: finalPayment,
          status,
          is_canceled: isCanceled,
          gross_amount: numGross,
          original_gross_amount: numGross,
          platform_fee_pct: liveFinances.platformFeePct,
          platform_fee_amount: liveFinances.platformFeeAmount,
          card_fee_pct: liveFinances.cardFeePct,
          card_fee_amount: liveFinances.cardFeeAmount,
          delivery_fee: Number(deliveryFee) || 0,
          neighborhood_fee: liveFinances.neighborhoodFee,
          normal_delivery_fee: liveFinances.normalDeliveryFee,
          is_free_delivery: liveFinances.isFreeDelivery,
          free_delivery_cost: liveFinances.freeDeliveryCost,
          coupon_amount: liveFinances.couponAmount,
          coupon_name: couponName.trim() || null,
          adjustment_type: liveFinances.adjustmentType,
          adjustment_amount: liveFinances.adjustmentAmount,
          net_amount: liveFinances.netAmount,
          neighborhood_id: matchedRate ? matchedRate.id : null,
          neighborhood_name: neighborhoodName.trim() || null,
          courier_id: matchedCourier ? matchedCourier.id : null,
          courier_name: courierName.trim() || null,
          has_pending_issue: false,
          is_manually_edited: true,
          manual_edit_at: new Date().toISOString(),
          manual_edit_user: 'Administrador',
          notes: notes.trim() || 'Lançado manualmente'
        });

      if (insertOrderError) throw insertOrderError;

      // 2. Insert into order_change_history
      await supabase.from('order_change_history').insert({
        order_id: newOrderId,
        field_name: 'CRIACAO_MANUAL',
        old_value: null,
        new_value: `Pedido #${orderNumber.trim()} adicionado manualmente (${channel}, R$ ${numGross.toFixed(2)})`,
        changed_by: 'Administrador'
      });

      // 3. If courier is assigned and order not canceled, insert delivery
      if (courierName.trim() && !isCanceled) {
        const delRates = calculateDeliveryRates(
          matchedRate ? matchedRate.total_rate : (Number(deliveryFee) || 8.00),
          settings?.courier_base_rate || 8.00
        );

        await supabase.from('deliveries').upsert({
          id: crypto.randomUUID(),
          external_order_id: externalOrderId.trim(),
          order_number: orderNumber.trim(),
          order_id: newOrderId,
          courier_id: matchedCourier ? matchedCourier.id : null,
          courier_name: courierName.trim(),
          delivery_date: fullDateTime,
          order_amount: numGross,
          payment_method: finalPayment,
          neighborhood_name: neighborhoodName.trim() || null,
          neighborhood_rate_id: matchedRate ? matchedRate.id : null,
          neighborhood_total_rate: matchedRate ? matchedRate.total_rate : (delRates.baseRate + delRates.additionalRate),
          base_rate: delRates.baseRate,
          additional_rate: delRates.additionalRate,
          courier_fee: delRates.courierFee,
          status: 'Concluído',
          is_manually_edited: true,
          notes: notes.trim() || 'Lançado manualmente'
        }, { onConflict: 'external_order_id,courier_name' });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Erro ao criar pedido manual');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '780px', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38BDF8'
            }}>
              <PlusCircle size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', color: '#F8FAFC', margin: 0 }}>Lançar Pedido Manualmente</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                Cadastre vendas feitas fora do sistema (balcão, WhatsApp, telefone ou cardápio manual)
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-secondary" 
            style={{ padding: '6px', borderRadius: '8px' }}
          >
            <X size={18} />
          </button>
        </div>

        {errorMessage && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#F87171',
            fontSize: '0.875rem',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Section 1: Identificação Básica */}
          <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94A3B8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              1. Identificação do Pedido
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              <div>
                <label className="label">Nº do Pedido *</label>
                <input
                  type="text"
                  required
                  className="input"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="ex: 2397"
                />
              </div>

              <div>
                <label className="label">ID de Referência *</label>
                <input
                  type="text"
                  required
                  className="input"
                  value={externalOrderId}
                  onChange={(e) => setExternalOrderId(e.target.value)}
                  placeholder="ex: MAN-1002"
                />
              </div>

              <div>
                <label className="label">Canal de Venda *</label>
                <select
                  className="select"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as ChannelType)}
                >
                  <option value="Balcão / WhatsApp">Balcão / WhatsApp</option>
                  <option value="Cardápio Digital">Cardápio Digital</option>
                  <option value="iFood">iFood</option>
                  <option value="AiqFome">AiqFome</option>
                </select>
              </div>

              <div>
                <label className="label">Status *</label>
                <select
                  className="select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="Concluído">Concluído</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="label">Data *</label>
                <input
                  type="date"
                  required
                  className="input"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Hora *</label>
                <input
                  type="time"
                  required
                  className="input"
                  value={orderTime}
                  onChange={(e) => setOrderTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Dados do Cliente */}
          <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94A3B8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              2. Dados do Cliente (Opcional)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div>
                <label className="label">Nome do Cliente</label>
                <input
                  type="text"
                  className="input"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="ex: João da Silva / Balcão"
                />
              </div>
              <div>
                <label className="label">Telefone / WhatsApp</label>
                <input
                  type="text"
                  className="input"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="ex: (11) 98765-4321"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Valores Financeiros e Pagamento */}
          <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94A3B8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              3. Financeiro & Forma de Pagamento
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <label className="label">Valor Bruto Total (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="input"
                  value={grossAmount}
                  onChange={(e) => setGrossAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                  style={{ fontSize: '1.1rem', fontWeight: 600, color: '#38BDF8' }}
                />
              </div>

              <div>
                <label className="label">Forma de Pagamento *</label>
                <select
                  className="select"
                  value={finalPayment}
                  onChange={(e) => setFinalPayment(e.target.value)}
                >
                  <option value="Pix">Pix (0% taxa)</option>
                  <option value="Dinheiro">Dinheiro (0% taxa)</option>
                  <option value="Pix automático">Pix Automático (0% taxa)</option>
                  <option value="Cartão de débito">Cartão de Débito ({settings.card_debit_fee_pct}%)</option>
                  <option value="Cartão de crédito">Cartão de Crédito ({settings.card_credit_fee_pct}%)</option>
                  {channel === 'iFood' && <option value="iFood">iFood Pagamento Online</option>}
                  {channel === 'AiqFome' && <option value="AiqFome">AiqFome Pagamento Online</option>}
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Logística, Bairro & Motoboy */}
          <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94A3B8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              4. Entrega, Bairro & Motoboy
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <label className="label">Bairro de Entrega</label>
                <input
                  type="text"
                  list="neighborhoods-create-list"
                  className="input"
                  value={neighborhoodName}
                  onChange={(e) => handleNeighborhoodChange(e.target.value)}
                  placeholder="Digite ou selecione o bairro..."
                />
                <datalist id="neighborhoods-create-list">
                  {neighborhoodRates.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} - R$ {r.total_rate.toFixed(2)} (Base R$ {r.base_rate.toFixed(2)} + Adic. R$ {r.additional_rate.toFixed(2)})
                    </option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className="label">Motoboy Vinculado</label>
                <select
                  className="select"
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                >
                  <option value="">Sem Motoboy (Retirada no Balcão)</option>
                  {couriers.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Taxa de Entrega cobrada do cliente (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Delivery rules (Cardápio Digital / Free Shipping) */}
            <div style={{ marginTop: '14px', padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={isFreeDelivery}
                    onChange={(e) => handleToggleFreeDelivery(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#38BDF8' }}
                  />
                  <span>Aplicar <strong>Entrega Grátis</strong> (Restaurante absorve R$ {freeDeliveryCost.toFixed(2)})</span>
                </label>

                {isFreeDelivery && (
                  <span style={{ fontSize: '0.75rem', color: '#38BDF8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                    Ajuste automático de -R$ {freeDeliveryCost.toFixed(2)}
                  </span>
                )}
              </div>

              {isFreeDelivery && deliveryFee > 0 && (
                <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#94A3B8' }}>
                  A taxa de R$ {deliveryFee.toFixed(2)} cobrada do cliente será registrada como <strong>Adicional do Bairro</strong>.
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Cupons / Descontos (Opcional) */}
          <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94A3B8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              5. Cupom de Desconto (Opcional)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <label className="label">Nome do Cupom</label>
                <input
                  type="text"
                  className="input"
                  value={couponName}
                  onChange={(e) => setCouponName(e.target.value)}
                  placeholder="ex: PRIMEIRACOMPRA"
                />
              </div>
              <div>
                <label className="label">Valor do Desconto (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={couponAmount}
                  onChange={(e) => setCouponAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Section 6: Observações */}
          <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94A3B8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              6. Observações
            </div>
            <textarea
              className="input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações internas sobre o pedido ou cliente..."
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          {/* Live Financial Recalculation Preview Card */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#38BDF8', fontWeight: 600 }}>
              <Calculator size={18} />
              <span>Prévia Financeira em Tempo Real</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Valor Bruto</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#F8FAFC' }}>
                  {formatCurrency(Number(grossAmount) || 0)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Taxa Plataforma</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#FB7185' }}>
                  -{formatCurrency(liveFinances.platformFeeAmount)} ({liveFinances.platformFeePct}%)
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Taxa Maquininha</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#FBBF24' }}>
                  -{formatCurrency(liveFinances.cardFeeAmount)} ({liveFinances.cardFeePct}%)
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Ajuste/Entrega</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#38BDF8' }}>
                  -{formatCurrency(liveFinances.adjustmentAmount)}
                </div>
              </div>

              <div style={{
                borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                paddingLeft: '12px'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#34D399', fontWeight: 600 }}>Faturamento Líquido</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#34D399' }}>
                  {formatCurrency(liveFinances.netAmount)}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Check size={18} />
              <span>{isSaving ? 'Salvando...' : 'Salvar Pedido'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
