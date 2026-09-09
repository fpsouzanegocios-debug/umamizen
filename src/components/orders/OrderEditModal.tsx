import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Calculator, AlertCircle, Check, Tag, Truck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Order, NeighborhoodRate, Courier, SystemSettings, ChannelType } from '../../types';
import { calculateOrderFinances, calculateDeliveryRates } from '../../lib/calculations';
import { formatCurrency, formatPercent } from '../../lib/formatters';

interface OrderEditModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onSuccess: () => void;
  settings: SystemSettings;
  neighborhoodRates: NeighborhoodRate[];
  couriers: Courier[];
}

export const OrderEditModal: React.FC<OrderEditModalProps> = ({
  isOpen,
  order,
  onClose,
  onSuccess,
  settings,
  neighborhoodRates,
  couriers
}) => {
  if (!isOpen || !order) return null;

  // Form states
  const [channel, setChannel] = useState<ChannelType>(order.channel);
  const [grossAmount, setGrossAmount] = useState<number>(order.gross_amount);
  const [finalPayment, setFinalPayment] = useState<string>(order.final_payment_method || order.original_payment_method || '');
  const [neighborhoodName, setNeighborhoodName] = useState<string>(order.neighborhood_name || '');
  const [courierName, setCourierName] = useState<string>(order.courier_name || '');
  const [status, setStatus] = useState<string>(order.status || 'Concluído');
  const [notes, setNotes] = useState<string>(order.notes || '');

  // Cardápio Digital / Delivery fee & Coupon controls
  const [deliveryFee, setDeliveryFee] = useState<number>(order.delivery_fee ?? 0);
  const [neighborhoodFee, setNeighborhoodFee] = useState<number>(
    order.neighborhood_fee !== undefined 
      ? order.neighborhood_fee 
      : (order.is_free_delivery ? Number(order.delivery_fee || 0) : 0)
  );
  const [isFreeDelivery, setIsFreeDelivery] = useState<boolean>(
    order.is_free_delivery !== undefined 
      ? order.is_free_delivery 
      : (order.channel === 'Cardápio Digital' && (Number(order.delivery_fee || 0) === 0 || Number(order.gross_amount || 0) >= 49.90))
  );
  const [freeDeliveryCost, setFreeDeliveryCost] = useState<number>(
    order.free_delivery_cost !== undefined 
      ? order.free_delivery_cost 
      : (order.is_free_delivery || (order.channel === 'Cardápio Digital' && (Number(order.delivery_fee || 0) === 0 || Number(order.gross_amount || 0) >= 49.90))
          ? (Number(settings?.site_free_shipping_cost) || 8.00) 
          : 0)
  );
  const [couponAmount, setCouponAmount] = useState<number>(order.coupon_amount ?? 0);
  const [couponName, setCouponName] = useState<string>(order.coupon_name ?? '');
  const [couponAlreadyDiscounted, setCouponAlreadyDiscounted] = useState<boolean>(
    order.coupon_already_discounted !== undefined ? order.coupon_already_discounted : true
  );

  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Sync state when order changes
  useEffect(() => {
    if (order) {
      setChannel(order.channel);
      setGrossAmount(order.gross_amount);
      setFinalPayment(order.final_payment_method || order.original_payment_method || '');
      setNeighborhoodName(order.neighborhood_name || '');
      setCourierName(order.courier_name || '');
      setStatus(order.status || 'Concluído');
      setNotes(order.notes || '');
      setDeliveryFee(order.delivery_fee ?? 0);

      const fee = Number(order.delivery_fee ?? 0);
      const gross = Number(order.gross_amount ?? 0);
      const isFree = order.is_free_delivery !== undefined
        ? order.is_free_delivery
        : (order.channel === 'Cardápio Digital' && (fee === 0 || gross >= 49.90));
      setIsFreeDelivery(isFree);

      const cost = order.free_delivery_cost !== undefined
        ? order.free_delivery_cost
        : (isFree ? (Number(settings?.site_free_shipping_cost) || 8.00) : 0);
      setFreeDeliveryCost(cost);

      const nFee = order.neighborhood_fee !== undefined
        ? order.neighborhood_fee
        : (isFree ? fee : (fee > 7.99 ? fee - 7.99 : 0));
      setNeighborhoodFee(nFee);

      setCouponAmount(order.coupon_amount ?? 0);
      setCouponName(order.coupon_name ?? '');
      setCouponAlreadyDiscounted(
        order.coupon_already_discounted !== undefined ? order.coupon_already_discounted : true
      );
    }
  }, [order, settings]);

  // Handle Delivery Fee change with automatic Cardápio Digital rule
  const handleDeliveryFeeChange = (newFee: number) => {
    setDeliveryFee(newFee);
    if (channel === 'Cardápio Digital') {
      if (newFee === 0 || grossAmount >= 49.90) {
        setIsFreeDelivery(true);
        setFreeDeliveryCost(Number(settings?.site_free_shipping_cost) || 8.00);
        setNeighborhoodFee(newFee);
      } else {
        setIsFreeDelivery(false);
        setFreeDeliveryCost(0);
        setNeighborhoodFee(newFee > 7.99 ? newFee - 7.99 : 0);
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

  const handleRestoreImported = async () => {
    if (!confirm('Deseja realmente restaurar os dados originais importados deste pedido? Todas as edições manuais serão desfeitas.')) {
      return;
    }

    setIsSaving(true);
    try {
      const orig = order.original_imported_data;
      if (!orig) {
        alert('Não há dados brutos originais registrados para este pedido.');
        setIsSaving(false);
        return;
      }

      // Re-calculate original finances
      const origChannel = order.channel;
      const origGross = order.original_gross_amount || order.gross_amount;
      const origPay = order.original_payment_method || '';
      const origDeliveryFee = Number(orig['Taxa de entrega'] || 0);
      const origCoupon = Number(orig['Desconto'] || orig['Cupom'] || 0);
      const origIsFreeDelivery = origChannel === 'Cardápio Digital' && (origDeliveryFee === 0 || origGross >= 49.90);
      const origFreeDeliveryCost = origIsFreeDelivery ? (Number(settings?.site_free_shipping_cost) || 8.00) : 0;

      const resetFinances = calculateOrderFinances({
        channel: origChannel,
        grossAmount: origGross,
        paymentMethod: origPay,
        deliveryFee: origDeliveryFee,
        isFreeDelivery: origIsFreeDelivery,
        freeDeliveryCost: origFreeDeliveryCost,
        couponAmount: origCoupon,
        couponAlreadyDiscounted: true,
        settings
      });

      const { error } = await supabase
        .from('orders')
        .update({
          channel: origChannel,
          gross_amount: origGross,
          final_payment_method: origPay,
          status: orig['Status'] || 'Concluído',
          is_canceled: String(orig['Status'] || '').toLowerCase().includes('cancelad'),
          platform_fee_pct: resetFinances.platformFeePct,
          platform_fee_amount: resetFinances.platformFeeAmount,
          card_fee_pct: resetFinances.cardFeePct,
          card_fee_amount: resetFinances.cardFeeAmount,
          delivery_fee: origDeliveryFee,
          neighborhood_fee: resetFinances.neighborhoodFee,
          normal_delivery_fee: resetFinances.normalDeliveryFee,
          is_free_delivery: resetFinances.isFreeDelivery,
          free_delivery_cost: resetFinances.freeDeliveryCost,
          coupon_amount: resetFinances.couponAmount,
          coupon_name: null,
          adjustment_type: resetFinances.adjustmentType,
          adjustment_amount: resetFinances.adjustmentAmount,
          net_amount: resetFinances.netAmount,
          is_manually_edited: false,
          manual_edit_at: null,
          manual_edit_user: null,
          notes: ''
        })
        .eq('id', order.id);

      if (error) throw error;

      // Add audit history
      await supabase.from('order_change_history').insert({
        order_id: order.id,
        field_name: 'RESTAURAR_ORIGINAL',
        old_value: 'Dados manuais anteriores',
        new_value: 'Restaurado para importação original',
        changed_by: 'Administrador'
      });

      alert('Dados originais restaurados com sucesso!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao restaurar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const isCanceled = status.toLowerCase().includes('cancelad');

      // Track changes for audit history
      const changes: Array<{ field_name: string; old_value: string; new_value: string }> = [];

      if (channel !== order.channel) {
        changes.push({ field_name: 'channel', old_value: order.channel, new_value: channel });
      }
      if (grossAmount !== order.gross_amount) {
        changes.push({ field_name: 'gross_amount', old_value: String(order.gross_amount), new_value: String(grossAmount) });
      }
      if (finalPayment !== order.final_payment_method) {
        changes.push({ field_name: 'payment_method', old_value: order.final_payment_method || order.original_payment_method, new_value: finalPayment });
      }
      if (deliveryFee !== (order.delivery_fee ?? 0)) {
        changes.push({ field_name: 'taxa_entrega', old_value: `R$ ${order.delivery_fee ?? 0}`, new_value: `R$ ${deliveryFee}` });
      }
      if (isFreeDelivery !== (order.is_free_delivery ?? false)) {
        changes.push({ field_name: 'entrega_gratis', old_value: order.is_free_delivery ? 'Sim' : 'Não', new_value: isFreeDelivery ? 'Sim' : 'Não' });
      }
      if (freeDeliveryCost !== (order.free_delivery_cost ?? 0)) {
        changes.push({ field_name: 'custo_entrega_gratis', old_value: `R$ ${order.free_delivery_cost ?? 0}`, new_value: `R$ ${freeDeliveryCost}` });
      }
      if (couponAmount !== (order.coupon_amount ?? 0)) {
        changes.push({ field_name: 'cupom_desconto', old_value: `R$ ${order.coupon_amount ?? 0}`, new_value: `R$ ${couponAmount}` });
      }
      if (couponName !== (order.coupon_name ?? '')) {
        changes.push({ field_name: 'nome_cupom', old_value: order.coupon_name || '', new_value: couponName });
      }
      if (neighborhoodName !== order.neighborhood_name) {
        changes.push({ field_name: 'neighborhood_name', old_value: order.neighborhood_name || '', new_value: neighborhoodName });
      }
      if (courierName !== order.courier_name) {
        changes.push({ field_name: 'courier_name', old_value: order.courier_name || '', new_value: courierName });
      }
      if (status !== order.status) {
        changes.push({ field_name: 'status', old_value: order.status, new_value: status });
      }

      // Find neighborhood rate ID if matched
      const matchedRate = neighborhoodRates.find(
        (r) => r.name.toLowerCase() === neighborhoodName.toLowerCase()
      );

      // Find courier ID
      const matchedCourier = couriers.find(
        (c) => c.name.toLowerCase() === courierName.toLowerCase()
      );

      // Update Order in Supabase
      const { error } = await supabase
        .from('orders')
        .update({
          channel,
          gross_amount: Number(grossAmount) || 0,
          final_payment_method: finalPayment,
          status,
          is_canceled: isCanceled,
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
          coupon_name: couponName || null,
          adjustment_type: liveFinances.adjustmentType,
          adjustment_amount: liveFinances.adjustmentAmount,
          net_amount: liveFinances.netAmount,
          neighborhood_id: matchedRate ? matchedRate.id : null,
          neighborhood_name: neighborhoodName,
          courier_id: matchedCourier ? matchedCourier.id : null,
          courier_name: courierName,
          has_pending_issue: !courierName,
          pending_issue_reason: !courierName ? 'Venda sem entrega correspondente' : null,
          is_manually_edited: true,
          manual_edit_at: new Date().toISOString(),
          manual_edit_user: 'Administrador',
          notes
        })
        .eq('id', order.id);

      if (error) throw error;

      // Sincronizar com a tabela de entregas (deliveries)
      const cleanCourier = courierName.trim();
      if (cleanCourier && !isCanceled) {
        const delRates = calculateDeliveryRates(
          matchedRate ? matchedRate.total_rate : (Number(deliveryFee) || 8.00),
          settings?.courier_base_rate || 8.00
        );

        const { data: existingDelivs } = await supabase
          .from('deliveries')
          .select('id')
          .or(`order_id.eq.${order.id},order_number.eq.${order.order_number}`);

        if (existingDelivs && existingDelivs.length > 0) {
          await supabase.from('deliveries').update({
            courier_id: matchedCourier ? matchedCourier.id : null,
            courier_name: cleanCourier,
            neighborhood_name: neighborhoodName.trim() || null,
            neighborhood_rate_id: matchedRate ? matchedRate.id : null,
            neighborhood_total_rate: matchedRate ? matchedRate.total_rate : delRates.courierFee,
            base_rate: delRates.baseRate,
            additional_rate: delRates.additionalRate,
            courier_fee: delRates.courierFee,
            order_amount: Number(grossAmount) || 0,
            payment_method: finalPayment,
            has_pending_issue: false,
            pending_issue_reason: null,
            is_manually_edited: true
          }).eq('id', existingDelivs[0].id);
        } else {
          await supabase.from('deliveries').insert({
            id: crypto.randomUUID(),
            external_order_id: order.external_order_id || null,
            order_number: String(order.order_number).trim(),
            order_id: order.id,
            courier_id: matchedCourier ? matchedCourier.id : null,
            courier_name: cleanCourier,
            delivery_date: order.order_date,
            order_amount: Number(grossAmount) || 0,
            payment_method: finalPayment,
            neighborhood_name: neighborhoodName.trim() || null,
            neighborhood_rate_id: matchedRate ? matchedRate.id : null,
            neighborhood_total_rate: matchedRate ? matchedRate.total_rate : delRates.courierFee,
            base_rate: delRates.baseRate,
            additional_rate: delRates.additionalRate,
            courier_fee: delRates.courierFee,
            status: 'Concluído',
            has_pending_issue: false,
            pending_issue_reason: null,
            is_manually_edited: true,
            notes: 'Vinculado via edição de pedido'
          });
        }
      } else if (!cleanCourier || isCanceled) {
        await supabase
          .from('deliveries')
          .delete()
          .or(`order_id.eq.${order.id},order_number.eq.${order.order_number}`);
      }

      // Insert audit history records
      if (changes.length > 0) {
        const historyRecords = changes.map((c) => ({
          order_id: order.id,
          field_name: c.field_name,
          old_value: c.old_value,
          new_value: c.new_value,
          changed_by: 'Administrador'
        }));
        await supabase.from('order_change_history').insert(historyRecords);
      }

      alert('Pedido atualizado com sucesso!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar edição: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '760px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: '#F8FAFC' }}>
              Editar Pedido #{order.order_number}
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Id Externo: {order.external_order_id} | Cliente: {order.customer_name || 'Não informado'}
            </span>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {order.is_manually_edited && (
          <div style={{
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            padding: '10px 14px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#FBBF24' }}>
              <AlertCircle size={16} />
              <span>Este pedido foi editado manualmente em {order.manual_edit_at ? new Date(order.manual_edit_at).toLocaleDateString('pt-BR') : ''}.</span>
            </div>
            <button
              type="button"
              onClick={handleRestoreImported}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
            >
              <RotateCcw size={13} />
              Restaurar Original
            </button>
          </div>
        )}

        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Canal / Plataforma</label>
              <select
                className="select"
                value={channel}
                onChange={(e) => {
                  const newChan = e.target.value as ChannelType;
                  setChannel(newChan);
                  if (newChan === 'Cardápio Digital') {
                    if (deliveryFee === 0) {
                      setIsFreeDelivery(true);
                      setFreeDeliveryCost(8.00);
                    }
                  } else {
                    setIsFreeDelivery(false);
                    setFreeDeliveryCost(0);
                  }
                }}
              >
                <option value="iFood">iFood (15% taxa)</option>
                <option value="AiqFome">AiqFome (15% taxa)</option>
                <option value="Cardápio Digital">Cardápio Digital / Site</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Valor do Pedido (Bruto R$)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={grossAmount}
                onChange={(e) => setGrossAmount(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Forma de Pagamento</label>
              <select
                className="select"
                value={finalPayment}
                onChange={(e) => setFinalPayment(e.target.value)}
              >
                <option value="Pix">Pix (0% maquininha)</option>
                <option value="Pix automático">Pix automático (0% maquininha)</option>
                <option value="Dinheiro">Dinheiro (0% maquininha)</option>
                <option value="Cartão de débito">Cartão de débito ({settings.card_debit_fee_pct}%)</option>
                <option value="Cartão de crédito">Cartão de crédito ({settings.card_credit_fee_pct}%)</option>
                <option value="iFood">iFood Online (0% maquininha)</option>
                <option value="AiqFome">AiqFome Online (0% maquininha)</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Status do Pedido</label>
              <select
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="Concluído">Concluído (entra no faturamento)</option>
                <option value="Cancelado">Cancelado (NÃO entra no faturamento)</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Bairro</label>
              <input
                type="text"
                list="bairros-list"
                className="input"
                value={neighborhoodName}
                onChange={(e) => setNeighborhoodName(e.target.value)}
              />
              <datalist id="bairros-list">
                {neighborhoodRates.map((r) => (
                  <option key={r.id} value={r.name} />
                ))}
              </datalist>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Entregador</label>
              <input
                type="text"
                list="couriers-list"
                className="input"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
              />
              <datalist id="couriers-list">
                {couriers.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
          </div>

          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            padding: '16px',
            borderRadius: '10px',
            marginBottom: '18px',
            border: '1px solid #334155'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: '#38BDF8', fontWeight: 600, fontSize: '0.9rem' }}>
              <Truck size={16} />
              <span>Controle de Entrega & Cupons Promocionais</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Taxa de Entrega mostrada no relatório (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={deliveryFee}
                  onChange={(e) => handleDeliveryFeeChange(parseFloat(e.target.value) || 0)}
                />
                <span style={{ fontSize: '0.72rem', color: isFreeDelivery ? '#34D399' : '#FBBF24', display: 'block', marginTop: '3px' }}>
                  {channel === 'Cardápio Digital' && (
                    isFreeDelivery 
                      ? (deliveryFee > 0 
                          ? `✓ Entrega Grátis (-R$ 8,00). R$ ${deliveryFee.toFixed(2)} registrado como Adicional de Bairro cobrado.` 
                          : '✓ Entrega Grátis (-R$ 8,00) com taxa zero.')
                      : `✓ Taxa Normal (R$ ${deliveryFee.toFixed(2)}) cobrada do cliente (sem desconto de R$ 8,00).`
                  )}
                </span>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Houve Entrega Grátis?</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleFreeDelivery(true)}
                    className={`btn btn-sm ${isFreeDelivery ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                  >
                    SIM (Grátis)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleFreeDelivery(false)}
                    className={`btn btn-sm ${!isFreeDelivery ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                  >
                    NÃO
                  </button>
                </div>
                {isFreeDelivery && (
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Custo da Entrega Grátis (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={freeDeliveryCost}
                      onChange={(e) => setFreeDeliveryCost(parseFloat(e.target.value) || 0)}
                      style={{ height: '32px', fontSize: '0.85rem' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bairro Additional Fee vs Normal Fee Breakdown */}
            {channel === 'Cardápio Digital' && deliveryFee > 0 && (
              <div style={{
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                padding: '10px 12px',
                borderRadius: '8px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#38BDF8', display: 'block' }}>
                    {isFreeDelivery ? 'Taxa / Adicional do Bairro (Registrada Separadamente):' : 'Detalhamento da Cobrança de Entrega:'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {isFreeDelivery 
                      ? `Pedido com entrega grátis: o valor de ${formatCurrency(deliveryFee)} é referente ao adicional do bairro.`
                      : `Pedido sem entrega grátis: taxa normal de entrega cobrada do cliente.`}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: '#F1F5F9', fontWeight: 700 }}>
                    {isFreeDelivery ? `Bairro: ${formatCurrency(neighborhoodFee || deliveryFee)}` : `Normal: ${formatCurrency(liveFinances.normalDeliveryFee)}`}
                  </span>
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid #1E293B', paddingTop: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '8px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Tag size={13} color="#C084FC" />
                    <span>Valor do Cupom de Desconto (R$)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={couponAmount}
                    onChange={(e) => setCouponAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Nome / Código do Cupom</label>
                  <input
                    type="text"
                    className="input"
                    value={couponName}
                    onChange={(e) => setCouponName(e.target.value)}
                  />
                </div>
              </div>

              {couponAmount > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: '#94A3B8', marginTop: '6px' }}>
                  <input
                    type="checkbox"
                    checked={couponAlreadyDiscounted}
                    onChange={(e) => setCouponAlreadyDiscounted(e.target.checked)}
                    style={{ accentColor: '#3B82F6' }}
                  />
                  <span>O valor do pedido ({formatCurrency(grossAmount)}) já está com o cupom descontado.</span>
                </label>
              )}
            </div>
          </div>

          <div style={{
            backgroundColor: '#0E1524',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '10px',
            padding: '14px',
            marginBottom: '18px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#38BDF8', fontWeight: 600, fontSize: '0.85rem' }}>
              <Calculator size={16} />
              <span>Cálculo Financeiro do Pedido em Tempo Real</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Valor Bruto</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#F8FAFC' }}>
                  {formatCurrency(grossAmount)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Plataforma</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FB7185' }}>
                  {liveFinances.platformFeeAmount > 0 ? `-${formatCurrency(liveFinances.platformFeeAmount)}` : 'R$ 0,00'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Maquininha</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FBBF24' }}>
                  {liveFinances.cardFeeAmount > 0 ? `-${formatCurrency(liveFinances.cardFeeAmount)}` : 'R$ 0,00'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ajustes / Promo</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38BDF8' }}>
                  {liveFinances.adjustmentAmount > 0 ? `-${formatCurrency(liveFinances.adjustmentAmount)}` : 'R$ 0,00'}
                </div>
                {liveFinances.isFreeDelivery && (
                  <div style={{ fontSize: '0.68rem', color: '#38BDF8' }}>
                    Entrega Grátis: -{formatCurrency(liveFinances.freeDeliveryCost)}
                  </div>
                )}
                {liveFinances.couponAmount > 0 && (
                  <div style={{ fontSize: '0.68rem', color: '#C084FC' }}>
                    Cupom: {formatCurrency(liveFinances.couponAmount)}
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: 'rgba(52, 211, 153, 0.1)', borderRadius: '6px', padding: '4px' }}>
                <div style={{ fontSize: '0.7rem', color: '#34D399', fontWeight: 600 }}>Valor Líquido</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#34D399' }}>
                  {formatCurrency(liveFinances.netAmount)}
                </div>
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '18px' }}>
            <label className="form-label">Observações da Edição Manual</label>
            <input
              type="text"
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Motivo da alteração..."
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
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
              <Save size={16} />
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
