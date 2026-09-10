import React, { useState, useEffect } from 'react';
import { X, Save, Bike, RotateCcw, AlertCircle, MapPin, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Courier, NeighborhoodRate, SystemSettings } from '../../types';
import { formatCurrency } from '../../lib/formatters';
import { calculateDeliveryRates } from '../../lib/calculations';
import { normalizeNeighborhoodName } from '../../lib/neighborhoodMatcher';

interface DeliveryCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  couriers: Courier[];
  neighborhoodRates: NeighborhoodRate[];
  settings: SystemSettings;
  defaultCourierName?: string;
  defaultDate?: string;
}

export const DeliveryCreateModal: React.FC<DeliveryCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  couriers,
  neighborhoodRates,
  settings,
  defaultCourierName,
  defaultDate
}) => {
  const [courierName, setCourierName] = useState<string>('');
  const [deliveryType, setDeliveryType] = useState<'return' | 'normal' | 'extra'>('return');
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [neighborhoodName, setNeighborhoodName] = useState<string>('');
  const [customCourierFee, setCustomCourierFee] = useState<number | string>(8.00);
  const [orderAmount, setOrderAmount] = useState<number | string>(0.00);
  const [paymentMethod, setPaymentMethod] = useState<string>('Sem cobrança (Retorno / Cortesia)');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      // Pick default courier
      if (defaultCourierName && defaultCourierName !== 'all') {
        setCourierName(defaultCourierName);
      } else if (couriers.length > 0) {
        setCourierName(couriers[0].name);
      } else {
        setCourierName('');
      }

      // Default date
      if (defaultDate) {
        setDeliveryDate(`${defaultDate}T${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })}`);
      } else {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        setDeliveryDate(`${year}-${month}-${day}T${hours}:${minutes}`);
      }

      setDeliveryType('return');
      setOrderNumber('RET-');
      setNeighborhoodName('');
      setCustomCourierFee(8.00);
      setOrderAmount(0.00);
      setPaymentMethod('Sem cobrança (Retorno / Cortesia)');
      setNotes('Retorno de entrega ao cliente (item esquecido / troca)');
    }
  }, [isOpen, defaultCourierName, defaultDate, couriers]);

  if (!isOpen) return null;

  // Watch type changes to suggest orderNumber and notes
  const handleTypeChange = (type: 'return' | 'normal' | 'extra') => {
    setDeliveryType(type);
    if (type === 'return') {
      if (!orderNumber || !orderNumber.startsWith('RET-')) setOrderNumber('RET-');
      setOrderAmount(0);
      setPaymentMethod('Sem cobrança (Retorno / Cortesia)');
      setNotes('Retorno de entrega ao cliente (item esquecido / troca)');
    } else if (type === 'extra') {
      if (orderNumber.startsWith('RET-')) setOrderNumber('EXTRA-01');
      setPaymentMethod('Dinheiro');
      setNotes('Viagem extra / corrida avulsa');
    } else {
      if (orderNumber.startsWith('RET-') || orderNumber.startsWith('EXTRA-')) setOrderNumber('');
      setPaymentMethod('Pix');
      setNotes('Entrega lançada manualmente');
    }
  };

  // Match neighborhood rate
  const normB = normalizeNeighborhoodName(neighborhoodName);
  const matchedRate = neighborhoodRates.find(
    (r) => normalizeNeighborhoodName(r.name) === normB || r.name.toUpperCase() === neighborhoodName.trim().toUpperCase()
  );

  const baseRate = Number(settings?.courier_base_rate) || 8.00;
  const officialRateTotal = matchedRate ? Number(matchedRate.total_rate) : baseRate;
  const calculatedRates = calculateDeliveryRates(officialRateTotal, baseRate);

  const handleNeighborhoodChange = (name: string) => {
    setNeighborhoodName(name);
    const n = normalizeNeighborhoodName(name);
    const match = neighborhoodRates.find(
      (r) => normalizeNeighborhoodName(r.name) === n || r.name.toUpperCase() === name.trim().toUpperCase()
    );
    if (match) {
      setCustomCourierFee(match.total_rate);
    }
  };

  const matchedCourier = couriers.find((c) => c.name.toLowerCase() === courierName.toLowerCase());

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courierName.trim()) {
      alert('Selecione o motoboy que realizou a entrega.');
      return;
    }
    if (!neighborhoodName.trim()) {
      alert('Informe o bairro de destino da entrega.');
      return;
    }

    setIsSaving(true);
    try {
      const feeNum = Number(customCourierFee) || baseRate;
      const addNum = Math.max(0, Math.round((feeNum - baseRate) * 100) / 100);

      const payload = {
        id: crypto.randomUUID(),
        external_order_id: `MAN-${Date.now().toString().slice(-6)}`,
        order_number: orderNumber.trim() || 'RETORNO',
        courier_id: matchedCourier ? matchedCourier.id : null,
        courier_name: courierName.trim(),
        delivery_date: (() => {
          if (!deliveryDate) return new Date().toISOString();
          const [y, m, d] = deliveryDate.split('-').map(Number);
          const now = new Date();
          return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString();
        })(),
        order_amount: Number(orderAmount) || 0,
        payment_method: paymentMethod,
        neighborhood_name: matchedRate ? matchedRate.name : neighborhoodName.trim().toUpperCase(),
        neighborhood_rate_id: matchedRate ? matchedRate.id : null,
        neighborhood_total_rate: feeNum,
        base_rate: baseRate,
        additional_rate: addNum,
        courier_fee: feeNum,
        status: 'Concluído',
        has_pending_issue: false,
        pending_issue_reason: null,
        is_manually_edited: true,
        is_paid: false,
        notes: notes.trim()
      };

      const { error } = await supabase.from('deliveries').insert(payload);
      if (error) throw error;

      alert('Entrega adicionada com sucesso!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao adicionar entrega: ' + (err.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '650px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(244, 63, 94, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F43F5E'
            }}>
              <Bike size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC' }}>
                Adicionar Entrega Manual
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Lançamento de retornos ao cliente, corridas avulsas ou entregas fora do sistema
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tipo de Corrida Selector */}
        <div style={{ marginBottom: '18px' }}>
          <label className="form-label" style={{ marginBottom: '8px' }}>Tipo da Corrida *</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <button
              type="button"
              onClick={() => handleTypeChange('return')}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: deliveryType === 'return' ? '2px solid #F43F5E' : '1px solid var(--border-color)',
                backgroundColor: deliveryType === 'return' ? 'rgba(244, 63, 94, 0.15)' : 'var(--bg-input)',
                color: deliveryType === 'return' ? '#F43F5E' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RotateCcw size={16} />
              <span>Retorno ao Cliente</span>
            </button>

            <button
              type="button"
              onClick={() => handleTypeChange('normal')}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: deliveryType === 'normal' ? '2px solid #38BDF8' : '1px solid var(--border-color)',
                backgroundColor: deliveryType === 'normal' ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-input)',
                color: deliveryType === 'normal' ? '#38BDF8' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Bike size={16} />
              <span>Entrega Normal</span>
            </button>

            <button
              type="button"
              onClick={() => handleTypeChange('extra')}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: deliveryType === 'extra' ? '2px solid #FBBF24' : '1px solid var(--border-color)',
                backgroundColor: deliveryType === 'extra' ? 'rgba(251, 191, 36, 0.15)' : 'var(--bg-input)',
                color: deliveryType === 'extra' ? '#FBBF24' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <DollarSign size={16} />
              <span>Viagem Extra / Outro</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            {/* Motoboy */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Entregador (Motoboy) *</label>
              <select
                className="select"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                required
              >
                <option value="">Selecione um motoboy...</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Número / Identificador */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Identificador / Nº Pedido *</label>
              <input
                type="text"
                className="input"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Ex: RET-2395 ou #2395"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            {/* Data e Hora */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Data e Horário da Corrida *</label>
              <input
                type="datetime-local"
                className="input"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                required
              />
            </div>

            {/* Bairro com Datalist Oficial */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Bairro de Destino *</label>
              <input
                type="text"
                className="input"
                list="delivery-modal-bairros"
                value={neighborhoodName}
                onChange={(e) => handleNeighborhoodChange(e.target.value)}
                placeholder="Digite ou selecione o bairro..."
                required
              />
              <datalist id="delivery-modal-bairros">
                {neighborhoodRates.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name} - {formatCurrency(r.total_rate)}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          {/* Taxa do Motoboy & Valor do Pedido */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Taxa a Pagar ao Motoboy (R$) *</label>
              <input
                type="number"
                step="0.50"
                min="0"
                className="input"
                style={{ fontWeight: 700, color: '#34D399', fontSize: '1.05rem' }}
                value={customCourierFee}
                onChange={(e) => setCustomCourierFee(e.target.value)}
                required
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {matchedRate 
                  ? `Tarifa oficial do bairro: ${formatCurrency(matchedRate.total_rate)} (Base R$ 8 + Adic. ${formatCurrency(calculatedRates.additionalRate)})`
                  : 'Base padrão R$ 8,00'}
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Valor do Pedido (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={orderAmount}
                onChange={(e) => setOrderAmount(e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {deliveryType === 'return' ? 'Geralmente R$ 0,00 para retornos' : 'Valor dos itens'}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            {/* Pagamento */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Forma de Pagamento</label>
              <select
                className="select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="Sem cobrança (Retorno / Cortesia)">Sem cobrança (Retorno / Cortesia)</option>
                <option value="Pix">Pix</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Cartão de débito">Cartão de débito</option>
                <option value="Cartão de crédito">Cartão de crédito</option>
                <option value="Balcão">Balcão</option>
              </select>
            </div>

            {/* Motivo / Observações */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Motivo / Observações</label>
              <input
                type="text"
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Troca de refrigerante, cortesia..."
              />
            </div>
          </div>

          {/* Card de Resumo Prévia */}
          <div style={{
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RESUMO DA CORRIDA</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#F8FAFC' }}>
                {courierName || 'Sem motoboy'} • {neighborhoodName || 'Bairro a definir'} ({orderNumber || 'RET'})
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: '#34D399', fontWeight: 600 }}>TAXA DO MOTOBOY</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#34D399' }}>
                {formatCurrency(Number(customCourierFee) || 8.00)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={isSaving} className="btn btn-primary" style={{ minWidth: '160px' }}>
              <Save size={16} />
              <span>{isSaving ? 'Salvando...' : 'Salvar Corrida'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
